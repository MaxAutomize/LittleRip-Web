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
        <Link href="/chat" className="menu-card">Chat</Link>
        <Link href="/call" className="menu-card">Call</Link>
        <Link href="/assistant" className="menu-card">Assistant</Link>
      </nav>
    </main>
  )
}
