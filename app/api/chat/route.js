export const runtime = 'edge'

import { systemPrompt, memoryPrompt, realModelId } from '../../models'

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function callOllama(url, body) {
  let lastResponse = null

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25000),
      })

      // Retry on any server error (5xx) or Vercel edge errors (530)
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
      // Network error, timeout, etc. — retry
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
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'

  // Build the messages array with short system prompt plus quiet background memory
  const selectedModel = model || 'deepseek-v4-flash:cloud'
  const actualModel = realModelId(selectedModel)
  const sys = systemPrompt(selectedModel)
  const mem = memoryPrompt(selectedModel)
  const systemParts = [sys, mem].filter(Boolean)
  const outgoing = systemParts.length
    ? [{ role: 'system', content: systemParts.join('\n\n') }, ...messages]
    : messages

  const response = await callOllama(`${ollamaUrl}/v1/chat/completions`, {
    model: actualModel,
    messages: outgoing,
    stream: true,
  })

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