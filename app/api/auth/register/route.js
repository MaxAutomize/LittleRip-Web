import { NextResponse } from 'next/server'
import {
  createSession,
  createUser,
  normalizeEmail,
  rateLimit,
  requestFingerprint,
  sameOrigin,
  validEmail,
  validPassword,
} from '../../../../lib/auth'

export async function POST(request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const allowed = await rateLimit('register', requestFingerprint(request), 3, 60 * 60 * 1000)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many account attempts. Try again later.' }, { status: 429 })
  }

  let body = {}
  try { body = await request.json() } catch {}
  const email = normalizeEmail(body.email)
  const password = body.password

  if (!validEmail(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }
  if (!validPassword(password)) {
    return NextResponse.json({ error: 'Use a password between 10 and 200 characters.' }, { status: 400 })
  }

  try {
    const user = await createUser(email, password)
    await createSession(user.id)
    return NextResponse.json({ user: { id: user.id, email: user.email } })
  } catch (error) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 })
    }
    console.error('Inner Monologue registration failed:', error)
    return NextResponse.json({ error: 'Could not create the account.' }, { status: 500 })
  }
}
