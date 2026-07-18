import Link from 'next/link'

export default function Home() {
  return (
    <main className="menu-shell">
      <nav className="menu-options">
        <Link href="/chat" className="menu-card">Chat</Link>
        <Link href="/call" className="menu-card">Call</Link>
        <Link href="/assistant" className="menu-card">Assistant</Link>
        <Link href="/payment" className="menu-card">Payment</Link>
      </nav>
    </main>
  )
}