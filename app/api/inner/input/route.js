import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getCurrentUser, rateLimit, sameOrigin } from '../../../../lib/auth'
import { db, ensureSchema } from '../../../../lib/db'

export async function POST(request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  const allowed = await rateLimit('inner-input', user.id, 60, 60 * 60 * 1000)
  if (!allowed) return NextResponse.json({ error: 'Too many inputs. Try again later.' }, { status: 429 })

  let body = {}
  try { body = await request.json() } catch {}
  const content = String(body.content || '').trim()
  if (!content || content.length > 2000) {
    return NextResponse.json({ error: 'Input must be between 1 and 2,000 characters.' }, { status: 400 })
  }

  await ensureSchema()
  const sql = db()
  const rows = await sql`
    INSERT INTO inner_inputs (id, user_id, content)
    VALUES (${randomUUID()}, ${user.id}, ${content})
    RETURNING id, content, created_at, consumed_at
  `
  return NextResponse.json({ input: rows[0] })
}
