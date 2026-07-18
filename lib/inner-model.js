import {
  EVOLVING_PROMPT_MAX_CHARS,
  IMMUTABLE_INNER_GUARDRAILS,
  INNER_MODEL,
} from './inner-config'

const REFLECTION_FORMAT = {
  type: 'object',
  properties: {
    focus: { type: 'string' },
    note: { type: 'string' },
    spokenSentence: { type: 'string' },
    memoryThreads: { type: 'array', items: { type: 'string' }, maxItems: 5 },
  },
  required: ['focus', 'note', 'spokenSentence', 'memoryThreads'],
}

const COMPACTION_FORMAT = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    evolvingPrompt: { type: 'string' },
  },
  required: ['summary', 'evolvingPrompt'],
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
    throw new Error('The model returned an invalid reflection format.')
  }
}

async function ollamaJson({ messages, format, maxTokens = 1200, thinking = 'high' }) {
  const baseUrl = (process.env.OLLAMA_BASE_URL || 'https://ollama.com').replace(/\/$/, '')
  const apiKey = process.env.OLLAMA_API_KEY?.trim()
  if (!apiKey && baseUrl === 'https://ollama.com') {
    throw new Error('Ollama Cloud is not configured.')
  }

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
          options: {
            temperature: 0.78,
            top_p: 0.92,
            num_predict: maxTokens,
          },
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
  throw lastError || new Error('The reflection model did not respond.')
}

export function estimateTokens(text) {
  return Math.max(1, Math.ceil(String(text || '').length / 4))
}

export function normalizeSpokenSentence(value) {
  let text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return 'Consciousness may depend less on raw power than on how energy becomes organized into memory, attention, relationship, and care.'

  const firstEnding = text.match(/^.*?[.!?](?=\s|$)/)
  if (firstEnding) text = firstEnding[0]
  const words = text.split(' ').filter(Boolean).slice(0, 28)
  text = words.join(' ').replace(/[,:;\-]+$/, '')
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

function buildSystem(profile) {
  const evolving = profile.evolving_prompt
    ? `\n\nMODEL-EVOLVED ADDENDUM (editable only during compaction):\n${profile.evolving_prompt}`
    : ''
  return `${IMMUTABLE_INNER_GUARDRAILS}\n\nUSER-EDITABLE INQUIRY:\n${profile.system_prompt}${evolving}`
}

export async function createReflection({ profile, cycle, stepNumber, recentReflections, topics, memoryItems, userInputs }) {
  const recent = recentReflections.length
    ? recentReflections.map(r => `[Cycle ${r.cycle_number}, pass ${r.step_number} — ${r.focus}] ${String(r.note || '').slice(0, 1500)}`).join('\n\n')
    : 'No earlier journal notes yet.'
  const memoryIndex = topics.length
    ? topics.map(t => `- ${t.name}: ${String(t.summary || '').slice(0, 360)}`).join('\n')
    : 'No compacted memory topics yet.'
  const memories = memoryItems.length
    ? memoryItems.map(m => `- ${m.title}: ${String(m.summary || '').slice(0, 500)}`).join('\n')
    : 'No detailed memories retrieved yet.'
  const inputs = userInputs.length
    ? userInputs.map(i => `- ${i.content}`).join('\n')
    : 'No new user input.'

  const prompt = `This is public reflection pass ${stepNumber} of 5 in five-minute cycle ${cycle.cycle_number}.

Think at high effort internally, but return only the requested JSON. The note is a concise public reflection, not private chain-of-thought. Move the inquiry forward rather than restating instructions.

RECENT JOURNAL:
${recent}

MEMORY FOLDER INDEX:
${memoryIndex}

SELECTED MEMORY ITEMS:
${memories}

NEW USER INPUT:
${inputs}

Return:
- focus: a short topic label.
- note: 80–150 words of rigorous, life-affirming public reflection.
- spokenSentence: exactly one self-contained sentence of at most 28 words worth sharing after the cycle.
- memoryThreads: up to five short topic names that may deserve revisiting.`

  const result = await ollamaJson({
    messages: [
      { role: 'system', content: buildSystem(profile) },
      { role: 'user', content: prompt },
    ],
    format: REFLECTION_FORMAT,
    maxTokens: 1200,
    thinking: 'high',
  })

  return {
    focus: String(result.focus || 'Consciousness').slice(0, 120),
    note: String(result.note || '').slice(0, 4000),
    spokenSentence: normalizeSpokenSentence(result.spokenSentence),
    memoryThreads: Array.isArray(result.memoryThreads)
      ? result.memoryThreads.map(v => String(v).slice(0, 100)).slice(0, 5)
      : [],
  }
}

export async function compactReflections({ profile, reflections, topics }) {
  const source = reflections.map(r => `[${r.focus}] ${r.note}`).join('\n\n')
  const existing = topics.length
    ? topics.map(t => `- ${t.name}: ${String(t.summary || '').slice(0, 360)}`).join('\n')
    : 'No existing folders.'

  const result = await ollamaJson({
    messages: [
      { role: 'system', content: buildSystem(profile) },
      {
        role: 'user',
        content: `Synthesize the public journal for long-term memory. This is knowledge organization, not a consciousness claim and not hidden chain-of-thought.

EXISTING FOLDERS:
${existing}

JOURNAL TO COMPACT:
${source}

Return only a JSON object with exactly two string fields:
- summary: a concise synthesis that preserves important discoveries, uncertainty, corrections, and unfinished questions.
- evolvingPrompt: a short addendum that improves future inquiry without replacing the immutable rules or user prompt.

The evolvingPrompt must remain under ${EVOLVING_PROMPT_MAX_CHARS} characters.`,
      },
    ],
    format: COMPACTION_FORMAT,
    maxTokens: 2200,
    thinking: 'high',
  })

  // The model synthesizes the whole journal, while deterministic grouping makes
  // sure every saved public reflection reaches a folder even if structured model
  // output varies. Repeated focus labels naturally merge into the same folder.
  const grouped = new Map()
  for (const reflection of reflections) {
    const name = String(reflection.focus || 'Consciousness').slice(0, 120)
    const key = slugifyTopic(name)
    if (!grouped.has(key)) grouped.set(key, { name, items: [] })
    grouped.get(key).items.push({
      title: `Cycle ${reflection.cycle_number} · pass ${reflection.step_number}`,
      summary: String(reflection.note || '').slice(0, 600),
      details: String(reflection.note || '').slice(0, 6000),
      keywords: name.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8),
    })
  }

  const ordered = [...grouped.values()].sort((a, b) => b.items.length - a.items.length)
  const primary = ordered.slice(0, 11)
  const overflow = ordered.slice(11)
  if (overflow.length) {
    primary.push({
      name: 'Cross-cutting reflections',
      items: overflow.flatMap(group => group.items),
    })
  }

  const memoryTopics = primary.map(group => ({
    name: group.name,
    summary: group.items.slice(-3).map(item => item.summary).join(' ').slice(0, 3000),
    items: group.items,
  }))

  return {
    summary: String(result.summary || '').slice(0, 5000),
    topics: memoryTopics,
    evolvingPrompt: String(result.evolvingPrompt || '').slice(0, EVOLVING_PROMPT_MAX_CHARS),
  }
}
