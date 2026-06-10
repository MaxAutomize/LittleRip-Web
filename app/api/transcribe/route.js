export const runtime = 'edge'

export async function POST(req) {
  const formData = await req.formData()
  const audioFile = formData.get('file')

  if (!audioFile) {
    return new Response(JSON.stringify({ error: 'No audio file provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const groqApiKey = process.env.GROQ_API_KEY
  if (!groqApiKey) {
    return new Response(JSON.stringify({ error: 'Groq API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const groqForm = new FormData()
    groqForm.append('file', audioFile)
    groqForm.append('model', 'whisper-large-v3-turbo')
    groqForm.append('response_format', 'json')
    groqForm.append('language', 'en')

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: groqForm,
    })

    if (!response.ok) {
      const err = await response.text()
      return new Response(JSON.stringify({ error: err }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const result = await response.json()
    return new Response(JSON.stringify({ text: result.text || '' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}