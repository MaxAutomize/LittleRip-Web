'use client'

import { useState, useRef, useEffect } from 'react'
import { clean } from '../models'

export default function ChatPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)

  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || streaming) return

    const userMsg = { role: 'user', content: text }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setStreaming(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated }),
      })

      if (!res.ok) {
        const err = await res.text()
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err}` }])
        setStreaming(false)
        return
      }

      const assistantMsg = { role: 'assistant', content: '' }
      setMessages((prev) => [...prev, assistantMsg])

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content
            if (delta) {
              assistantMsg.content += delta
              setMessages((prev) => {
                const next = [...prev]
                next[next.length - 1] = { ...assistantMsg }
                return next
              })
            }
          } catch {}
        }
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Connection error: ${err.message}` }])
    }

    setStreaming(false)
    inputRef.current?.focus()
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="chat-shell">
      <header className="chat-header">
        <div className="header-left">
          <a href="/" className="back-link">← LittleRip</a>
        </div>
        <div className="header-right">
          {messages.length > 0 && (
            <button className="clear-btn" onClick={() => setMessages([])}>Clear</button>
          )}
        </div>
      </header>

      <div className="chat-body">
        {messages.length === 0 && (
          <div className="empty-state" />
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            <div className="msg-role">{m.role === 'user' ? 'You' : 'Char'}</div>
            <div className="msg-content">
              {m.role === 'assistant' ? clean(m.content) : m.content}
              {streaming && i === messages.length - 1 && m.role === 'assistant' && (
                <span className="cursor">▌</span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-bar">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Message Char…"
          rows={1}
        />
        <button
          className="send-btn"
          onClick={send}
          disabled={!input.trim() || streaming}
        >
          {streaming ? '…' : '→'}
        </button>
      </div>
    </div>
  )
}