'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { clean } from '../models'

const ASSISTANT_PROMPT = `You are LittleRip, an assistant. The user's speech is being transcribed live — you are passively aware of their environment and anything said aloud. Only respond when the user sends you a typed message. When they do, use the context of what you've overheard to inform your response. Keep responses concise and helpful.`

const CHUNK_DURATION = 4000 // ms per audio chunk sent to Groq

export default function AssistantPage() {
  const [messages, setMessages] = useState([])
  const [transcript, setTranscript] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [listening, setListening] = useState(false)
  const [liveHear, setLiveHear] = useState('')

  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunkTimerRef = useRef(null)
  const transcriptRef = useRef([])
  const chunksRef = useRef([])

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

  /* ── Send audio chunk to Groq Whisper via /api/transcribe ── */

  const transcribeChunk = useCallback(async (audioBlob) => {
    if (!audioBlob || audioBlob.size < 1000) return // skip tiny/empty chunks

    try {
      const formData = new FormData()
      const ext = audioBlob.type.includes('webm') ? 'webm' : audioBlob.type.includes('mp4') ? 'mp4' : 'ogg'
      formData.append('file', audioBlob, `recording.${ext}`)

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) return

      const data = await res.json()
      const text = data.text?.trim()
      if (text && text !== '[BLANK_AUDIO]') {
        transcriptRef.current = [...transcriptRef.current, { text, time: Date.now() }]
        setTranscript([...transcriptRef.current])
      }
    } catch {
      // silent fail — next chunk will try again
    }
  }, [])

  /* ── Continuous Recording ── */

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Pick best supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : 'audio/ogg'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      // Collect chunks on a timer, send them for transcription
      chunkTimerRef.current = setInterval(() => {
        if (chunksRef.current.length === 0) return

        const blob = new Blob(chunksRef.current, { type: mimeType })
        chunksRef.current = []

        // Restart recorder for next chunk
        if (recorder.state === 'recording') {
          recorder.stop()
          recorder.start(1000) // resume with 1s timeslice
        }

        transcribeChunk(blob)
      }, CHUNK_DURATION)

      recorder.start(1000) // collect data every 1s
      setListening(true)

    } catch (err) {
      console.error('Microphone access denied:', err)
      setListening(false)
    }
  }, [transcribeChunk])

  function stopRecording() {
    setListening(false)
    setLiveHear('')

    if (chunkTimerRef.current) {
      clearInterval(chunkTimerRef.current)
      chunkTimerRef.current = null
    }

    // Send any remaining chunks
    if (chunksRef.current.length > 0 && mediaRecorderRef.current) {
      const mimeType = mediaRecorderRef.current.mimeType
      const blob = new Blob(chunksRef.current, { type: mimeType })
      chunksRef.current = []
      transcribeChunk(blob)
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  function toggleListening() {
    if (listening) {
      stopRecording()
    } else {
      // Warm up TTS
      const warmup = new SpeechSynthesisUtterance('')
      warmup.volume = 0
      speechSynthesis.speak(warmup)
      speechSynthesis.getVoices()
      startRecording()
    }
  }

  useEffect(() => {
    return () => {
      if (chunkTimerRef.current) clearInterval(chunkTimerRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
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
            {listening ? 'Listening (Groq)' : 'Start Listening'}
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
              {listening ? 'Hearing (Groq Whisper)' : 'Heard'}
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