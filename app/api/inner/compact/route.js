import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getCurrentUser, sameOrigin } from '../../../../lib/auth'
import { db, ensureSchema } from '../../../../lib/db'
import { COMPACTION_THRESHOLD } from '../../../../lib/inner-config'
import { compactReflections, slugifyTopic } from '../../../../lib/inner-model'

export const maxDuration = 300

export async function POST(request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

  await ensureSchema()
  const sql = db()
  const profiles = await sql`SELECT * FROM inner_profiles WHERE user_id = ${user.id} LIMIT 1`
  const profile = profiles[0]
  if (!profile) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 })

  const threshold = Number(profile.context_token_limit) * Number(profile.compaction_threshold || COMPACTION_THRESHOLD)
  if (Number(profile.active_token_estimate) < threshold) {
    return NextResponse.json({ compacted: false, reason: 'threshold-not-reached' })
  }

  await sql`
    DELETE FROM inner_compaction_jobs
    WHERE user_id = ${user.id} AND started_at < now() - interval '10 minutes'
  `
  const claim = await sql`
    INSERT INTO inner_compaction_jobs (user_id)
    VALUES (${user.id})
    ON CONFLICT (user_id) DO NOTHING
    RETURNING user_id
  `
  if (!claim[0]) {
    return NextResponse.json({ error: 'Memory compaction is already running.' }, { status: 409 })
  }

  try {
    const [reflections, existingTopics] = await Promise.all([
      sql`
        SELECT id, cycle_number, step_number, focus, note, token_estimate, created_at
        FROM inner_reflections
        WHERE user_id = ${user.id}
          AND status = 'complete'
          AND compacted_at IS NULL
        ORDER BY created_at ASC
        LIMIT 300
      `,
      sql`
        SELECT id, slug, name, summary
        FROM inner_memory_topics
        WHERE user_id = ${user.id}
        ORDER BY updated_at DESC
        LIMIT 100
      `,
    ])

    if (!reflections.length) {
      await sql`
        UPDATE inner_profiles SET active_token_estimate = 0, updated_at = now()
        WHERE user_id = ${user.id}
      `
      return NextResponse.json({ compacted: false, reason: 'nothing-to-compact' })
    }

    const compacted = await compactReflections({ profile, reflections, topics: existingTopics })
    const sourceTokens = reflections.reduce((sum, row) => sum + Number(row.token_estimate || 0), 0)
    const cutoff = reflections[reflections.length - 1].created_at

    let itemCount = 0
    for (const rawTopic of compacted.topics) {
      const name = String(rawTopic.name || 'Uncategorized').slice(0, 120)
      const slug = slugifyTopic(name)
      const summary = String(rawTopic.summary || '').slice(0, 3000)
      const topicRows = await sql`
        INSERT INTO inner_memory_topics (id, user_id, slug, name, summary)
        VALUES (${randomUUID()}, ${user.id}, ${slug}, ${name}, ${summary})
        ON CONFLICT (user_id, slug)
        DO UPDATE SET name = EXCLUDED.name, summary = EXCLUDED.summary, updated_at = now()
        RETURNING id
      `
      const topicId = topicRows[0].id
      const items = Array.isArray(rawTopic.items) ? rawTopic.items.slice(0, 100) : []
      await Promise.all(items.map(item => {
        itemCount += 1
        const title = String(item.title || 'Idea').slice(0, 180)
        const itemSummary = String(item.summary || '').slice(0, 2000)
        const details = String(item.details || '').slice(0, 6000)
        const keywords = Array.isArray(item.keywords)
          ? item.keywords.map(v => String(v).slice(0, 60)).slice(0, 8).join(', ')
          : ''
        return sql`
          INSERT INTO inner_memory_items
            (id, user_id, topic_id, cycle_number, title, summary, details, keywords)
          VALUES
            (${randomUUID()}, ${user.id}, ${topicId}, ${profile.cycle_number}, ${title}, ${itemSummary}, ${details}, ${keywords})
        `
      }))
    }

    const promptBefore = profile.evolving_prompt || ''
    await Promise.all([
      sql`
        UPDATE inner_reflections
        SET compacted_at = now()
        WHERE user_id = ${user.id}
          AND compacted_at IS NULL
          AND created_at <= ${new Date(cutoff).toISOString()}
      `,
      sql`
        UPDATE inner_profiles
        SET active_token_estimate = GREATEST(0, active_token_estimate - ${sourceTokens}),
            evolving_prompt = ${compacted.evolvingPrompt},
            prompt_revision_count = prompt_revision_count + 1,
            updated_at = now()
        WHERE user_id = ${user.id}
      `,
      sql`
        INSERT INTO inner_compactions
          (id, user_id, source_token_estimate, summary, prompt_before, prompt_after)
        VALUES
          (${randomUUID()}, ${user.id}, ${sourceTokens}, ${compacted.summary}, ${promptBefore}, ${compacted.evolvingPrompt})
      `,
    ])

    return NextResponse.json({
      compacted: true,
      sourceTokens,
      topics: compacted.topics.length,
      items: itemCount,
      summary: compacted.summary,
      evolvingPrompt: compacted.evolvingPrompt,
    })
  } catch (error) {
    console.error('Inner Monologue compaction failed:', error)
    return NextResponse.json({ error: 'Memory compaction could not finish.' }, { status: 502 })
  } finally {
    await sql`DELETE FROM inner_compaction_jobs WHERE user_id = ${user.id}`
  }
}
