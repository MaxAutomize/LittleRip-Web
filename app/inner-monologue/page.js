'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clean } from '../models'

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed.')
    error.status = response.status
    throw error
  }
  return data
}

export default function InnerMonologuePage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [cycle, setCycle] = useState(null)
  const [reflections, setReflections] = useState([])
  const [topics, setTopics] = useState([])
  const [memoryItems, setMemoryItems] = useState([])
  const [trace, setTrace] = useState('')
  const [spokenLine, setSpokenLine] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [busy, setBusy] = useState(false)
  const [compacting, setCompacting] = useState(false)
  const [error, setError] = useState('')
  const [audioReady, setAudioReady] = useState(false)
  const [now, setNow] = useState(Date.now())

  const [authMode, setAuthMode] = useState('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)

  const actionRef = useRef(false)
  const streamAbortRef = useRef(null)
  const nextAttemptRef = useRef(0)
  const traceEndRef = useRef(null)

  const applyState = useCallback((data) => {
    setUser(data.user)
    setProfile(data.profile)
    setCycle(data.cycle)
    setReflections(data.reflections || [])
    setTopics(data.topics || [])
    setMemoryItems(data.memoryItems || [])
    setSpokenLine(data.lastSpokenSentence || '')
    const saved = (data.reflections || [])
      .slice(-6)
      .map(item => item.note)
      .filter(Boolean)
      .join('\n\n')
    if (saved) setTrace(saved.slice(-80000))
  }, [])

  const loadState = useCallback(async () => {
    try {
      const data = await api('/api/inner/state')
      applyState(data)
      setError('')
    } catch (err) {
      if (err.status === 401) setUser(null)
      else setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [applyState])

  useEffect(() => { loadState() }, [loadState])
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    traceEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [trace])

  const cycleSegments = useMemo(() => {
    if (!cycle) return []
    return reflections.filter(item => item.cycle_id === cycle.id && item.status === 'complete')
  }, [cycle, reflections])

  const activeTopic = topics.find(topic => topic.id === selectedTopic) || topics[0]
  const topicItems = activeTopic ? memoryItems.filter(item => item.topic_id === activeTopic.id) : []

  function enableAudio() {
    if ('speechSynthesis' in window) {
      const warmup = new SpeechSynthesisUtterance('')
      warmup.volume = 0
      window.speechSynthesis.speak(warmup)
      window.speechSynthesis.getVoices()
    }
    setAudioReady(true)
  }

  const speak = useCallback((sentence) => {
    if (!audioReady || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(clean(sentence))
    utterance.rate = 0.94
    const voices = window.speechSynthesis.getVoices()
    utterance.voice = voices.find(voice => voice.name === 'Samantha')
      || voices.find(voice => voice.name === 'Google US English')
      || voices.find(voice => voice.lang === 'en-US')
      || voices.find(voice => voice.lang?.startsWith('en'))
      || voices[0]
    window.speechSynthesis.speak(utterance)
  }, [audioReady])

  const startCycle = useCallback(async () => {
    if (actionRef.current) return
    actionRef.current = true
    setError('')
    try {
      const data = await api('/api/inner/cycle', {
        method: 'POST', body: JSON.stringify({ action: 'start' }),
      })
      setCycle(data.cycle)
      setProfile(previous => previous ? { ...previous, loop_enabled: true } : previous)
    } catch (err) {
      setError(err.message)
    } finally {
      actionRef.current = false
    }
  }, [])

  async function begin() {
    enableAudio()
    await startCycle()
  }

  async function pause() {
    streamAbortRef.current?.abort()
    actionRef.current = true
    try {
      await api('/api/inner/cycle', { method: 'POST', body: JSON.stringify({ action: 'pause' }) })
      setCycle(null)
      setProfile(previous => previous ? { ...previous, loop_enabled: false } : previous)
      window.speechSynthesis?.cancel()
      setMenuOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      actionRef.current = false
    }
  }

  const compact = useCallback(async () => {
    setCompacting(true)
    try {
      const data = await api('/api/inner/compact', { method: 'POST', body: '{}' })
      if (data.compacted) await loadState()
    } catch (err) {
      setError(err.message)
    } finally {
      setCompacting(false)
    }
  }, [loadState])

  const streamThinking = useCallback(async () => {
    if (!cycle || actionRef.current) return
    actionRef.current = true
    setBusy(true)
    setError('')
    const segmentNumber = cycleSegments.length + 1

    try {
      const streamController = new AbortController()
      streamAbortRef.current = streamController
      const response = await fetch('/api/inner/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycleId: cycle.id, segmentNumber }),
        signal: streamController.signal,
      })
      const contentType = response.headers.get('content-type') || ''
      if (!response.ok || !contentType.includes('text/event-stream')) {
        const data = await response.json().catch(() => ({}))
        const failure = new Error(data.error || 'The thinking stream stopped.')
        failure.status = response.status
        throw failure
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let savedPayload = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''
        for (const event of events) {
          const line = event.split('\n').find(part => part.startsWith('data: '))
          if (!line) continue
          try {
            const payload = JSON.parse(line.slice(6))
            if (payload.type === 'thinking' && payload.text) {
              setTrace(previous => `${previous}${payload.text}`.slice(-80000))
            } else if (payload.type === 'saved') {
              savedPayload = payload
            } else if (payload.type === 'error') {
              throw new Error(payload.error)
            }
          } catch (parseError) {
            if (parseError.message && !/JSON/.test(parseError.message)) throw parseError
          }
        }
      }

      if (savedPayload?.reflection) {
        setReflections(previous => [...previous.filter(item => item.id !== savedPayload.reflection.id), savedPayload.reflection])
        setProfile(previous => previous ? {
          ...previous,
          active_token_estimate: savedPayload.activeTokenEstimate,
        } : previous)
        if (savedPayload.needsCompaction) await compact()
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        nextAttemptRef.current = Date.now() + (err.status === 409 ? 5000 : 12000)
        if (!(err.status === 409 && /already running/i.test(err.message))) setError(err.message)
      }
    } finally {
      streamAbortRef.current = null
      setBusy(false)
      actionRef.current = false
    }
  }, [cycle, cycleSegments.length, compact])

  const finishCycle = useCallback(async () => {
    if (!cycle || actionRef.current) return
    actionRef.current = true
    setBusy(true)
    try {
      const data = await api('/api/inner/cycle', {
        method: 'POST', body: JSON.stringify({ action: 'finish', cycleId: cycle.id }),
      })
      speak(data.sentence)
      setSpokenLine(data.sentence)
      setTrace(previous => `${previous}\n\n`.slice(-80000))
      setCycle(null)
    } catch (err) {
      setError(err.message)
      nextAttemptRef.current = Date.now() + 5000
    } finally {
      setBusy(false)
      actionRef.current = false
    }
  }, [cycle, speak])

  useEffect(() => {
    if (!user || !profile?.loop_enabled || cycle || actionRef.current || now < nextAttemptRef.current) return
    startCycle()
  }, [user, profile?.loop_enabled, cycle, now, startCycle])

  useEffect(() => {
    if (!cycle || !profile?.loop_enabled || actionRef.current || compacting || now < nextAttemptRef.current) return
    const ended = now >= new Date(cycle.ends_at).getTime()
    if (ended && cycleSegments.length > 0) finishCycle()
    else if (!ended) streamThinking()
  }, [cycle, profile?.loop_enabled, compacting, now, cycleSegments.length, streamThinking, finishCycle])

  async function submitAuth(event) {
    event.preventDefault()
    setAuthBusy(true)
    setError('')
    try {
      const data = await api(`/api/auth/${authMode}`, {
        method: 'POST', body: JSON.stringify({ email: authEmail, password: authPassword }),
      })
      setUser(data.user)
      setAuthPassword('')
      await loadState()
    } catch (err) {
      setError(err.message)
    } finally {
      setAuthBusy(false)
    }
  }

  async function logout() {
    streamAbortRef.current?.abort()
    await api('/api/auth/logout', { method: 'POST', body: '{}' }).catch(() => {})
    window.speechSynthesis?.cancel()
    setUser(null)
    setProfile(null)
    setCycle(null)
    setTrace('')
    setSpokenLine('')
    setMenuOpen(false)
  }

  if (loading) return <main className="magic-loading" />

  if (!user) {
    return (
      <main className="magic-auth">
        <a href="/" className="magic-home">LittleRip</a>
        <form className="magic-auth-form" onSubmit={submitAuth}>
          <h1>Inner Monologue</h1>
          <input type="email" placeholder="email" autoComplete="email" value={authEmail} onChange={event => setAuthEmail(event.target.value)} required />
          <input type="password" placeholder="password" minLength={10} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} value={authPassword} onChange={event => setAuthPassword(event.target.value)} required />
          {error && <p>{error}</p>}
          <button type="submit" disabled={authBusy}>{authBusy ? '…' : authMode === 'login' ? 'enter' : 'create'}</button>
          <button type="button" className="magic-switch" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setError('') }}>
            {authMode === 'login' ? 'new account' : 'sign in'}
          </button>
        </form>
      </main>
    )
  }

  return (
    <main className={`magic-shell ${profile?.loop_enabled ? 'alive' : ''}`}>
      <button className="magic-menu-button" onClick={() => setMenuOpen(true)} aria-label="Open the memory filing cabinet">•••</button>

      <section className="magic-trace" aria-live="polite">
        {trace ? <pre>{trace}</pre> : profile?.loop_enabled ? <div className="magic-breath" /> : null}
        <div ref={traceEndRef} />
      </section>

      {spokenLine && <p className="magic-spoken">{spokenLine}</p>}
      <button className="magic-loop-switch" onClick={profile?.loop_enabled ? pause : begin}>
        {profile?.loop_enabled ? 'stop' : 'start'}
      </button>

      {error && <button className="magic-error" onClick={() => setError('')}>{error}</button>}

      {menuOpen && (
        <div className="magic-overlay magic-cabinet" role="dialog" aria-modal="true">
          <button className="magic-close" onClick={() => setMenuOpen(false)}>×</button>
          <p className="magic-cabinet-label">filing cabinet</p>
          <div className="magic-memory">
            <aside>
              {topics.length === 0 && <span>the drawers are empty</span>}
              {topics.map(topic => <button key={topic.id} onClick={() => setSelectedTopic(topic.id)}>{topic.name}</button>)}
            </aside>
            <article>
              {activeTopic && <>
                <h2>{activeTopic.name}</h2>
                <p>{activeTopic.summary}</p>
                {topicItems.map(item => <details key={item.id}><summary>{item.title}</summary><p>{item.details || item.summary}</p></details>)}
              </>}
            </article>
          </div>
          <footer><button onClick={logout}>sign out</button></footer>
        </div>
      )}
    </main>
  )
}
