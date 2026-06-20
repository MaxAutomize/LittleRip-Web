'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

const WORD = 'LittleRip'

export default function Home() {
  const containerRef = useRef(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDims({ w: rect.width, h: rect.height })
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Arc geometry: fit a rainbow arc into the viewport
  // Available width = dims.w minus padding; we use ~80% of viewport height for the arc
  const padding = 40
  const availableWidth = Math.max(dims.w - padding * 2, 100)
  const availableHeight = Math.max(dims.h * 0.55, 100)

  // For a chord of width W and max height H, radius R = (W²)/(8H) + H/2
  // We clamp H so the arc isn't too flat or too tall
  const arcHeight = Math.min(availableHeight, availableWidth * 0.35)
  const radius = (availableWidth * availableWidth) / (8 * arcHeight) + arcHeight / 2

  // Font size: scale letters to fill the chord width
  // We want letters to be comfortably sized — about 7-10% of available width
  const fontSize = Math.min(Math.max(availableWidth / 10, 28), 120)

  // The arc center is at (availableWidth/2, radius - arcHeight) from the top of the arc
  // Angle subtended by the chord: sin(halfAngle) = (W/2) / R
  const halfAngle = Math.asin(Math.min(availableWidth / (2 * radius), 1))
  const totalAngle = halfAngle * 2

  const letters = WORD.split('')

  // Calculate position for each letter along the arc
  // Letter i goes from angle: startAngle + i * stepAngle
  // Angles measured from top of circle (12 o'clock = 0)
  const startAngle = -halfAngle // leftmost letter
  const stepAngle = letters.length > 1 ? totalAngle / (letters.length - 1) : 0

  const letterData = letters.map((char, i) => {
    const angle = startAngle + i * stepAngle
    // Position on circle (center at 0,0, radius R)
    // Arc goes upward like a rainbow, so x = R*sin(angle), y = -R*(1-cos(angle))
    const x = radius * Math.sin(angle)
    const y = -radius * (1 - Math.cos(angle)) // negative = upward
    const rotation = angle * (180 / Math.PI) // degrees
    return { char, x, y, rotation }
  })

  return (
    <main className="menu-shell" ref={containerRef}>
      <nav className="menu-options">
        <Link href="/chat" className="menu-card">Chat</Link>
        <Link href="/call" className="menu-card">Call</Link>
        <Link href="/assistant" className="menu-card">Assistant</Link>
        <Link href="/payment" className="menu-card">Payment</Link>
      </nav>
    </main>
  )
}