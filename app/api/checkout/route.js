import { NextResponse } from 'next/server'
import Stripe from 'stripe'

// Two options for LittleRip.
// - onetime : a single $1,000 payment
// - monthly : a $1,000/month recurring subscription
// Amounts are in USD cents.
const OPTIONS = {
  onetime: {
    name: 'LittleRip One-Time',
    amount: 100000, // $1,000.00
    description: 'A one-time payment',
    mode: 'payment',
  },
  monthly: {
    name: 'LittleRip Monthly',
    amount: 100000, // $1,000.00
    description: 'Recurring subscription — billed monthly',
    mode: 'subscription',
  },
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key, { apiVersion: '2024-06-20' })
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

  const key = body?.option && OPTIONS[body.option] ? body.option : 'onetime'
  const opt = OPTIONS[key]

  const origin = request.headers.get('origin') || 'https://littlerip.vercel.app'

  const lineItem = {
    quantity: 1,
    price_data: {
      currency: 'usd',
      unit_amount: opt.amount,
      product_data: {
        name: opt.name,
        description: opt.description,
      },
    },
  }

  // For subscriptions, add the recurring interval.
  if (opt.mode === 'subscription') {
    lineItem.price_data.recurring = { interval: 'month' }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: opt.mode,
      payment_method_types: ['card'],
      line_items: [lineItem],
      success_url: `${origin}/payment?status=success&option=${key}`,
      cancel_url: `${origin}/payment?status=cancel`,
      metadata: { option: key },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}