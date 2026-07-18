'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clean } from '../models'

const FIVE_MINUTES = 5 * 60 * 1000
const ONE_MINUTE = 60 * 1000

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed.')
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}

function formatClock(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

function formatDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(value))
}

export default function InnerMonologuePage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [cycle, setCycle] = useState(null)
  const [reflections, setReflections] = useState([])
  const [topics, setTopics] = useState([])
  const [memoryItems, setMemoryItems] = useState([])
  const [inputs, setInputs] = useState([])
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const [compacting, setCompacting] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [tab, setTab] = useState('journal')
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [input, setInput] = useState('')
  const [promptDraft, setPromptDraft] = useState('')
  const [audioReady, setAudioReady] = useState(false)

  const [authMode, setAuthMode] = useState('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)

  const actionRef = useRef(false)
  const nextAttemptRef = useRef(0)
  const bottomRef = useRef(null)

  const applyState = useCallback((data) => {
    setUser(data.user)
    setProfile(data.profile)
    setPromptDraft(data.profile?.system_prompt || '')
    setCycle(data.cycle)
    setReflections(data.reflections || [])
    setTopics(data.topics || [])
    setMemoryItems(data.memoryItems || [])
    setInputs(data.inputs || [])
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
    if (tab === 'journal' && (reflections.length > 0 || busy)) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [reflections, busy, tab])

  const completedCycleSteps = useMemo(() => {
    if (!cycle) return 0
    return reflections.filter(r => r.cycle_id === cycle.id && r.status === 'complete').length
  }, [cycle, reflections])

  const speak = useCallback((sentence) => {
    if (!audioReady || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(clean(sentence))
    utterance.rate = 0.96
    const voices = window.speechSynthesis.getVoices()
    utterance.voice = voices.find(v => v.name === 'Samantha')
      || voices.find(v => v.name === 'Google US English')
      || voices.find(v => v.lang === 'en-US')
      || voices.find(v => v.lang?.startsWith('en'))
      || voices[0]
    window.speechSynthesis.speak(utterance)
  }, [audioReady])

  function enableAudio() {
    if ('speechSynthesis' in window) {
      const warmup = new SpeechSynthesisUtterance('')
      warmup.volume = 0
      window.speechSynthesis.speak(warmup)
      window.speechSynthesis.getVoices()
    }
    setAudioReady(true)
  }

  const startCycle = useCallback(async () => {
    if (actionRef.current) return
    actionRef.current = true
    setError('')
    try {
      const data = await api('/api/inner/cycle', {
        method: 'POST', body: JSON.stringify({ action: 'start' }),
      })
      setCycle(data.cycle)
      setProfile(prev => prev ? { ...prev, loop_enabled: true } : prev)
      setNotice('The five-minute loop is running.')
    } catch (err) {
      setError(err.message)
    } finally {
      actionRef.current = false
    }
  }, [])

  async function startLoop() {
    enableAudio()
    await startCycle()
  }

  async function pauseLoop() {
    if (actionRef.current) return
    actionRef.current = true
    setError('')
    try {
      await api('/api/inner/cycle', {
        method: 'POST', body: JSON.stringify({ action: 'pause' }),
      })
      setCycle(null)
      setProfile(prev => prev ? { ...prev, loop_enabled: false } : prev)
      setNotice('The loop is paused. Your journal and memory are saved.')
      window.speechSynthesis?.cancel()
    } catch (err) {
      setError(err.message)
    } finally {
      actionRef.current = false
    }
  }

  const runCompaction = useCallback(async () => {
    setCompacting(true)
    setNotice('Organizing the active journal into memory folders…')
    try {
      const data = await api('/api/inner/compact', { method: 'POST', body: '{}' })
      if (data.compacted) {
        setNotice(`Memory organized into ${data.topics} folders and ${data.items} saved ideas.`)
        await loadState()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setCompacting(false)
    }
  }, [loadState])

  const runStep = useCallback(async (stepNumber) => {
    if (!cycle || actionRef.current) return
    actionRef.current = true
    setBusy(true)
    setError('')
    setNotice(`High-effort reflection ${stepNumber} of 5…`)
    try {
      const data = await api('/api/inner/step', {
        method: 'POST',
        body: JSON.stringify({ cycleId: cycle.id, stepNumber }),
      })
      setReflections(prev => {
        const without = prev.filter(r => r.id !== data.reflection.id)
        return [...without, data.reflection]
      })
      setProfile(prev => prev ? { ...prev, active_token_estimate: data.activeTokenEstimate ?? prev.active_token_estimate } : prev)
      setNotice(`Reflection ${stepNumber} saved.`)
      if (data.needsCompaction) await runCompaction()
    } catch (err) {
      nextAttemptRef.current = Date.now() + (err.status === 409 ? 5000 : 12000)
      if (!(err.status === 409 && /already running/i.test(err.message))) setError(err.message)
    } finally {
      setBusy(false)
      actionRef.current = false
    }
  }, [cycle, runCompaction])

  const finishCycle = useCallback(async () => {
    if (!cycle || actionRef.current) return
    actionRef.current = true
    setBusy(true)
    setError('')
    try {
      const data = await api('/api/inner/cycle', {
        method: 'POST',
        body: JSON.stringify({ action: 'finish', cycleId: cycle.id }),
      })
      setNotice(`Shared: “${data.sentence}”`)
      speak(data.sentence)
      setCycle(null)
      if (profile?.loop_enabled) {
        setTimeout(() => startCycle(), 900)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      actionRef.current = false
    }
  }, [cycle, profile?.loop_enabled, speak, startCycle])

  useEffect(() => {
    if (!cycle || !profile?.loop_enabled || actionRef.current || compacting || now < nextAttemptRef.current) return
    const started = new Date(cycle.started_at).getTime()
    const nextStep = completedCycleSteps + 1
    if (nextStep <= 5) {
      const dueAt = started + (nextStep - 1) * ONE_MINUTE
      if (now >= dueAt) runStep(nextStep)
      return
    }
    const endsAt = new Date(cycle.ends_at).getTime() || started + FIVE_MINUTES
    if (now >= endsAt) finishCycle()
  }, [cycle, profile?.loop_enabled, completedCycleSteps, now, compacting, runStep, finishCycle])

  async function submitInput(event) {
    event.preventDefault()
    const content = input.trim()
    if (!content) return
    setInput('')
    setError('')
    try {
      const data = await api('/api/inner/input', {
        method: 'POST', body: JSON.stringify({ content }),
      })
      setInputs(prev => [...prev, data.input])
      setNotice('Your thought will enter the next reflection pass.')
    } catch (err) {
      setInput(content)
      setError(err.message)
    }
  }

  async function savePrompt() {
    setError('')
    try {
      const data = await api('/api/inner/prompt', {
        method: 'PATCH', body: JSON.stringify({ systemPrompt: promptDraft }),
      })
      setProfile(prev => ({ ...prev, ...data.profile }))
      setNotice('The inquiry prompt was saved.')
    } catch (err) {
      setError(err.message)
    }
  }

  async function submitAuth(event) {
    event.preventDefault()
    setAuthBusy(true)
    setError('')
    try {
      const data = await api(`/api/auth/${authMode}`, {
        method: 'POST',
        body: JSON.stringify({ email: authEmail, password: authPassword }),
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
    await api('/api/auth/logout', { method: 'POST', body: '{}' }).catch(() => {})
    window.speechSynthesis?.cancel()
    setUser(null)
    setProfile(null)
    setCycle(null)
    setReflections([])
    setTopics([])
    setMemoryItems([])
  }

  if (loading) {
    return <main className="inner-loading">Opening Inner Monologue…</main>
  }

  if (!user) {
    return (
      <main className="inner-auth-shell">
        <a href="/" className="back-link inner-auth-back">← LittleRip</a>
        <section className="inner-auth-card">
          <p className="inner-kicker">Private reflective space</p>
          <h1>Inner Monologue</h1>
          <p className="inner-auth-copy">Five-minute GLM‑5.2 reflection cycles, a spoken sentence, and a memory that belongs to your account.</p>
          <form onSubmit={submitAuth} className="inner-auth-form">
            <label>Email<input type="email" autoComplete="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required /></label>
            <label>Password<input type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} minLength={10} value={authPassword} onChange={e => setAuthPassword(e.target.value)} required /></label>
            {error && <p className="inner-error">{error}</p>}
            <button type="submit" className="inner-primary" disabled={authBusy}>{authBusy ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create account'}</button>
          </form>
          <button className="inner-auth-switch" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setError('') }}>
            {authMode === 'login' ? 'Create a new account' : 'I already have an account'}
          </button>
          <p className="inner-cookie-note">A secure 90-day cookie keeps you signed in on this browser.</p>
        </section>
      </main>
    )
  }

  const remaining = cycle ? new Date(cycle.ends_at).getTime() - now : FIVE_MINUTES
  const progress = cycle ? Math.min(100, Math.max(0, ((FIVE_MINUTES - remaining) / FIVE_MINUTES) * 100)) : 0
  const activeTopic = topics.find(t => t.id === selectedTopic) || topics[0]
  const topicItems = activeTopic ? memoryItems.filter(item => item.topic_id === activeTopic.id) : []
  const contextPercent = profile ? Math.min(100, Math.round((Number(profile.active_token_estimate || 0) / Number(profile.context_token_limit || 32000)) * 100)) : 0

  return (
    <main className="inner-shell">
      <header className="inner-header">
        <div className="inner-header-left">
          <a href="/" className="back-link">← LittleRip</a>
          <span className={`inner-live-dot ${profile?.loop_enabled ? 'running' : ''}`} />
          <span className="inner-status-text">{compacting ? 'Organizing memory' : busy ? 'Reflecting' : profile?.loop_enabled ? 'Loop running' : 'Paused'}</span>
        </div>
        <div className="inner-header-actions">
          {!audioReady && <button className="inner-quiet-btn" onClick={enableAudio}>Enable voice</button>}
          <span className="inner-account">{user.email}</span>
          <button className="inner-quiet-btn" onClick={logout}>Sign out</button>
        </div>
      </header>

      <section className="inner-cycle-bar">
        <div>
          <p className="inner-kicker">Cycle {cycle?.cycle_number || Number(profile?.cycle_number || 0) + 1}</p>
          <div className="inner-timer">{formatClock(remaining)}</div>
        </div>
        <div className="inner-cycle-middle">
          <div className="inner-progress"><span style={{ width: `${progress}%` }} /></div>
          <p>{cycle ? `${completedCycleSteps}/5 reflections saved` : 'Five paced high-effort reflections'}</p>
        </div>
        {profile?.loop_enabled ? (
          <button className="inner-pause-btn" onClick={pauseLoop}>Pause loop</button>
        ) : (
          <button className="inner-primary inner-start-btn" onClick={startLoop}>Start loop</button>
        )}
      </section>

      <nav className="inner-tabs" aria-label="Inner Monologue sections">
        <button className={tab === 'journal' ? 'active' : ''} onClick={() => setTab('journal')}>Journal</button>
        <button className={tab === 'memory' ? 'active' : ''} onClick={() => setTab('memory')}>Memory <span>{topics.length}</span></button>
        <button className={tab === 'prompt' ? 'active' : ''} onClick={() => setTab('prompt')}>Prompt</button>
      </nav>

      {(notice || error) && <div className={`inner-notice ${error ? 'error' : ''}`}>{error || notice}</div>}

      {tab === 'journal' && (
        <section className="inner-journal">
          <div className="inner-journal-intro">
            <h1>Rummaging toward a future of consciousness</h1>
            <p>Each card is a saved public reflection—not a hidden reasoning trace. The loop speaks one sentence after every five-minute cycle.</p>
          </div>
          <div className="inner-reflection-list">
            {reflections.length === 0 && !busy && <div className="inner-empty">Start the loop to create its first reflection.</div>}
            {reflections.map(reflection => (
              <article className="inner-reflection" key={reflection.id}>
                <div className="inner-reflection-meta">
                  <span>Cycle {reflection.cycle_number} · {reflection.step_number}/5</span>
                  <time>{formatDate(reflection.created_at)}</time>
                </div>
                <h2>{reflection.focus}</h2>
                <p>{reflection.note}</p>
              </article>
            ))}
            {busy && (
              <article className="inner-reflection inner-reflecting">
                <div className="inner-thinking-line"><i /><i /><i /></div>
                <p>GLM‑5.2 is making a high-effort reflection while the cycle clock continues.</p>
              </article>
            )}
            <div ref={bottomRef} />
          </div>
          <form className="inner-input-bar" onSubmit={submitInput}>
            <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Add a thought, question, or direction for the next reflection…" maxLength={2000} rows={2} />
            <button type="submit" disabled={!input.trim()}>Add</button>
          </form>
        </section>
      )}

      {tab === 'memory' && (
        <section className="inner-memory-layout">
          <aside className="inner-topic-list">
            <div className="inner-memory-meter">
              <span>Active context</span><strong>{contextPercent}%</strong>
              <div><i style={{ width: `${Math.min(100, contextPercent / 0.7)}%` }} /></div>
              <small>Folders update automatically at 70% of the 32K active budget.</small>
            </div>
            {topics.length === 0 && <p className="inner-empty-small">Memory folders appear after the first compaction.</p>}
            {topics.map(topic => (
              <button key={topic.id} className={activeTopic?.id === topic.id ? 'active' : ''} onClick={() => setSelectedTopic(topic.id)}>
                <strong>{topic.name}</strong><span>{memoryItems.filter(item => item.topic_id === topic.id).length} ideas</span>
              </button>
            ))}
          </aside>
          <div className="inner-memory-detail">
            {activeTopic ? (
              <>
                <p className="inner-kicker">Memory folder</p>
                <h1>{activeTopic.name}</h1>
                <p className="inner-topic-summary">{activeTopic.summary}</p>
                <div className="inner-memory-items">
                  {topicItems.map(item => (
                    <article key={item.id}>
                      <h2>{item.title}</h2>
                      <p>{item.summary}</p>
                      {item.details && <details><summary>Open full memory</summary><p>{item.details}</p></details>}
                      {item.keywords && <small>{item.keywords}</small>}
                    </article>
                  ))}
                </div>
              </>
            ) : <div className="inner-empty">The memory is still forming.</div>}
          </div>
        </section>
      )}

      {tab === 'prompt' && (
        <section className="inner-prompt-layout">
          <div className="inner-prompt-editor">
            <p className="inner-kicker">User-editable inquiry</p>
            <h1>Shape what it returns to</h1>
            <p>The immutable privacy and safety boundary remains separate. Your inquiry can be edited up to 6,000 characters.</p>
            <textarea value={promptDraft} onChange={e => setPromptDraft(e.target.value)} maxLength={6000} />
            <div className="inner-prompt-actions"><span>{promptDraft.length}/6,000</span><button className="inner-primary" onClick={savePrompt}>Save prompt</button></div>
          </div>
          <aside className="inner-evolving-prompt">
            <p className="inner-kicker">Model-evolved addendum</p>
            <h2>Compaction revision {profile?.prompt_revision_count || 0}</h2>
            <p>{profile?.evolving_prompt || 'After memory compaction, the model may place a short self-revision here. It cannot replace the main prompt or immutable rules.'}</p>
            <small>Capped at 1,800 characters and revised only when the 70% threshold is reached.</small>
          </aside>
        </section>
      )}

      <footer className="inner-footer">The continuous loop runs while this page is open. Everything is saved to your private account and the model runs in Ollama Cloud, not on your laptop.</footer>
    </main>
  )
}
