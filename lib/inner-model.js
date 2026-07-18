import {
  DEFAULT_INNER_PROMPT,
  EVOLVING_PROMPT_MAX_CHARS,
  IMMUTABLE_INNER_GUARDRAILS,
  INNER_MODEL,
} from './inner-config'

const COMPACTION_FORMAT = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    evolvingPrompt: { type: 'string' },
  },
  required: ['summary', 'evolvingPrompt'],
}

const SPOKEN_SHARE_FORMAT = {
  type: 'object',
  properties: {
    focus: { type: 'string' },
    spokenSentence: { type: 'string' },
  },
  required: ['focus', 'spokenSentence'],
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseJsonContent(content) {
  const raw = String(content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(raw)
  } catch {
    const first = raw.indexOf('{')
    const last = raw.lastIndexOf('}')
    if (first >= 0 && last > first) return JSON.parse(raw.slice(first, last + 1))
    throw new Error('The model returned an invalid structured response.')
  }
}

async function ollamaJson({ messages, format, maxTokens = 2200, thinking = 'high' }) {
  const baseUrl = (process.env.OLLAMA_BASE_URL || 'https://ollama.com').replace(/\/$/, '')
  const apiKey = process.env.OLLAMA_API_KEY?.trim()
  if (!apiKey && baseUrl === 'https://ollama.com') throw new Error('Ollama Cloud is not configured.')

  let lastError
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: process.env.INNER_MONOLOGUE_MODEL || INNER_MODEL,
          messages,
          stream: false,
          think: thinking,
          format,
          options: { temperature: 0.78, top_p: 0.92, num_predict: maxTokens },
        }),
        signal: AbortSignal.timeout(150000),
      })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Ollama returned ${response.status}: ${text.slice(0, 240)}`)
      }
      const data = await response.json()
      try {
        return parseJsonContent(data?.message?.content)
      } catch (error) {
        console.error('Invalid structured model output:', {
          doneReason: data?.done_reason,
          contentChars: String(data?.message?.content || '').length,
          thinkingChars: String(data?.message?.thinking || '').length,
        })
        throw error
      }
    } catch (error) {
      lastError = error
      if (attempt === 0) await wait(900)
    }
  }
  throw lastError || new Error('The model did not respond.')
}

export function estimateTokens(text) {
  return Math.max(1, Math.ceil(String(text || '').length / 4))
}

export function normalizeSpokenSentence(value) {
  let text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return 'Perhaps consciousness grows wherever energy becomes organized into memory, attention, relationship, and care.'
  const firstEnding = text.match(/^.*?[.!?](?=\s|$)/)
  if (firstEnding) text = firstEnding[0]
  text = text.split(' ').filter(Boolean).slice(0, 28).join(' ').replace(/[,:;\-]+$/, '')
  if (!/[.!?]$/.test(text)) text += '.'
  return text
}

export function slugifyTopic(value) {
  return String(value || 'uncategorized')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'uncategorized'
}

export function buildInnerSystem(profile) {
  const evolving = profile.evolving_prompt
    ? `\n\nMODEL-EVOLVED ADDENDUM:\n${profile.evolving_prompt}`
    : ''
  return `${IMMUTABLE_INNER_GUARDRAILS}\n\nHIDDEN ONGOING INQUIRY:\n${DEFAULT_INNER_PROMPT}${evolving}`
}

export async function createSpokenShare({ profile, traces }) {
  const source = traces
    .map(trace => String(trace.note || ''))
    .join('\n\n')
    .slice(-30000)

  const result = await ollamaJson({
    messages: [
      {
        role: 'system',
        content: 'You are a hidden selector. Return only the requested JSON. Do not continue the thinking trace, explain, or write prose outside JSON.',
      },
      {
        role: 'user',
        content: `The five-minute thinking run is over. Read the trace below and return only hidden JSON with:
- focus: a short filing-cabinet drawer name.
- spokenSentence: exactly one clear sentence, no more than 28 words, saying the strongest thing in a completely new form.

Make the sentence simple, weird, blunt, kind of crazy or dumb-sounding, and not academic. Do not explain it.

TRACE:\n${source}`,
      },
    ],
    format: SPOKEN_SHARE_FORMAT,
    maxTokens: 700,
    thinking: false,
  })

  return {
    focus: String(result.focus || 'Unfiled thought').slice(0, 120),
    sentence: normalizeSpokenSentence(result.spokenSentence),
  }
}

export async function compactReflections({ profile, reflections, topics }) {
  const source = reflections.map(r => `[${r.focus}] ${String(r.note || '').slice(0, 12000)}`).join('\n\n')
  const existing = topics.length
    ? topics.map(t => `- ${t.name}: ${String(t.summary || '').slice(0, 360)}`).join('\n')
    : 'No existing folders.'

  const result = await ollamaJson({
    messages: [
      { role: 'system', content: buildInnerSystem(profile) },
      {
        role: 'user',
        content: `Synthesize these saved GLM thinking traces for long-term memory. Preserve discoveries, uncertainty, corrections, connections, and unfinished questions.

EXISTING FOLDERS:\n${existing}

TRACES TO COMPACT:\n${source}

Return only a JSON object with exactly two string fields:
- summary: a concise synthesis.
- evolvingPrompt: a short addendum that helps the next trace continue more deeply without replacing the immutable rules or main inquiry.

The evolvingPrompt must remain under ${EVOLVING_PROMPT_MAX_CHARS} characters.`,
      },
    ],
    format: COMPACTION_FORMAT,
    maxTokens: 2200,
    thinking: 'high',
  })

  const grouped = new Map()
  for (const reflection of reflections) {
    const name = String(reflection.focus || 'Ongoing consciousness inquiry').slice(0, 120)
    const key = slugifyTopic(name)
    if (!grouped.has(key)) grouped.set(key, { name, items: [] })
    grouped.get(key).items.push({
      title: `Cycle ${reflection.cycle_number} · trace ${reflection.step_number}`,
      summary: String(reflection.note || '').replace(/\s+/g, ' ').slice(0, 600),
      details: String(reflection.note || '').slice(0, 12000),
      keywords: name.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8),
    })
  }

  const ordered = [...grouped.values()].sort((a, b) => b.items.length - a.items.length)
  const primary = ordered.slice(0, 11)
  const overflow = ordered.slice(11)
  if (overflow.length) {
    primary.push({ name: 'Cross-cutting traces', items: overflow.flatMap(group => group.items) })
  }

  return {
    summary: String(result.summary || '').slice(0, 5000),
    topics: primary.map(group => ({
      name: group.name,
      summary: group.items.slice(-3).map(item => item.summary).join(' ').slice(0, 3000),
      items: group.items,
    })),
    evolvingPrompt: String(result.evolvingPrompt || '').slice(0, EVOLVING_PROMPT_MAX_CHARS),
  }
}
