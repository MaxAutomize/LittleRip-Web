import { NextResponse } from 'next/server'
import Stripe from 'stripe'

// Two options for LittleRip, both custom-amount:
// - onetime : a single custom payment
// - monthly : a custom recurring subscription billed every month
// The customer chooses the amount on the page; the API receives it in dollars.

const MIN_CENTS = 100      // $1.00 minimum
const MAX_CENTS = 1000000_00 // $1,000,000.00 maximum

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key, { apiVersion: '2024-06-20' })
}

function parseAmount(dollars) {
  const n = Number(dollars)
  if (!Number.isFinite(n) || n <= 0) return null
  const cents = Math.round(n * 100)
  if (cents < MIN_CENTS || cents > MAX_CENTS) return null
  return cents
}

export async function POST(request) {
  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json(
      { error: 'Stripe is not configured. Set STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.' },
      { status: 503 }
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const option = body?.option === 'monthly' ? 'monthly' : 'onetime'
  const isSubscription = option === 'monthly'

  const cents = parseAmount(body?.amount)
  if (cents == null) {
    return NextResponse.json(
      { error: 'Please enter a valid amount between $1.00 and $1,000,000.00.' },
      { status: 400 }
    )
  }

  const origin = request.headers.get('origin') || 'https://littlerip.vercel.app'

  const lineItem = {
    quantity: 1,
    price_data: {
      currency: 'usd',
      unit_amount: cents,
      product_data: {
        name: isSubscription ? 'LittleRip Monthly' : 'LittleRip One-Time',
        description: isSubscription
          ? `Recurring $${(cents / 100).toFixed(2)} billed monthly`
          : `One-time payment of $${(cents / 100).toFixed(2)}`,
      },
    },
  }

  if (isSubscription) {
    lineItem.price_data.recurring = { interval: 'month' }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: isSubscription ? 'subscription' : 'payment',
      payment_method_types: ['card'],
      line_items: [lineItem],
      success_url: `${origin}/payment?status=success&option=${option}`,
      cancel_url: `${origin}/payment?status=cancel`,
      metadata: { option, amount_cents: String(cents) },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}