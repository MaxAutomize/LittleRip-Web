'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const PLANS = [
  { key: 'tip',     name: 'Tip',        price: '$5',    blurb: 'A small thank-you' },
  { key: 'basic',   name: 'Basic',      price: '$10',   blurb: 'Basic access plan' },
  { key: 'pro',     name: 'Pro',        price: '$25',   blurb: 'Pro access plan' },
  { key: 'founder', name: 'Founder',    price: '$100',  blurb: 'Lifetime founder tier' },
]

export default function PaymentPage() {
  const [loading, setLoading] = useState(null)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const s = params.get('status')
    if (s === 'success' || s === 'cancel') setStatus(s)
  }, [])

  async function pay(planKey) {
    setError(null)
    setLoading(planKey)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error || 'Could not start checkout.')
        setLoading(null)
        return
      }
      // Redirect to Stripe-hosted Checkout
      window.location.href = data.url
    } catch (e) {
      setError(e.message)
      setLoading(null)
    }
  }

  return (
    <main className="menu-shell" style={{ paddingTop: '8vh' }}>
      <Link href="/" className="menu-card" style={{ position: 'absolute', top: 24, left: 24 }}>
        ← Back
      </Link>

      <h1 className="menu-title" style={{ fontSize: 'clamp(3rem, 9vw, 7rem)', marginBottom: 12 }}>
        Payment
      </h1>
      <p className="menu-sub" style={{ marginBottom: 40 }}>
        Support LittleRip — choose a tier
      </p>

      {status === 'success' && (
        <div className="pay-banner pay-banner-ok">
          ✓ Thank you! Your payment was successful.
        </div>
      )}
      {status === 'cancel' && (
        <div className="pay-banner pay-banner-err">
          Payment was cancelled. No charge was made.
        </div>
      )}
      {error && (
        <div className="pay-banner pay-banner-err">{error}</div>
      )}

      <div className="pay-grid">
        {PLANS.map((p) => (
          <div className="pay-card" key={p.key}>
            <div className="pay-card-name">{p.name}</div>
            <div className="pay-card-price">{p.price}</div>
            <div className="pay-card-blurb">{p.blurb}</div>
            <button
              className="pay-btn"
              onClick={() => pay(p.key)}
              disabled={loading !== null}
            >
              {loading === p.key ? 'Redirecting…' : `Pay ${p.price}`}
            </button>
          </div>
        ))}
      </div>
    </main>
  )
}