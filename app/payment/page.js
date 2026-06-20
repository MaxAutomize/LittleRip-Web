'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const OPTIONS = [
  {
    key: 'onetime',
    name: 'One-Time',
    price: '$1,000',
    sub: 'Single payment',
    blurb: 'Pay once. No recurring charges.',
  },
  {
    key: 'monthly',
    name: 'Monthly',
    price: '$1,000',
    sub: '/ month',
    blurb: 'Recurring subscription billed every month. Cancel anytime.',
  },
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

  async function pay(optionKey) {
    setError(null)
    setLoading(optionKey)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ option: optionKey }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error || 'Could not start checkout.')
        setLoading(null)
        return
      }
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
        Choose how you&apos;d like to pay
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

      <div className="pay-grid pay-grid-two">
        {OPTIONS.map((o) => (
          <div className="pay-card" key={o.key}>
            <div className="pay-card-name">{o.name}</div>
            <div className="pay-card-price">
              {o.price}
              <span className="pay-card-sub">{o.sub}</span>
            </div>
            <div className="pay-card-blurb">{o.blurb}</div>
            <button
              className="pay-btn"
              onClick={() => pay(o.key)}
              disabled={loading !== null}
            >
              {loading === o.key ? 'Redirecting…' : 'Pay with Stripe'}
            </button>
          </div>
        ))}
      </div>
    </main>
  )
}