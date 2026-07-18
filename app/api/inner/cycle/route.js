import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getCurrentUser, sameOrigin } from '../../../../lib/auth'
import { db, ensureSchema } from '../../../../lib/db'
import { CYCLE_DURATION_MS } from '../../../../lib/inner-config'
import { createSpokenShare, normalizeSpokenSentence } from '../../../../lib/inner-model'

export const maxDuration = 180

export async function POST(request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

  let body = {}
  try { body = await request.json() } catch {}

  await ensureSchema()
  const sql = db()

  if (body.action === 'start') {
    const active = await sql`
      SELECT * FROM inner_cycles
      WHERE user_id = ${user.id} AND status = 'active'
      ORDER BY started_at DESC
      LIMIT 1
    `
    if (active[0]) {
      await sql`
        UPDATE inner_profiles SET loop_enabled = true, updated_at = now()
        WHERE user_id = ${user.id}
      `
      return NextResponse.json({ cycle: active[0], existing: true })
    }

    const profiles = await sql`
      UPDATE inner_profiles
      SET loop_enabled = true,
          cycle_number = cycle_number + 1,
          updated_at = now()
      WHERE user_id = ${user.id}
      RETURNING cycle_number
    `
    if (!profiles[0]) {
      return NextResponse.json({ error: 'Inner Monologue profile is missing.' }, { status: 409 })
    }

    const id = randomUUID()
    const startedAt = new Date()
    const endsAt = new Date(startedAt.getTime() + CYCLE_DURATION_MS)
    const cycles = await sql`
      INSERT INTO inner_cycles (id, user_id, cycle_number, started_at, ends_at)
      VALUES (${id}, ${user.id}, ${profiles[0].cycle_number}, ${startedAt.toISOString()}, ${endsAt.toISOString()})
      RETURNING *
    `
    return NextResponse.json({ cycle: cycles[0] })
  }

  if (body.action === 'pause') {
    await Promise.all([
      sql`
        UPDATE inner_profiles
        SET loop_enabled = false, updated_at = now()
        WHERE user_id = ${user.id}
      `,
      sql`
        UPDATE inner_cycles
        SET status = 'paused', completed_at = now()
        WHERE user_id = ${user.id} AND status = 'active'
      `,
    ])
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'finish') {
    const cycleId = String(body.cycleId || '')
    const cycles = await sql`
      SELECT * FROM inner_cycles
      WHERE id = ${cycleId} AND user_id = ${user.id} AND status = 'active'
      LIMIT 1
    `
    const cycle = cycles[0]
    if (!cycle) return NextResponse.json({ error: 'Active cycle not found.' }, { status: 404 })
    if (new Date(cycle.ends_at).getTime() > Date.now() + 1500) {
      return NextResponse.json({ error: 'The five-minute cycle is still in progress.' }, { status: 409 })
    }

    const [reflections, profiles] = await Promise.all([
      sql`
        SELECT step_number, focus, note, spoken_candidate
        FROM inner_reflections
        WHERE cycle_id = ${cycle.id} AND user_id = ${user.id} AND status = 'complete'
        ORDER BY step_number ASC
      `,
      sql`SELECT * FROM inner_profiles WHERE user_id = ${user.id} LIMIT 1`,
    ])
    if (reflections.length < 1) {
      return NextResponse.json({ error: 'Let the thinking trace begin before sharing.' }, { status: 409 })
    }

    let focus = reflections[reflections.length - 1]?.focus || 'Unfiled thought'
    let sentence = normalizeSpokenSentence(reflections[reflections.length - 1]?.spoken_candidate)
    try {
      const share = await createSpokenShare({ profile: profiles[0], traces: reflections })
      focus = share.focus
      sentence = share.sentence
    } catch (error) {
      console.error('Could not create the five-minute spoken sentence:', error?.message || 'Error')
    }

    const [updated] = await Promise.all([
      sql`
        UPDATE inner_cycles
        SET status = 'complete', spoken_sentence = ${sentence}, completed_at = now()
        WHERE id = ${cycle.id}
        RETURNING *
      `,
      sql`
        UPDATE inner_reflections
        SET focus = ${focus}, spoken_candidate = ${sentence}, updated_at = now()
        WHERE cycle_id = ${cycle.id} AND user_id = ${user.id} AND status = 'complete'
      `,
    ])
    return NextResponse.json({ cycle: updated[0], sentence })
  }

  return NextResponse.json({ error: 'Unknown cycle action.' }, { status: 400 })
}
