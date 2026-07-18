import { NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import { db, ensureSchema } from '../../../../lib/db'
import { DEFAULT_INNER_PROMPT } from '../../../../lib/inner-config'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

    await ensureSchema()
    const sql = db()
    await sql`
      INSERT INTO inner_profiles (user_id, system_prompt)
      VALUES (${user.id}, ${DEFAULT_INNER_PROMPT})
      ON CONFLICT (user_id) DO NOTHING
    `

    const [profiles, cycles, reflections, topics, memoryItems, inputs] = await Promise.all([
      sql`SELECT * FROM inner_profiles WHERE user_id = ${user.id} LIMIT 1`,
      sql`
        SELECT * FROM inner_cycles
        WHERE user_id = ${user.id} AND status = 'active'
        ORDER BY started_at DESC
        LIMIT 1
      `,
      sql`
        SELECT id, cycle_id, cycle_number, step_number, status, focus, note,
               spoken_candidate, token_estimate, compacted_at, created_at, updated_at
        FROM inner_reflections
        WHERE user_id = ${user.id} AND status = 'complete'
        ORDER BY created_at DESC
        LIMIT 30
      `,
      sql`
        SELECT id, slug, name, summary, created_at, updated_at
        FROM inner_memory_topics
        WHERE user_id = ${user.id}
        ORDER BY updated_at DESC
        LIMIT 100
      `,
      sql`
        SELECT i.id, i.topic_id, t.name AS topic_name, i.cycle_number,
               i.title, i.summary, i.details, i.keywords, i.created_at
        FROM inner_memory_items i
        JOIN inner_memory_topics t ON t.id = i.topic_id
        WHERE i.user_id = ${user.id}
        ORDER BY i.created_at DESC
        LIMIT 120
      `,
      sql`
        SELECT id, content, created_at, consumed_at
        FROM inner_inputs
        WHERE user_id = ${user.id}
        ORDER BY created_at DESC
        LIMIT 30
      `,
    ])

    const activeCycle = cycles[0] || null
    let pendingStep = null
    if (activeCycle) {
      const pending = await sql`
        SELECT id, step_number, status, updated_at
        FROM inner_reflections
        WHERE cycle_id = ${activeCycle.id} AND status <> 'complete'
        ORDER BY step_number ASC
        LIMIT 1
      `
      pendingStep = pending[0] || null
    }

    return NextResponse.json({
      user,
      profile: profiles[0],
      cycle: activeCycle,
      pendingStep,
      reflections: reflections.reverse(),
      topics,
      memoryItems,
      inputs: inputs.reverse(),
    })
  } catch (error) {
    console.error('Inner Monologue state failed:', error)
    return NextResponse.json({ error: 'Could not load Inner Monologue.' }, { status: 500 })
  }
}
