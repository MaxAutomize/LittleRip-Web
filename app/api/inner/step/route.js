import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getCurrentUser, sameOrigin } from '../../../../lib/auth'
import { db, ensureSchema } from '../../../../lib/db'
import { INNER_MODEL } from '../../../../lib/inner-config'
import {
  buildInnerSystem,
  estimateTokens,
} from '../../../../lib/inner-model'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const TRACE_METADATA_FORMAT = {
  type: 'object',
  properties: {
    focus: { type: 'string' },
    marker: { type: 'string' },
  },
  required: ['focus', 'marker'],
}

export async function POST(request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

  let body = {}
  try { body = await request.json() } catch {}
  const cycleId = String(body.cycleId || '')
  const segmentNumber = Number(body.segmentNumber)
  if (!cycleId || !Number.isInteger(segmentNumber) || segmentNumber < 1 || segmentNumber > 100) {
    return NextResponse.json({ error: 'Invalid thinking segment.' }, { status: 400 })
  }

  await ensureSchema()
  const sql = db()
  const [cycles, profiles] = await Promise.all([
    sql`SELECT * FROM inner_cycles WHERE id = ${cycleId} AND user_id = ${user.id} AND status = 'active' LIMIT 1`,
    sql`SELECT * FROM inner_profiles WHERE user_id = ${user.id} LIMIT 1`,
  ])
  const cycle = cycles[0]
  const profile = profiles[0]
  if (!cycle || !profile?.loop_enabled) {
    return NextResponse.json({ error: 'The loop is not running.' }, { status: 409 })
  }

  const prior = await sql`
    SELECT count(*)::int AS count
    FROM inner_reflections
    WHERE cycle_id = ${cycleId} AND status = 'complete' AND step_number < ${segmentNumber}
  `
  if (Number(prior[0]?.count || 0) < segmentNumber - 1) {
    return NextResponse.json({ error: 'The previous thinking segment has not finished.' }, { status: 409 })
  }

  const existing = await sql`
    SELECT * FROM inner_reflections
    WHERE cycle_id = ${cycleId} AND step_number = ${segmentNumber}
    LIMIT 1
  `
  if (existing[0]?.status === 'complete') {
    return NextResponse.json({ reflection: existing[0], existing: true })
  }
  if (existing[0]?.status === 'pending' && Date.now() - new Date(existing[0].updated_at).getTime() < 290000) {
    return NextResponse.json({ error: 'This thinking segment is already running.' }, { status: 409 })
  }

  const reflectionId = existing[0]?.id || randomUUID()
  if (existing[0]) {
    await sql`UPDATE inner_reflections SET status = 'pending', updated_at = now() WHERE id = ${reflectionId}`
  } else {
    await sql`
      INSERT INTO inner_reflections
        (id, user_id, cycle_id, cycle_number, step_number, status)
      VALUES
        (${reflectionId}, ${user.id}, ${cycleId}, ${cycle.cycle_number}, ${segmentNumber}, 'pending')
    `
  }

  const requestStartedAt = new Date()
  const [recent, topics, memoryItems, userInputs] = await Promise.all([
    sql`
      SELECT cycle_number, step_number, focus, note, spoken_candidate
      FROM inner_reflections
      WHERE user_id = ${user.id} AND status = 'complete'
      ORDER BY created_at DESC
      LIMIT 3
    `,
    sql`
      SELECT name, summary FROM inner_memory_topics
      WHERE user_id = ${user.id}
      ORDER BY updated_at DESC
      LIMIT 80
    `,
    sql`
      SELECT i.title, i.summary, t.name AS topic_name
      FROM inner_memory_items i
      JOIN inner_memory_topics t ON t.id = i.topic_id
      WHERE i.user_id = ${user.id}
      ORDER BY i.created_at DESC
      LIMIT 16
    `,
    sql`
      SELECT id, content, created_at FROM inner_inputs
      WHERE user_id = ${user.id} AND consumed_at IS NULL
      ORDER BY created_at ASC
      LIMIT 12
    `,
  ])

  const memoryIndex = topics.length
    ? topics.map(t => `- ${t.name}: ${String(t.summary || '').slice(0, 280)}`).join('\n')
    : 'No compacted memory folders yet.'
  const selectedMemory = memoryItems.length
    ? memoryItems.map(m => `- ${m.title}: ${String(m.summary || '').slice(0, 360)}`).join('\n')
    : 'No detailed memory items yet.'
  const inputContext = userInputs.length
    ? userInputs.map(i => `- ${i.content}`).join('\n')
    : 'No new user input.'
  const previous = recent[0]

  const contextMessage = `MEMORY FOLDER INDEX:\n${memoryIndex}\n\nRECENT MEMORY ITEMS:\n${selectedMemory}\n\nNEW USER INPUT TO WEAVE INTO THE SAME INQUIRY:\n${inputContext}`
  const finalInstruction = `Continue from the last thought without repeating these instructions. Make up one wild theory that ties together the brain doing things before "you" know, personal taste, dreams, and what endless energy might do to a brain-like thing. Beat the theory up. Find what is dumb about it. Repair it, break it again, and keep doing that until a stranger idea falls out. Keep the thinking rough, blunt, clear, half-built, and kind of crazy instead of turning it into a school essay. The final content is hidden: after the long thinking trace, return only JSON with a short focus and the marker "keep going".`

  const messages = [{ role: 'system', content: buildInnerSystem(profile) }]
  if (previous?.note) {
    messages.push({ role: 'user', content: contextMessage })
    messages.push({
      role: 'assistant',
      thinking: String(previous.note).slice(-18000),
      content: String(previous.spoken_candidate || ''),
    })
    messages.push({ role: 'user', content: finalInstruction })
  } else {
    messages.push({ role: 'user', content: `${contextMessage}\n\n${finalInstruction}` })
  }

  const baseUrl = (process.env.OLLAMA_BASE_URL || 'https://ollama.com').replace(/\/$/, '')
  const apiKey = process.env.OLLAMA_API_KEY?.trim()
  if (!apiKey && baseUrl === 'https://ollama.com') {
    await sql`UPDATE inner_reflections SET status = 'error', updated_at = now() WHERE id = ${reflectionId}`
    return NextResponse.json({ error: 'Ollama Cloud is not configured.' }, { status: 503 })
  }

  const remainingMs = Math.max(5000, new Date(cycle.ends_at).getTime() - Date.now() + 1200)
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), Math.min(remainingMs, 170000))

  let upstream
  try {
    upstream = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: process.env.INNER_MONOLOGUE_MODEL || INNER_MODEL,
        messages,
        stream: true,
        think: 'max',
        format: TRACE_METADATA_FORMAT,
        options: { temperature: 0.86, top_p: 0.95, num_predict: 6000 },
      }),
      signal: abortController.signal,
    })
  } catch (error) {
    clearTimeout(timeout)
    await sql`UPDATE inner_reflections SET status = 'error', updated_at = now() WHERE id = ${reflectionId}`
    console.error('Could not open GLM thinking stream:', error?.name || 'Error')
    return NextResponse.json({ error: 'The thinking stream could not start.' }, { status: 502 })
  }

  if (!upstream.ok || !upstream.body) {
    clearTimeout(timeout)
    await sql`UPDATE inner_reflections SET status = 'error', updated_at = now() WHERE id = ${reflectionId}`
    return NextResponse.json({ error: `Ollama returned ${upstream.status}.` }, { status: 502 })
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  let thinking = ''
  let content = ''
  let buffer = ''

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)) } catch {}
      }
      try {
        const reader = upstream.body.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const chunk = JSON.parse(line)
              const thought = chunk?.message?.thinking
              const final = chunk?.message?.content
              if (thought) {
                thinking += thought
                send({ type: 'thinking', text: thought })
              }
              if (final) content += final
            } catch {}
          }
        }
      } catch (error) {
        if (error?.name !== 'AbortError') console.error('GLM thinking stream interrupted:', error?.name || 'Error')
      } finally {
        clearTimeout(timeout)
      }

      try {
        const focus = String(previous?.focus || 'Unfiled thought').slice(0, 120)
        const sentence = String(previous?.spoken_candidate || '')
        const tokenEstimate = estimateTokens(thinking)
        const completed = await sql`
          UPDATE inner_reflections
          SET status = 'complete', focus = ${focus}, note = ${thinking},
              spoken_candidate = ${sentence}, token_estimate = ${tokenEstimate}, updated_at = now()
          WHERE id = ${reflectionId}
          RETURNING *
        `
        const updatedProfiles = await sql`
          UPDATE inner_profiles
          SET active_token_estimate = active_token_estimate + ${tokenEstimate}, updated_at = now()
          WHERE user_id = ${user.id}
          RETURNING active_token_estimate, context_token_limit, compaction_threshold
        `
        await sql`
          UPDATE inner_inputs SET consumed_at = now()
          WHERE user_id = ${user.id} AND consumed_at IS NULL
            AND created_at <= ${requestStartedAt.toISOString()}
        `
        const updatedProfile = updatedProfiles[0]
        const needsCompaction = Number(updatedProfile?.active_token_estimate || 0)
          >= Number(updatedProfile?.context_token_limit || 32000) * Number(updatedProfile?.compaction_threshold || 0.7)
        send({
          type: 'saved',
          reflection: completed[0],
          activeTokenEstimate: Number(updatedProfile?.active_token_estimate || 0),
          needsCompaction,
        })
      } catch (error) {
        console.error('Could not save GLM thinking trace:', error)
        await sql`UPDATE inner_reflections SET status = 'error', updated_at = now() WHERE id = ${reflectionId}`
        send({ type: 'error', error: 'The thinking trace could not be saved.' })
      }
      try { controller.close() } catch {}
    },
    cancel() {
      abortController.abort()
      clearTimeout(timeout)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
