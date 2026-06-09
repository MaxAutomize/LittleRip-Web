'use client'

import Link from 'next/link'

export default function Home() {
  return (
    <main className="menu-shell">
      <div className="menu-title-wrap" aria-label="LittleRip">
        <svg className="menu-title-svg" viewBox="0 0 1400 220" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <defs>
            <path id="little-rip-arc" d="M 20 210 C 200 2, 1200 2, 1380 210" />
          </defs>
          <text className="svg-title-text">
            <textPath href="#little-rip-arc" startOffset="50%" textAnchor="middle">
              LittleRip
            </textPath>
          </text>
        </svg>
      </div>

      <nav className="menu-options">
        <Link href="/chat" className="menu-card">Chat</Link>
        <Link href="/call" className="menu-card">Call</Link>
        <Link href="/assistant" className="menu-card">Assistant</Link>
      </nav>
    </main>
  )
}