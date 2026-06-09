'use client'

import Link from 'next/link'

export default function Home() {
  return (
    <main className="menu-shell">
      <h1 className="menu-title">LittleRip</h1>

      <nav className="menu-options">
        <Link href="/chat" className="menu-card">Chat</Link>
        <Link href="/call" className="menu-card">Call</Link>
        <Link href="/assistant" className="menu-card">Assistant</Link>
      </nav>
    </main>
  )
}