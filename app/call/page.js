'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { displayName, clean, voiceType } from '../models'

export default function CallPage() {
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState('')
  const [ollamaStatus, setOllamaStatus] = useState('checking')
  const [callState, setCallState] = useState('idle') // idle | connecting | listening | thinking | speaking
  const [transcript, setTranscript] = useState([]) // [{ role, text }]
  const [liveText, setLiveText] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const recognitionRef = useRef(null)
  const isSpeakingRef = useRef(false)
  const callActiveRef = useRef(false)
  const streamingRef = useRef(false)
  const transcriptRef = useRef([])
  const dropdownRef = useRef(null)
  const selectedModelRef = useRef('')
  const sendToModelRef = useRef(null)
  const speechQueueRef = useRef([])
  const speechDoneCallbacksRef = useRef([])

  /* ── models ── */

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch('/api/models')
      const data = await res.json()
      if (data.models?.length) {
        setModels(data.models)
        setOllamaStatus('online')
        setSelectedModel(prev => prev || data.models[0].id)
      } else {
        setOllamaStatus('offline')
      }
    } catch {
      setOllamaStatus('offline')
    }
  }, [])

  useEffect(() => { fetchModels() }, [])
  useEffect(() => {
    const id = setInterval(fetchModels, 15000)
    return () => clearInterval(id)
  }, [fetchModels])

  useEffect(() => {
    selectedModelRef.current = selectedModel
  }, [selectedModel])

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

  /* ── TTS ── */

  const drainSpeechQueue = useCallback(() => {
    if (!callActiveRef.current || isSpeakingRef.current) return

    const nextSentence = speechQueueRef.current.shift()
    if (!nextSentence) {
      const callbacks = speechDoneCallbacksRef.current.splice(0)
      callbacks.forEach(cb => cb?.())
      return
    }

    isSpeakingRef.current = true
    setCallState('speaking')

    const utt = new SpeechSynthesisUtterance(clean(nextSentence))
    utt.rate = 1.1

    const voices = speechSynthesis.getVoices()
    const currentModel = selectedModelRef.current || selectedModel
    const type = voiceType(currentModel)

    const girlVoice = voices.find(v => v.name === 'Google US English')
      || voices.find(v => v.name === 'Samantha')
      || voices.find(v => v.lang === 'en-US' && v.name.includes('Google'))
      || voices.find(v => v.lang === 'en-US')

    const boyVoice = voices.find(v => v.name === 'Google UK English Male')
      || voices.find(v => v.name === 'Daniel')
      || voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('male'))

    const fallbackVoice = girlVoice
      || voices.find(v => v.lang.startsWith('en') && v.name.includes('Google'))
      || voices.find(v => v.lang.startsWith('en'))
      || voices[0]

    const voice = type === 'female' ? (girlVoice || fallbackVoice) : (boyVoice || fallbackVoice)
    if (voice) utt.voice = voice
    utt.pitch = type === 'male' && !boyVoice ? 0.85 : 1.0

    const finish = () => {
      isSpeakingRef.current = false
      setTimeout(() => drainSpeechQueue(), 40)
    }
    utt.onend = finish
    utt.onerror = finish

    speechSynthesis.speak(utt)
  }, [])

  const speak = useCallback((sentences, onDone) => {
    const queued = sentences.map(s => s.trim()).filter(Boolean)

    if (onDone) {
      if (!queued.length && !isSpeakingRef.current && !speechQueueRef.current.length) {
        onDone()
        return
      }
      speechDoneCallbacksRef.current.push(onDone)
    }

    if (queued.length) {
      speechQueueRef.current.push(...queued)
    }
    drainSpeechQueue()
  }, [drainSpeechQueue])

  /* ── STT ── */

  const startListening = useCallback(() => {
    if (!callActiveRef.current) return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    if (recognitionRef.current) {
      recognitionRef.current.onend = null
      recognitionRef.current.abort()
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    setCallState('listening')

    recognition.onresult = async (event) => {
      const text = event.results[0][0].transcript.trim()
      if (!text) return

      setCallState('thinking')
      transcriptRef.current = [...transcriptRef.current, { role: 'user', text }]
      setTranscript([...transcriptRef.current])

      await sendToModelRef.current?.(text)
    }

    recognition.onerror = () => {
      if (callActiveRef.current && !streamingRef.current) {
        setTimeout(() => startListening(), 500)
      }
    }

    recognition.onend = () => {
      if (callActiveRef.current && !streamingRef.current && !isSpeakingRef.current) {
        setTimeout(() => startListening(), 300)
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [])

  /* ── send to model ── */

  const sendToModel = useCallback(async (text) => {
    if (streamingRef.current) return
    streamingRef.current = true
    setCallState('thinking')
    setLiveText('')

    speechSynthesis.cancel()
    speechQueueRef.current = []
    speechDoneCallbacksRef.current = []
    isSpeakingRef.current = false

    // Build messages array for the API
    const apiMessages = transcriptRef.current.map(t => ({
      role: t.role,
      content: t.text,
    }))

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, model: selectedModelRef.current || selectedModel }),
      })

      if (!res.ok) {
        const err = await res.text()
        transcriptRef.current = [...transcriptRef.current, { role: 'assistant', text: `Error: ${err}` }]
        setTranscript([...transcriptRef.current])
        streamingRef.current = false
        if (callActiveRef.current) speak([`Error`], () => startListening())
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullResponse = ''
      let sentenceBuffer = ''

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
              sentenceBuffer += delta
              setLiveText(fullResponse)

              // Speak complete sentences as they arrive
              if (sentenceBuffer.match(/[.!?。]/) && callActiveRef.current) {
                const match = sentenceBuffer.match(/[.!?。]/)
                const endIdx = sentenceBuffer.indexOf(match[0]) + 1
                const ready = sentenceBuffer.slice(0, endIdx)
                sentenceBuffer = sentenceBuffer.slice(endIdx)
                speak([ready])
              }
            }
          } catch {}
        }
      }

      // Finalize
      transcriptRef.current = [...transcriptRef.current, { role: 'assistant', text: fullResponse }]
      setTranscript([...transcriptRef.current])
      setLiveText('')

      // Speak any remaining text, then go back to listening only after speech is finished
      if (callActiveRef.current) {
        if (sentenceBuffer.trim()) {
          speak([sentenceBuffer.trim()], () => startListening())
        } else {
          speak([], () => startListening())
        }
      }

    } catch (err) {
      transcriptRef.current = [...transcriptRef.current, { role: 'assistant', text: `Connection error` }]
      setTranscript([...transcriptRef.current])
      setLiveText('')
      if (callActiveRef.current) speak(['Connection error'], () => startListening())
    }

    streamingRef.current = false
  }, [selectedModel, speak, startListening])

  useEffect(() => {
    sendToModelRef.current = sendToModel
  }, [sendToModel])

  /* ── call controls ── */

  function startCall() {
    callActiveRef.current = true
    setCallState('connecting')
    setTranscript([])
    transcriptRef.current = []

    // Unlock speech synthesis on mobile by speaking a silent utterance
    // inside the user-gesture click handler. Without this, iOS/Android
    // block all TTS that happens later in callbacks.
    const warmup = new SpeechSynthesisUtterance('')
    warmup.volume = 0
    speechSynthesis.speak(warmup)
    speechSynthesis.getVoices()

    setTimeout(() => startListening(), 600)
  }

  function endCall() {
    callActiveRef.current = false
    setCallState('idle')
    setLiveText('')

    if (recognitionRef.current) {
      recognitionRef.current.onend = null
      recognitionRef.current.abort()
      recognitionRef.current = null
    }
    speechSynthesis.cancel()
    speechQueueRef.current = []
    speechDoneCallbacksRef.current = []
    isSpeakingRef.current = false
    streamingRef.current = false
  }

  useEffect(() => {
    return () => {
      callActiveRef.current = false
      if (recognitionRef.current) {
        recognitionRef.current.onend = null
        recognitionRef.current.abort()
      }
      speechSynthesis.cancel()
    }
  }, [])

  /* ───────────────────── render ───────────────────── */

  const stateConfig = {
    idle:       { label: 'Ready to call',  icon: '☎️', color: '#88ffb2' },
    connecting: { label: 'Connecting...',   icon: '☎️', color: '#ffd36a' },
    listening:  { label: 'Listening',       icon: '🎤', color: '#88ffb2' },
    thinking:   { label: 'Thinking',        icon: '⏳', color: '#a8a8ff' },
    speaking:   { label: 'Speaking',        icon: '🔊', color: '#7da7ff' },
  }
  const current = stateConfig[callState]

  return (
    <div className="call-shell">
      <header className="call-top">
        <a href="/" className="back-link">← LittleRip</a>
        <div className="call-top-center">
          <div className="dropdown" ref={dropdownRef}>
            <button
              className="dropdown-trigger"
              onClick={() => callState === 'idle' && setDropdownOpen(!dropdownOpen)}
              disabled={ollamaStatus !== 'online' || callState !== 'idle'}
            >
              {selectedModel ? displayName(selectedModel) : 'Select model'}
              <span className="dropdown-arrow">▾</span>
            </button>
            {dropdownOpen && (
              <ul className="dropdown-list">
                {models.map(m => (
                  <li
                    key={m.id}
                    className={`dropdown-item ${m.id === selectedModel ? 'active' : ''}`}
                    onClick={() => { selectedModelRef.current = m.id; setSelectedModel(m.id); setDropdownOpen(false); }}
                  >
                    {displayName(m.id)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className={`status-dot ${ollamaStatus}`} />
      </header>

      <div className="call-stage">
        {/* Big state indicator */}
        <div className={`call-orb ${callState}`}>
          <span className="orb-icon">{current.icon}</span>
        </div>
        <p className="call-state-label" style={{ color: current.color }}>{current.label}</p>
        {callState !== 'idle' && selectedModel && (
          <p className="call-model-name">{displayName(selectedModel)}</p>
        )}

        {/* Live streaming text */}
        {liveText && callState === 'thinking' && (
          <div className="live-text">
            <span className="msg-role">{displayName(selectedModel)}</span>
            <p>{clean(liveText)}<span className="cursor">▌</span></p>
          </div>
        )}

        {/* Transcript */}
        {transcript.length > 0 && (
          <div className="call-transcript">
            {transcript.map((t, i) => (
              <div key={i} className={`call-msg ${t.role}`}>
                <span className="msg-role">{t.role === 'user' ? 'You' : displayName(selectedModel)}</span>
                <p>{t.role === 'assistant' ? clean(t.text) : t.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="call-controls">
        {callState === 'idle' ? (
          <button
            className="call-start-btn"
            onClick={startCall}
            disabled={ollamaStatus !== 'online'}
          >
            <span className="btn-icon">📞</span>
            Start Call
          </button>
        ) : (
          <button className="call-end-btn" onClick={endCall}>
            <span className="btn-icon">✕</span>
            End Call
          </button>
        )}
      </div>
    </div>
  )
}