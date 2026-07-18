import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getCurrentUser, sameOrigin } from '../../../../lib/auth'
import { db, ensureSchema } from '../../../../lib/db'
import {
  COMPACTION_THRESHOLD,
  STEP_INTERVAL_MS,
  STEPS_PER_CYCLE,
} from '../../../../lib/inner-config'
import { createReflection, estimateTokens } from '../../../../lib/inner-model'

export const maxDuration = 180

export async function POST(request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

  let body = {}
  try { body = await request.json() } catch {}
  const cycleId = String(body.cycleId || '')
  const stepNumber = Number(body.stepNumber)
  if (!cycleId || !Number.isInteger(stepNumber) || stepNumber < 1 || stepNumber > STEPS_PER_CYCLE) {
    return NextResponse.json({ error: 'Invalid reflection pass.' }, { status: 400 })
  }

  await ensureSchema()
  const sql = db()
  const [cycles, profiles] = await Promise.all([
    sql`
      SELECT * FROM inner_cycles
      WHERE id = ${cycleId} AND user_id = ${user.id} AND status = 'active'
      LIMIT 1
    `,
    sql`SELECT * FROM inner_profiles WHERE user_id = ${user.id} LIMIT 1`,
  ])
  const cycle = cycles[0]
  const profile = profiles[0]
  if (!cycle || !profile?.loop_enabled) {
    return NextResponse.json({ error: 'The loop is not running.' }, { status: 409 })
  }

  const dueAt = new Date(cycle.started_at).getTime() + (stepNumber - 1) * STEP_INTERVAL_MS
  if (Date.now() + 1500 < dueAt) {
    return NextResponse.json({ error: 'This reflection pass is not due yet.', dueAt }, { status: 409 })
  }

  const priorCount = await sql`
    SELECT count(*)::int AS count
    FROM inner_reflections
    WHERE cycle_id = ${cycleId} AND status = 'complete' AND step_number < ${stepNumber}
  `
  if (Number(priorCount[0]?.count || 0) < stepNumber - 1) {
    return NextResponse.json({ error: 'Earlier reflection passes must finish first.' }, { status: 409 })
  }

  const existing = await sql`
    SELECT * FROM inner_reflections
    WHERE cycle_id = ${cycleId} AND step_number = ${stepNumber}
    LIMIT 1
  `
  if (existing[0]?.status === 'complete') {
    return NextResponse.json({ reflection: existing[0], existing: true })
  }
  if (existing[0]?.status === 'pending' && Date.now() - new Date(existing[0].updated_at).getTime() < 170000) {
    return NextResponse.json({ error: 'This reflection pass is already running.' }, { status: 409 })
  }

  const reflectionId = existing[0]?.id || randomUUID()
  if (existing[0]) {
    await sql`
      UPDATE inner_reflections
      SET status = 'pending', updated_at = now()
      WHERE id = ${reflectionId}
    `
  } else {
    await sql`
      INSERT INTO inner_reflections
        (id, user_id, cycle_id, cycle_number, step_number, status)
      VALUES
        (${reflectionId}, ${user.id}, ${cycleId}, ${cycle.cycle_number}, ${stepNumber}, 'pending')
    `
  }

  const requestStartedAt = new Date()
  try {
    const [recentReflections, topics, memoryItems, userInputs] = await Promise.all([
      sql`
        SELECT cycle_number, step_number, focus, note
        FROM inner_reflections
        WHERE user_id = ${user.id} AND status = 'complete'
        ORDER BY created_at DESC
        LIMIT 14
      `,
      sql`
        SELECT id, name, summary
        FROM inner_memory_topics
        WHERE user_id = ${user.id}
        ORDER BY updated_at DESC
        LIMIT 100
      `,
      sql`
        SELECT i.title, i.summary, i.details, i.keywords, t.name AS topic_name
        FROM inner_memory_items i
        JOIN inner_memory_topics t ON t.id = i.topic_id
        WHERE i.user_id = ${user.id}
        ORDER BY i.created_at DESC
        LIMIT 24
      `,
      sql`
        SELECT id, content, created_at
        FROM inner_inputs
        WHERE user_id = ${user.id} AND consumed_at IS NULL
        ORDER BY created_at ASC
        LIMIT 12
      `,
    ])

    const generated = await createReflection({
      profile,
      cycle,
      stepNumber,
      recentReflections: recentReflections.reverse(),
      topics,
      memoryItems,
      userInputs,
    })
    const tokenEstimate = estimateTokens(`${generated.focus}\n${generated.note}\n${generated.spokenSentence}`)

    const completed = await sql`
      UPDATE inner_reflections
      SET status = 'complete',
          focus = ${generated.focus},
          note = ${generated.note},
          spoken_candidate = ${generated.spokenSentence},
          token_estimate = ${tokenEstimate},
          updated_at = now()
      WHERE id = ${reflectionId}
      RETURNING *
    `

    const updatedProfiles = await sql`
      UPDATE inner_profiles
      SET active_token_estimate = active_token_estimate + ${tokenEstimate},
          updated_at = now()
      WHERE user_id = ${user.id}
      RETURNING active_token_estimate, context_token_limit, compaction_threshold
    `

    await sql`
      UPDATE inner_inputs
      SET consumed_at = now()
      WHERE user_id = ${user.id}
        AND consumed_at IS NULL
        AND created_at <= ${requestStartedAt.toISOString()}
    `

    const updatedProfile = updatedProfiles[0]
    const threshold = Number(updatedProfile?.compaction_threshold || COMPACTION_THRESHOLD)
    const needsCompaction = Number(updatedProfile?.active_token_estimate || 0)
      >= Number(updatedProfile?.context_token_limit || 32000) * threshold

    return NextResponse.json({
      reflection: completed[0],
      needsCompaction,
      activeTokenEstimate: Number(updatedProfile?.active_token_estimate || 0),
    })
  } catch (error) {
    console.error('Inner Monologue reflection failed:', error)
    await sql`
      UPDATE inner_reflections
      SET status = 'error', updated_at = now()
      WHERE id = ${reflectionId}
    `
    return NextResponse.json({ error: 'The reflection model could not complete this pass.' }, { status: 502 })
  }
}
