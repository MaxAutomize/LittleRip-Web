import { NextResponse } from 'next/server'
import { clearSession, sameOrigin } from '../../../../lib/auth'

export async function POST(request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }
  await clearSession()
  return NextResponse.json({ ok: true })
}
