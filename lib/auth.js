import { cookies } from 'next/headers'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { compare, hash } from 'bcryptjs'
import { db, ensureSchema } from './db'
import { DEFAULT_INNER_PROMPT, SESSION_DAYS } from './inner-config'

const COOKIE_NAME = 'littlerip_inner_session'

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

export function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254
}

export function validPassword(value) {
  return typeof value === 'string' && value.length >= 10 && value.length <= 200
}

export async function createUser(email, password) {
  await ensureSchema()
  const sql = db()
  const id = randomUUID()
  const passwordHash = await hash(password, 12)

  await sql`
    INSERT INTO inner_users (id, email, password_hash)
    VALUES (${id}, ${email}, ${passwordHash})
  `
  await sql`
    INSERT INTO inner_profiles (user_id, system_prompt)
    VALUES (${id}, ${DEFAULT_INNER_PROMPT})
  `

  return { id, email }
}

export async function authenticateUser(email, password) {
  await ensureSchema()
  const sql = db()
  const rows = await sql`
    SELECT id, email, password_hash
    FROM inner_users
    WHERE email = ${email}
    LIMIT 1
  `
  const user = rows[0]
  if (!user || !(await compare(password, user.password_hash))) return null
  return { id: user.id, email: user.email }
}

export async function createSession(userId) {
  await ensureSchema()
  const sql = db()
  const token = randomBytes(32).toString('base64url')
  const tokenHash = sha256(token)
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  await sql`
    INSERT INTO inner_sessions (token_hash, user_id, expires_at)
    VALUES (${tokenHash}, ${userId}, ${expiresAt.toISOString()})
  `

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null

  await ensureSchema()
  const sql = db()
  const tokenHash = sha256(token)
  const rows = await sql`
    SELECT u.id, u.email
    FROM inner_sessions s
    JOIN inner_users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash}
      AND s.expires_at > now()
    LIMIT 1
  `
  if (!rows[0]) return null

  await sql`
    UPDATE inner_sessions
    SET last_seen_at = now()
    WHERE token_hash = ${tokenHash}
  `
  return rows[0]
}

export async function clearSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (token && process.env.DATABASE_URL) {
    await ensureSchema()
    const sql = db()
    await sql`DELETE FROM inner_sessions WHERE token_hash = ${sha256(token)}`
  }
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
  })
}

export function requestFingerprint(request, extra = '') {
  const forwarded = request.headers.get('x-forwarded-for') || ''
  const ip = forwarded.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown'
  return sha256(`${ip}:${extra}`)
}

export async function rateLimit(namespace, fingerprint, maximum, windowMs) {
  await ensureSchema()
  const sql = db()
  const bucket = Math.floor(Date.now() / windowMs)
  const key = `${namespace}:${fingerprint}:${bucket}`
  const expiresAt = new Date((bucket + 1) * windowMs + windowMs)
  const rows = await sql`
    INSERT INTO inner_rate_limits (bucket_key, request_count, expires_at)
    VALUES (${key}, 1, ${expiresAt.toISOString()})
    ON CONFLICT (bucket_key)
    DO UPDATE SET request_count = inner_rate_limits.request_count + 1
    RETURNING request_count
  `

  if (Math.random() < 0.02) {
    await sql`DELETE FROM inner_rate_limits WHERE expires_at < now()`
  }

  return Number(rows[0]?.request_count || 1) <= maximum
}

export function sameOrigin(request) {
  const origin = request.headers.get('origin')
  if (!origin) return true
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  if (!host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}
