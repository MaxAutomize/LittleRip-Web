import { NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    return NextResponse.json({ user })
  } catch (error) {
    console.error('Inner Monologue session lookup failed:', error)
    return NextResponse.json({ error: 'Account storage is unavailable.' }, { status: 503 })
  }
}
