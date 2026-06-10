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
  const [transcribing, setTranscribing] = useState(false)

  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const transcriptRef = useRef([])
  const callActiveRef = useRef(false)
  const chunkIntervalRef = useRef(null)

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

  /* ── Groq Whisper Transcription ── */

  const transcribeChunk = useCallback(async (audioBlob) => {
    if (!audioBlob || audioBlob.size < 1000) return

    setTranscribing(true)
    try {
      const formData = new FormData()
      formData.append('file', audioBlob, 'recording.webm')

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        const text = data.text?.trim()
        if (text) {
          transcriptRef.current = [...transcriptRef.current, { text, time: Date.now() }]
          setTranscript([...transcriptRef.current])
        }
      }
    } catch {}
    setTranscribing(false)
  }, [])

  /* ── MediaRecorder Continuous Listening ── */

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      })

      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      // Send chunks every 5 seconds for transcription
      chunkIntervalRef.current = setInterval(() => {
        if (chunksRef.current.length > 0 && callActiveRef.current) {
          const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType })
          chunksRef.current = []
          transcribeChunk(blob)
        }
      }, 5000)

      mediaRecorder.start(1000) // collect data every second
      mediaRecorderRef.current = mediaRecorder
    } catch (err) {
      console.error('Mic access denied:', err)
      setListening(false)
      callActiveRef.current = false
    }
  }, [transcribeChunk])

  function toggleListening() {
    if (listening) {
      callActiveRef.current = false
      setListening(false)

      // Send any remaining chunks
      if (chunksRef.current.length > 0) {
        const blob = new Blob(chunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' })
        chunksRef.current = []
        transcribeChunk(blob)
      }

      if (chunkIntervalRef.current) {
        clearInterval(chunkIntervalRef.current)
        chunkIntervalRef.current = null
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop())
        mediaRecorderRef.current = null
      }
    } else {
      callActiveRef.current = true
      setListening(true)

      // Warm up TTS
      const warmup = new SpeechSynthesisUtterance('')
      warmup.volume = 0
      speechSynthesis.speak(warmup)
      speechSynthesis.getVoices()

      startListening()
    }
  }

  useEffect(() => {
    return () => {
      callActiveRef.current = false
      if (chunkIntervalRef.current) clearInterval(chunkIntervalRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop())
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
        body: JSON.stringify({ messages: apiMessages, model: 'deepseek-v4-pro:cloud' }),
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
            {transcribing ? 'Transcribing…' : listening ? 'Listening' : 'Start Listening'}
          </button>
          {messages.length > 0 && (
            <button className="clear-btn" onClick={() => setMessages([])}>Clear</button>
          )}
        </div>
      </header>

      <div className="assistant-body">
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
              {transcribing && <span className="heard-text interim">transcribing…</span>}
            </div>
          </div>
        )}

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