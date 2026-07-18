import { NextResponse } from 'next/server'
import {
  authenticateUser,
  createSession,
  normalizeEmail,
  rateLimit,
  requestFingerprint,
  sameOrigin,
} from '../../../../lib/auth'

export async function POST(request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  let body = {}
  try { body = await request.json() } catch {}
  const email = normalizeEmail(body.email)
  const fingerprint = requestFingerprint(request, email)
  const allowed = await rateLimit('login', fingerprint, 20, 15 * 60 * 1000)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many login attempts. Try again later.' }, { status: 429 })
  }

  const user = await authenticateUser(email, body.password || '')
  if (!user) {
    return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 })
  }

  await createSession(user.id)
  return NextResponse.json({ user })
}
