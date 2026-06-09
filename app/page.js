'use client'

import Link from 'next/link'

export default function Home() {
  return (
    <main className="menu-shell">
      <div className="menu-title-wrap" aria-label="LittleRip">
        <svg className="menu-title-svg" viewBox="0 0 1200 260" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <path id="little-rip-title-arc" d="M 20 230 C 210 16, 990 16, 1180 230" />
          </defs>
          <text className="menu-title-svg-text">
            <textPath href="#little-rip-title-arc" startOffset="50%" textAnchor="middle">
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
