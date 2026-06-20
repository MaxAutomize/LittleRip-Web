'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { clean } from '../models'

const ASSISTANT_PROMPT = `You are LittleRip, an assistant. The user's speech is being transcribed live — you are passively aware of their environment and anything said aloud. Only respond when the user sends you a typed message. When they do, use the context of what you've overheard to inform your response. Keep responses concise and helpful.`

export default function AssistantPage() {
  const [messages, setMessages] = useState([])
  const [transcript, setTranscript] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [listening, setListening] = useState(false)

  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const recognitionRef = useRef(null)
  const listeningRef = useRef(false)
  const transcriptRef = useRef([])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, transcript])

  /* ── TTS ── */

  const speak = useCallback((text) => {
    const utt = new SpeechSynthesisUtterance(clean(text))
    utt.rate = 1.1
    const voices = speechSynthesis.getVoices()
    const voice = voices.find(v => v.name === 'Google US English')
      || voices.find(v => v.name === 'Samantha')
      || voices.find(v => v.lang === 'en-US')
      || voices.find(v => v.lang.startsWith('en'))
      || voices[0]
    if (voice) utt.voice = voice
    speechSynthesis.speak(utt)
  }, [])

  /* ── Native SpeechRecognition (passive hearing) ── */
  // Uses the browser's built-in Web Speech API instead of Groq Whisper.
  // Continuously transcribes anything said aloud into the passive hearing log.

  const startRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.error('SpeechRecognition not supported in this browser')
      setListening(false)
      return
    }

    // Tear down any existing instance first
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null
      recognitionRef.current.onerror = null
      recognitionRef.current.onend = null
      try { recognitionRef.current.abort() } catch {}
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          const text = result[0].transcript.trim()
          if (text) {
            transcriptRef.current = [...transcriptRef.current, { text, time: Date.now() }]
            setTranscript([...transcriptRef.current])
          }
        }
      }
    }

    recognition.onerror = (e) => {
      console.warn('SpeechRecognition error:', e.error)
      // Auto-restart as long as listening is still on (handles transient errors)
      if (listeningRef.current && e.error !== 'not-allowed' && e.error !== 'service-not-allowed') {
        setTimeout(() => {
          if (listeningRef.current) startRecognition()
        }, 400)
      }
    }

    recognition.onend = () => {
      // Some browsers stop recognition after a silence — restart it
      if (listeningRef.current) {
        setTimeout(() => {
          if (listeningRef.current) startRecognition()
        }, 300)
      }
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch (err) {
      console.error('SpeechRecognition start failed:', err)
    }
  }, [])

  function stopRecognition() {
    listeningRef.current = false
    setListening(false)
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null
      recognitionRef.current.onerror = null
      recognitionRef.current.onend = null
      try { recognitionRef.current.abort() } catch {}
      recognitionRef.current = null
    }
  }

  function toggleListening() {
    if (listening) {
      stopRecognition()
    } else {
      // Warm up TTS voices
      const warmup = new SpeechSynthesisUtterance('')
      warmup.volume = 0
      speechSynthesis.speak(warmup)
      speechSynthesis.getVoices()

      listeningRef.current = true
      setListening(true)
      startRecognition()
    }
  }

  useEffect(() => {
    return () => {
      listeningRef.current = false
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null
        recognitionRef.current.onerror = null
        recognitionRef.current.onend = null
        try { recognitionRef.current.abort() } catch {}
      }
      speechSynthesis.cancel()
    }
  }, [])

  /* ── Send Message ── */

  async function send() {
    const text = input.trim()
    if (!text || streaming) return

    const userMsg = { role: 'user', content: text }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setStreaming(true)

    // Build context: system prompt + overheard speech + messages
    const heardContext = transcriptRef.current.length > 0
      ? transcriptRef.current.map(t => t.text).join(' ')
      : ''

    const systemParts = [ASSISTANT_PROMPT]
    if (heardContext) {
      systemParts.push(`Overheard speech (passive context, the user did not type this): "${heardContext}"`)
    }
    const systemMessage = { role: 'system', content: systemParts.join('\n\n') }

    const apiMessages = [systemMessage, ...updated]

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, model: 'glm-5.2:cloud' }),
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
      let fullResponse = ''

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
              fullResponse += delta
              assistantMsg.content = fullResponse
              setMessages((prev) => {
                const next = [...prev]
                next[next.length - 1] = { ...assistantMsg }
                return next
              })
            }
          } catch {}
        }
      }

      // Speak the response
      speak(fullResponse)

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
    <div className="assistant-shell">
      <header className="assistant-header">
        <div className="header-left">
          <a href="/" className="back-link">← LittleRip</a>
        </div>
        <div className="header-right">
          <button
            className={`listen-toggle ${listening ? 'active' : ''}`}
            onClick={toggleListening}
          >
            <span className="listen-icon">{listening ? '🔴' : '🎤'}</span>
            {listening ? 'Listening' : 'Start Listening'}
          </button>
          {messages.length > 0 && (
            <button className="clear-btn" onClick={() => setMessages([])}>Clear</button>
          )}
        </div>
      </header>

      <div className="assistant-body">
        {/* Passive hearing log */}
        {(listening || transcript.length > 0) && (
          <div className="hearing-section">
            <div className="hearing-label">
              <span className="hearing-icon">{listening ? '🔴' : '👂'}</span>
              {listening ? 'Hearing' : 'Heard'}
            </div>
            <div className="hearing-log">
              {transcript.map((t, i) => (
                <span key={i} className="heard-text">{t.text}</span>
              ))}
            </div>
          </div>
        )}

        {/* Chat messages */}
        {messages.length === 0 && transcript.length === 0 && !listening && (
          <div className="empty-state" />
        )}
        {messages.map((m, i) => (
          <div key={i} className={`assistant-msg ${m.role}`}>
            <div className="msg-role">{m.role === 'user' ? 'You' : 'LittleRip'}</div>
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

      <div className="assistant-input-bar">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Message LittleRip…"
          disabled={streaming}
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