export const runtime = 'edge'

// Static character model IDs. Do not fetch Ollama here.
// This keeps the picker fast and prevents intermittent tunnel/1033 errors.
const ALL_MODELS = [
  'glm-5.1:cloud',
  'glm-5.1:cloud--charles',
  'glm-5.1:cloud--isa',
  'glm-5.1:cloud--benjamin',
  'deepseek-v4-pro:cloud',
  'gemma4:31b-cloud',
  'minimax-m3:cloud',
  'nemotron-3-ultra:cloud',
  'kimi-k2.6:cloud',
]

export async function GET() {
  const models = ALL_MODELS.map(id => ({ id, owned_by: 'cloud' }))

  return new Response(JSON.stringify({ models }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
}
