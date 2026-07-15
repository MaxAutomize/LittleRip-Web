export const runtime = 'edge'

import { CHAR_SYSTEM_PROMPT, getModelId } from '../../models'

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function callOllama(url, body, apiKey) {
  let lastResponse = null

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25000),
      })

      if (response.status >= 500) {
        lastResponse = response
        if (attempt < 2) {
          await wait(1000 + attempt * 500)
          continue
        }
        return response
      }

      return response
    } catch (err) {
      lastResponse = null
      if (attempt < 2) {
        await wait(1000 + attempt * 500)
        continue
      }
      return new Response(JSON.stringify({ error: err.message || 'Connection failed' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  return lastResponse
}

export async function POST(req) {
  const { messages, model } = await req.json()
  const baseUrl = (process.env.OLLAMA_BASE_URL || 'https://ollama.com').replace(/\/$/, '')
  const apiKey = process.env.OLLAMA_API_KEY?.trim()
  const selectedModel = model || process.env.OLLAMA_MODEL || getModelId()

  // Vercel cannot reach a model running on a developer laptop. The production
  // default is Ollama Cloud, matching the iOS app's https://ollama.com setup.
  if (baseUrl === 'https://ollama.com' && !apiKey) {
    return new Response(JSON.stringify({
      error: 'Ollama Cloud is not configured. Add OLLAMA_API_KEY in Vercel project settings.',
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Preserve a deliberate system prompt from other routes, but normal chat gets
  // the Char persona server-side so it cannot be changed by the browser.
  const outgoing = messages?.[0]?.role === 'system'
    ? messages
    : [{ role: 'system', content: CHAR_SYSTEM_PROMPT }, ...(messages || [])]

  const response = await callOllama(`${baseUrl}/v1/chat/completions`, {
    model: selectedModel,
    messages: outgoing,
    stream: true,
  }, apiKey)

  if (!response.ok) {
    const text = await response.text()
    return new Response(JSON.stringify({ error: text || `Ollama returned ${response.status}` }), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      'Connection': 'keep-alive',
    },
  })
}
