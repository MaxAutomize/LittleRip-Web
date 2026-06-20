'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const OPTIONS = [
  {
    key: 'onetime',
    name: 'One-Time',
    sub: 'Single payment',
    blurb: 'Pay a custom amount once. No recurring charges.',
    placeholder: 'e.g. 100',
  },
  {
    key: 'monthly',
    name: 'Monthly',
    sub: '/ month',
    blurb: 'Custom recurring subscription billed every month. Cancel anytime.',
    placeholder: 'e.g. 25',
  },
]

function validAmount(v) {
  const n = Number(v)
  return Number.isFinite(n) && n >= 1 && n <= 1000000
}

export default function PaymentPage() {
  const [loading, setLoading] = useState(null)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [amounts, setAmounts] = useState({ onetime: '', monthly: '' })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const s = params.get('status')
    if (s === 'success' || s === 'cancel') setStatus(s)
  }, [])

  async function pay(optionKey) {
    setError(null)
    const raw = amounts[optionKey]
    if (!validAmount(raw)) {
      setError('Please enter a valid amount between $1.00 and $1,000,000.00.')
      return
    }
    setLoading(optionKey)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ option: optionKey, amount: raw }),
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
        Choose an option and enter the amount
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
            <div className="pay-card-sub-inline">{o.sub}</div>
            <div className="pay-card-blurb">{o.blurb}</div>

            <div className="pay-amount-wrap">
              <span className="pay-amount-sign">$</span>
              <input
                className="pay-amount-input"
                type="number"
                inputMode="decimal"
                min="1"
                step="0.01"
                placeholder={o.placeholder}
                value={amounts[o.key]}
                onChange={(e) =>
                  setAmounts((a) => ({ ...a, [o.key]: e.target.value }))
                }
                disabled={loading !== null}
              />
            </div>

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