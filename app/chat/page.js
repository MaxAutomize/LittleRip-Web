'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { displayName, clean } from '../models'

export default function ChatPage() {
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState('')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [ollamaStatus, setOllamaStatus] = useState('checking')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch('/api/models')
      const data = await res.json()
      if (data.models?.length) {
        setModels(data.models)
        setOllamaStatus('online')
        if (!selectedModel) setSelectedModel(data.models[0].id)
      } else {
        setOllamaStatus('offline')
      }
    } catch {
      setOllamaStatus('offline')
    }
  }, [selectedModel])

  useEffect(() => { fetchModels() }, [])
  useEffect(() => {
    const interval = setInterval(fetchModels, 15000)
    return () => clearInterval(interval)
  }, [fetchModels])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
        body: JSON.stringify({ messages: updated, model: selectedModel }),
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
          <h1>Chat</h1>
        </div>
        <div className="header-right">
          <div className={`status-dot ${ollamaStatus}`} />

          {/* Custom dropdown */}
          <div className="dropdown" ref={dropdownRef}>
            <button
              className="dropdown-trigger"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              disabled={ollamaStatus !== 'online'}
            >
              {selectedModel ? displayName(selectedModel) : 'Select model'}
              <span className="dropdown-arrow">▾</span>
            </button>
            {dropdownOpen && (
              <ul className="dropdown-list">
                {models.map((m) => (
                  <li
                    key={m.id}
                    className={`dropdown-item ${m.id === selectedModel ? 'active' : ''}`}
                    onClick={() => { setSelectedModel(m.id); setDropdownOpen(false); }}
                  >
                    {displayName(m.id)}
                  </li>
                ))}
              </ul>
            )}
          </div>

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
            <div className="msg-role">{m.role === 'user' ? 'You' : displayName(selectedModel)}</div>
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
          placeholder={ollamaStatus === 'online' ? `Message ${displayName(selectedModel)}…` : 'Waiting for Ollama…'}
          disabled={streaming || ollamaStatus !== 'online'}
          rows={1}
        />
        <button
          className="send-btn"
          onClick={send}
          disabled={!input.trim() || streaming || ollamaStatus !== 'online'}
        >
          {streaming ? '…' : '→'}
        </button>
      </div>
    </div>
  )
}