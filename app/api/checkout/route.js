import { NextResponse } from 'next/server'
import Stripe from 'stripe'

// Plan tiers for LittleRip. Amounts are in USD cents.
// Change these to match the products/prices you set up in your Stripe dashboard.
const PLANS = {
  tip:    { name: 'LittleRip Tip',        amount: 500,  description: 'A small thank-you tip' },
  basic:  { name: 'LittleRip Basic',     amount: 1000, description: 'Basic access plan' },
  pro:    { name: 'LittleRip Pro',       amount: 2500, description: 'Pro access plan' },
  founder:{ name: 'LittleRip Founder',   amount: 10000, description: 'Founder / lifetime tier' },
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  // 2024-06-20 stable API version; adjust if your account uses a different one
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

  const planKey = body?.plan && PLANS[body.plan] ? body.plan : 'tip'
  const plan = PLANS[planKey]

  const origin = request.headers.get('origin') || 'https://littlerip.vercel.app'

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: plan.amount,
            product_data: {
              name: plan.name,
              description: plan.description,
            },
          },
        },
      ],
      success_url: `${origin}/payment?status=success&plan=${planKey}`,
      cancel_url: `${origin}/payment?status=cancel`,
      metadata: { plan: planKey },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}