'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

function validAmount(v) {
  const n = Number(v)
  return Number.isFinite(n) && n >= 1 && n <= 1000000
}

export default function PaymentPage() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [amount, setAmount] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const s = params.get('status')
    if (s === 'success' || s === 'cancel') setStatus(s)
  }, [])

  async function pay() {
    setError(null)
    if (!validAmount(amount)) {
      setError('Please enter a valid amount between $1.00 and $1,000,000.00.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error || 'Could not start checkout.')
        setLoading(false)
        return
      }
      window.location.href = data.url
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <main className="menu-shell" style={{ paddingTop: '8vh' }}>
      <Link href="/" className="menu-card" style={{ position: 'absolute', top: 24, left: 24 }}>
        ← Back
      </Link>

      <h1 className="menu-title" style={{ fontSize: 'clamp(3rem, 9vw, 7rem)', marginBottom: 40 }}>
        Payment
      </h1>

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

      <div className="pay-single">
        <div className="pay-amount-wrap pay-amount-wrap-big">
          <span className="pay-amount-sign">$</span>
          <input
            className="pay-amount-input pay-amount-input-big"
            type="number"
            inputMode="decimal"
            min="1"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={loading}
          />
        </div>

        <button
          className="pay-btn pay-btn-big"
          onClick={pay}
          disabled={loading}
        >
          {loading ? 'Redirecting…' : 'Pay LittleRip'}
        </button>
      </div>
    </main>
  )
}