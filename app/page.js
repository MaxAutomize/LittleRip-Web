'use client'

import Link from 'next/link'

export default function Home() {
  return (
    <main className="menu-shell">
      <div className="menu-title-wrap" aria-label="LittleRip">
        <svg className="menu-title-svg" viewBox="0 0 1400 280" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <defs>
            <path id="little-rip-arc" d="M 30 260 C 260 30, 1140 30, 1370 260" />
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