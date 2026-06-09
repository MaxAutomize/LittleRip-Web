'use client'

import Link from 'next/link'

export default function Home() {
  return (
    <main className="menu-shell">
      <h1 className="menu-title" aria-label="LittleRip">
        {'LittleRip'.split('').map((letter, i) => {
          const center = 4
          const y = -58 + Math.abs(i - center) * 13
          const rotate = (i - center) * 4.5
          return <span key={i} style={{ '--y': `${y}px`, '--r': `${rotate}deg` }}>{letter}</span>
        })}
      </h1>

      <nav className="menu-options">
        <Link href="/chat" className="menu-card">
          <span className="menu-icon">💬</span>
          <span className="menu-label">Chat</span>
        </Link>

        <Link href="/call" className="menu-card call-card">
          <span className="menu-icon">📞</span>
          <span className="menu-label">Call</span>
        </Link>

        <Link href="/assistant" className="menu-card assistant-card">
          <span className="menu-icon">🛠</span>
          <span className="menu-label">Assistant</span>
        </Link>
      </nav>
    </main>
  )
}