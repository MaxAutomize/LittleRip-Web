import { NextResponse } from 'next/server'
import { getCurrentUser, sameOrigin } from '../../../../lib/auth'
import { db, ensureSchema } from '../../../../lib/db'
import { SYSTEM_PROMPT_MAX_CHARS } from '../../../../lib/inner-config'

export async function PATCH(request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

  let body = {}
  try { body = await request.json() } catch {}
  const systemPrompt = String(body.systemPrompt || '').trim()
  if (systemPrompt.length < 100 || systemPrompt.length > SYSTEM_PROMPT_MAX_CHARS) {
    return NextResponse.json({
      error: `The prompt must be between 100 and ${SYSTEM_PROMPT_MAX_CHARS.toLocaleString()} characters.`,
    }, { status: 400 })
  }

  await ensureSchema()
  const sql = db()
  const rows = await sql`
    UPDATE inner_profiles
    SET system_prompt = ${systemPrompt}, updated_at = now()
    WHERE user_id = ${user.id}
    RETURNING system_prompt, evolving_prompt, prompt_revision_count, updated_at
  `
  return NextResponse.json({ profile: rows[0] })
}
