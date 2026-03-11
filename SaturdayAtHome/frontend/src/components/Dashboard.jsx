import { useState, useEffect, useRef, useCallback } from 'react'

// ── Reusable button styles ───────────────────────────────
const btn = 'px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-40'
const btnPrimary = `${btn} bg-cyan-600 hover:bg-cyan-700 text-white`
const btnSecondary = `${btn} bg-gray-700 hover:bg-gray-600 text-gray-200`
const btnGreen = `${btn} bg-emerald-600 hover:bg-emerald-700 text-white`
const btnRed = `${btn} bg-red-600 hover:bg-red-700 text-white`
const btnOrange = `${btn} bg-orange-600 hover:bg-orange-700 text-white`
const btnYellow = `${btn} bg-amber-500 hover:bg-amber-600 text-black`
const btnBlue = `${btn} bg-blue-600 hover:bg-blue-700 text-white`
const btnPurple = `${btn} bg-purple-600 hover:bg-purple-700 text-white`

const HOB_COLORS = { empty: 'bg-gray-600', cooking: 'bg-pink-500', ready: 'bg-amber-400', burning: 'bg-red-600' }

function Panel({ title, children, className = '' }) {
  return (
    <div className={`bg-gray-800 rounded-lg p-3 border border-gray-700 ${className}`}>
      <h3 className="text-sm font-bold text-gray-300 mb-2">{title}</h3>
      {children}
    </div>
  )
}

function Toast({ message, type = 'info' }) {
  const colors = {
    ok: 'bg-emerald-900/90 text-emerald-200 border-emerald-700',
    error: 'bg-red-900/90 text-red-200 border-red-700',
    info: 'bg-cyan-900/90 text-cyan-200 border-cyan-700',
  }
  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded border text-xs font-mono animate-pulse ${colors[type] || colors.info}`}>
      {message}
    </div>
  )
}

// ── Main Dashboard ───────────────────────────────────────
export default function Dashboard() {
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [activeBlock, setActiveBlock] = useState(1)
  const [events, setEvents] = useState([])
  const [sessionState, setSessionState] = useState(null)
  const [logs, setLogs] = useState([])
  const [sseStatus, setSseStatus] = useState('disconnected')
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState({})
  const esRef = useRef(null)
  const activeSessionRef = useRef(null)

  // keep ref in sync for use in non-reactive callbacks
  useEffect(() => { activeSessionRef.current = activeSession }, [activeSession])

  const showToast = useCallback((message, type = 'info', duration = 2000) => {
    setToast({ message, type })
    setTimeout(() => setToast(null), duration)
  }, [])

  // ── API helper with proper error handling ──────────────
  const api = useCallback(async (path, opts = {}) => {
    try {
      const { headers: extraHeaders, ...rest } = opts
      const headers = { 'Content-Type': 'application/json', ...extraHeaders }
      const res = await fetch(`/api${path}`, { headers, ...rest })
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText)
        console.error(`API ${res.status} ${path}: ${text}`)
        showToast(`API error: ${res.status} ${path}`, 'error')
        return null
      }
      const data = await res.json()
      return data
    } catch (err) {
      console.error(`API ${path}:`, err)
      showToast(`Network error: ${path}`, 'error')
      return null
    }
  }, [showToast])

  // ── Refresh helpers ────────────────────────────────────
  const refreshSessions = useCallback(async () => {
    const d = await api('/admin/sessions')
    if (d) setSessions(d)
  }, [api])

  const refreshState = useCallback(async () => {
    const sid = activeSessionRef.current?.session_id
    if (!sid) return
    const d = await api(`/admin/session/${sid}/state`)
    if (d) setSessionState(d)
  }, [api])

  const refreshLogs = useCallback(async () => {
    const sid = activeSessionRef.current?.session_id
    if (!sid) return
    const d = await api(`/admin/logs/${sid}`)
    if (d) setLogs(d)
  }, [api])

  // ── Create session ─────────────────────────────────────
  const createSession = async () => {
    setLoading(l => ({ ...l, create: true }))
    const pid = `test_${Date.now().toString(36)}`
    const data = await api('/session/start', {
      method: 'POST',
      body: JSON.stringify({ participant_id: pid }),
    })
    setLoading(l => ({ ...l, create: false }))
    if (data) {
      setActiveSession(data)
      showToast(`Session ${data.session_id} created`, 'ok')
      await refreshSessions()
    }
  }

  // ── Fire SSE event ─────────────────────────────────────
  const fireEvent = useCallback(async (event, data = {}) => {
    const session = activeSessionRef.current
    if (!session) return showToast('Select a session first', 'error')
    if (sseStatus !== 'connected') {
      showToast('SSE not connected — event sent to backend only', 'info')
    }
    const result = await api('/admin/fire-event', {
      method: 'POST',
      body: JSON.stringify({ session_id: session.session_id, event, data }),
    })
    if (result) {
      showToast(`✓ ${event}`, 'ok', 1200)
    }
    refreshState()
  }, [api, refreshState, showToast, sseStatus])

  // ── Connect/Disconnect SSE ─────────────────────────────
  const connectSSE = useCallback(() => {
    const session = activeSessionRef.current
    if (!session) return showToast('Select a session first', 'error')

    // close previous
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }

    const url = `/api/session/${session.session_id}/block/${activeBlock}/stream?auto_start=false`
    console.log('[Dashboard] Connecting SSE:', url)
    setSseStatus('connecting')
    setEvents([])

    const es = new EventSource(url)
    esRef.current = es

    const ALL_EVENTS = [
      'steak_spawn', 'force_yellow_steak', 'trigger_appear', 'window_close',
      'reminder_fire', 'robot_neutral', 'fake_trigger_fire', 'message_bubble',
      'block_start', 'block_end', 'keepalive',
    ]

    ALL_EVENTS.forEach(type => {
      es.addEventListener(type, (e) => {
        let parsed = {}
        try { parsed = JSON.parse(e.data) } catch { parsed = { raw: e.data } }
        if (type === 'keepalive') return // don't clutter log
        setEvents(prev => [{ ts: new Date().toLocaleTimeString(), type, data: parsed }, ...prev].slice(0, 200))
      })
    })

    // also listen for generic messages (fallback)
    es.onmessage = (e) => {
      let parsed = {}
      try { parsed = JSON.parse(e.data) } catch { parsed = { raw: e.data } }
      setEvents(prev => [{ ts: new Date().toLocaleTimeString(), type: 'message', data: parsed }, ...prev].slice(0, 200))
    }

    es.onopen = () => {
      console.log('[Dashboard] SSE connected')
      setSseStatus('connected')
      setEvents(prev => [{ ts: new Date().toLocaleTimeString(), type: '🟢 CONNECTED', data: { url } }, ...prev])
      showToast('SSE connected', 'ok')
    }

    es.onerror = (err) => {
      console.error('[Dashboard] SSE error:', err)
      const readyState = es.readyState
      if (readyState === EventSource.CLOSED) {
        setSseStatus('disconnected')
        setEvents(prev => [{ ts: new Date().toLocaleTimeString(), type: '🔴 CLOSED', data: {} }, ...prev])
      } else {
        // CONNECTING state = auto-reconnecting
        setSseStatus('reconnecting')
        setEvents(prev => [{ ts: new Date().toLocaleTimeString(), type: '🟡 RECONNECTING', data: {} }, ...prev])
      }
    }
  }, [activeBlock, showToast])

  const disconnectSSE = () => {
    if (esRef.current) { esRef.current.close(); esRef.current = null }
    setSseStatus('disconnected')
    showToast('SSE disconnected', 'info')
  }

  // ── Effects ────────────────────────────────────────────
  useEffect(() => { refreshSessions() }, [refreshSessions])

  useEffect(() => {
    if (activeSession) {
      refreshState()
      refreshLogs()
    }
  }, [activeSession, refreshState, refreshLogs])

  useEffect(() => {
    if (!activeSession) return
    const timer = setInterval(() => {
      refreshState()
      refreshLogs()
    }, 3000)
    return () => clearInterval(timer)
  }, [activeSession, refreshState, refreshLogs])

  // cleanup SSE on unmount
  useEffect(() => { return () => { if (esRef.current) esRef.current.close() } }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-mono text-sm p-4">
      {toast && <Toast message={toast.message} type={toast.type} />}

      <div className="flex items-center gap-4 mb-4">
        <h1 className="text-xl font-bold text-cyan-400">🎛️ Saturday At Home — Dashboard</h1>
        <span className={`text-xs px-2 py-0.5 rounded ${
          sseStatus === 'connected' ? 'bg-green-900 text-green-300' :
          sseStatus === 'connecting' || sseStatus === 'reconnecting' ? 'bg-yellow-900 text-yellow-300' :
          sseStatus === 'error' ? 'bg-red-900 text-red-300' :
          'bg-gray-800 text-gray-500'
        }`}>SSE: {sseStatus}</span>
        <a href="/" className="text-xs text-gray-500 hover:text-gray-300 ml-auto">← Back to Game</a>
      </div>

      <div className="grid grid-cols-12 gap-3">
        {/* ── Left Column: Session ──────────────────────── */}
        <div className="col-span-3 space-y-3">
          <Panel title="📡 Session">
            <div className="flex gap-1 mb-2">
              <button onClick={createSession} disabled={loading.create}
                className={`${btnPrimary} flex-1`}>
                {loading.create ? '…' : '+ New'}
              </button>
              <button onClick={refreshSessions} className={btnSecondary}>↻</button>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {sessions.map(s => (
                <div key={s.session_id}
                  onClick={() => { setActiveSession(s); showToast(`Selected ${s.session_id}`, 'ok', 1000) }}
                  className={`p-2 rounded cursor-pointer text-xs ${
                    activeSession?.session_id === s.session_id
                      ? 'bg-cyan-900/50 border border-cyan-600' : 'bg-gray-800/50 hover:bg-gray-700'
                  }`}>
                  <div className="font-bold text-cyan-300">{s.session_id}</div>
                  <div className="text-gray-400">{s.participant_id} · G{s.latin_square_group || s.group}</div>
                </div>
              ))}
              {sessions.length === 0 && <p className="text-gray-600 text-xs">No sessions yet</p>}
            </div>
          </Panel>

          {activeSession && sessionState && (
            <Panel title="🔍 Live State">
              <div className="text-xs space-y-1">
                <div>SSE clients: <b className="text-cyan-400">{sessionState.sse_clients}</b></div>
                <div>Timelines: <b className="text-cyan-400">{sessionState.active_timelines?.length || 0}</b></div>
                <div className="mt-2 font-bold text-gray-400">Hobs:</div>
                {(sessionState.hobs || []).map(h => (
                  <div key={h.id} className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${HOB_COLORS[h.status] || 'bg-gray-600'}`} />
                    <span>Hob {h.id}: <b>{h.status}</b></span>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {activeSession && (
            <Panel title="⚙️ Quick Info">
              <div className="text-xs space-y-0.5 text-gray-400">
                <div>ID: <span className="text-gray-200">{activeSession.session_id}</span></div>
                <div>Participant: <span className="text-gray-200">{activeSession.participant_id}</span></div>
                <div>Group: <span className="text-gray-200">{activeSession.latin_square_group || activeSession.group}</span></div>
              </div>
            </Panel>
          )}
        </div>

        {/* ── Center: Event Controls ───────────────────── */}
        <div className="col-span-5 space-y-3">
          <Panel title="⏱️ Block & SSE Control">
            <div className="flex gap-2 items-center flex-wrap">
              <select value={activeBlock} onChange={e => setActiveBlock(Number(e.target.value))}
                className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs">
                {[1,2,3,4].map(n => <option key={n} value={n}>Block {n}</option>)}
              </select>
              <button onClick={connectSSE} className={btnPrimary}
                disabled={!activeSession}>📡 Connect</button>
              <button onClick={disconnectSSE} className={btnSecondary}
                disabled={sseStatus === 'disconnected'}>Disconnect</button>
              <button onClick={() => fireEvent('block_start', { block_number: activeBlock, condition: 'HighAF_HighCB' })}
                className={btnGreen} disabled={!activeSession}>▶ Start</button>
              <button onClick={() => fireEvent('block_end', { block_number: activeBlock })}
                className={btnRed} disabled={!activeSession}>⏹ End</button>
            </div>
            {!activeSession && (
              <p className="text-yellow-600 text-xs mt-1">⚠ Create or select a session first</p>
            )}
          </Panel>

          <Panel title="🥩 Steak Controls">
            <div className="grid grid-cols-3 gap-2">
              {[0,1,2].map(id => (
                <div key={id} className="space-y-1">
                  <div className="text-xs text-center text-gray-500">Hob {id}</div>
                  <button onClick={() => fireEvent('steak_spawn', { hob_id: id, duration: { cooking: 18000, ready: 6000 } })}
                    className={`${btnPrimary} w-full`} disabled={!activeSession}>Spawn</button>
                  <button onClick={() => fireEvent('force_yellow_steak', { hob_id: id })}
                    className={`${btnYellow} w-full`} disabled={!activeSession}>Force Yellow</button>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="📋 PM Task Controls">
            <PMControls fireEvent={fireEvent} activeBlock={activeBlock} disabled={!activeSession} />
          </Panel>

          <Panel title="🤖 Robot & 💬 Messages">
            <RobotMessageControls fireEvent={fireEvent} disabled={!activeSession} />
          </Panel>

          <Panel title="🚪 Fake Trigger">
            <div className="flex gap-2">
              <button onClick={() => fireEvent('fake_trigger_fire', { type: 'delivery' })}
                className={btnOrange} disabled={!activeSession}>🔔 Doorbell</button>
              <button onClick={() => fireEvent('fake_trigger_fire', { type: 'dishwasher' })}
                className={btnOrange} disabled={!activeSession}>🫧 Dishwasher</button>
              <button onClick={() => fireEvent('fake_trigger_fire', { type: 'friend_online' })}
                className={btnOrange} disabled={!activeSession}>👤 Friend Online</button>
            </div>
          </Panel>
        </div>

        {/* ── Right: Event Log ─────────────────────────── */}
        <div className="col-span-4 space-y-3">
          <Panel title={`📝 Live SSE Events (${events.filter(e => !e.type.includes('CONNECT') && !e.type.includes('ERROR') && !e.type.includes('CLOSED') && !e.type.includes('RECONNECT')).length})`} className="max-h-[45vh] overflow-y-auto">
            {events.length === 0 ? (
              <p className="text-gray-600 text-xs">
                {sseStatus === 'connected'
                  ? 'Connected ✓ — fire events using the controls on the left'
                  : 'Create a session → Connect SSE → fire events'}
              </p>
            ) : events.map((e, i) => (
              <div key={i} className="text-xs border-b border-gray-800/50 py-0.5 font-mono">
                <span className="text-gray-600">{e.ts}</span>
                <span className={`ml-2 font-bold ${
                  e.type.includes('CONNECT') ? 'text-green-400' :
                  e.type.includes('ERROR') || e.type.includes('CLOSED') ? 'text-red-400' :
                  e.type.includes('RECONNECT') ? 'text-yellow-400' :
                  e.type.includes('steak') || e.type.includes('yellow') ? 'text-pink-400' :
                  e.type.includes('trigger') || e.type.includes('window') ? 'text-orange-400' :
                  e.type.includes('robot') || e.type.includes('reminder') ? 'text-blue-400' :
                  e.type.includes('block') ? 'text-emerald-400' :
                  e.type.includes('message') ? 'text-purple-400' :
                  'text-gray-300'
                }`}>{e.type}</span>
                <span className="text-gray-500 ml-1">{JSON.stringify(e.data)}</span>
              </div>
            ))}
          </Panel>

          <Panel title="📊 Action Logs (DB)" className="max-h-[30vh] overflow-y-auto">
            <button onClick={refreshLogs} className={`${btnSecondary} mb-2`} disabled={!activeSession}>↻ Refresh</button>
            {logs.length === 0 ? (
              <p className="text-gray-600 text-xs">No logs yet</p>
            ) : logs.map((l, i) => (
              <div key={i} className="text-xs border-b border-gray-800/50 py-0.5">
                <span className="text-gray-600">{new Date(l.ts * 1000).toLocaleTimeString()}</span>
                <span className="ml-2 text-cyan-400 font-bold">{l.action_type}</span>
                {l.payload && <span className="text-gray-500 ml-1">{l.payload}</span>}
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────

function PMControls({ fireEvent, activeBlock, disabled }) {
  const taskMap = {
    1: ['medicine_a', 'medicine_b'],
    2: ['laundry_c', 'laundry_d'],
    3: ['comm_e', 'comm_f'],
    4: ['chores_g', 'chores_h'],
  }
  const tasks = taskMap[activeBlock] || taskMap[1]

  return (
    <div className="space-y-2">
      {tasks.map(taskId => {
        const slot = /[aceg]$/.test(taskId) ? 'A' : 'B'
        return (
          <div key={taskId} className="flex gap-2 items-center">
            <span className="text-xs text-gray-400 w-24 font-mono">{taskId}</span>
            <button onClick={() => fireEvent('trigger_appear', { task_id: taskId, slot })}
              className={btnOrange} disabled={disabled}>👁 Appear</button>
            <button onClick={() => fireEvent('window_close', { task_id: taskId, slot })}
              className={btnRed} disabled={disabled}>✕ Close</button>
          </div>
        )
      })}
    </div>
  )
}

function RobotMessageControls({ fireEvent, disabled }) {
  const [robotText, setRobotText] = useState('')

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input value={robotText} onChange={e => setRobotText(e.target.value)}
          placeholder="Robot says…" disabled={disabled}
          className="flex-1 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs disabled:opacity-40"
          onKeyDown={e => { if (e.key === 'Enter' && !disabled) { fireEvent('robot_neutral', { text: robotText || 'Hello!' }); setRobotText('') } }} />
        <button onClick={() => { fireEvent('robot_neutral', { text: robotText || 'Hello!' }); setRobotText('') }}
          className={btnBlue} disabled={disabled}>🤖 Say</button>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => fireEvent('reminder_fire', { text: 'Remember your medicine after dinner!', slot: 'A', condition: 'HighAF_HighCB' })}
          className={btnPurple} disabled={disabled}>💬 Reminder A</button>
        <button onClick={() => fireEvent('reminder_fire', { text: "Don't forget your vitamin!", slot: 'B', condition: 'HighAF_HighCB' })}
          className={btnPurple} disabled={disabled}>💬 Reminder B</button>
        <button onClick={() => fireEvent('message_bubble', { text: 'Hey! Coming tonight?', option_a: 'Yes!', option_b: 'Maybe later' })}
          className={btnGreen} disabled={disabled}>📬 Bubble</button>
      </div>
    </div>
  )
}
