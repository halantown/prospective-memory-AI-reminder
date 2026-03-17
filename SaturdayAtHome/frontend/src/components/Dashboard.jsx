import { useState, useEffect, useRef, useCallback } from 'react'

const btn = 'px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-40'
const btnPrimary = `${btn} bg-cyan-600 hover:bg-cyan-700 text-white`
const btnSecondary = `${btn} bg-gray-700 hover:bg-gray-600 text-gray-200`
const btnGreen = `${btn} bg-emerald-600 hover:bg-emerald-700 text-white`
const btnRed = `${btn} bg-red-600 hover:bg-red-700 text-white`
const btnOrange = `${btn} bg-orange-600 hover:bg-orange-700 text-white`
const btnBlue = `${btn} bg-blue-600 hover:bg-blue-700 text-white`
const btnPurple = `${btn} bg-purple-600 hover:bg-purple-700 text-white`

const PM_TASKS = {
  1: [{ id: 'medicine', slot: 'A' }, { id: 'tea', slot: 'B' }],
  2: [{ id: 'laundry', slot: 'A' }, { id: 'book', slot: 'B' }],
  3: [{ id: 'pot', slot: 'A' }, { id: 'umbrella', slot: 'B' }],
  4: [{ id: 'tv', slot: 'A' }, { id: 'coat', slot: 'B' }],
}

const fmtDuration = (seconds = 0) => {
  const total = Math.max(0, Math.floor(seconds))
  const m = String(Math.floor(total / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
}

const EVENT_COLORS = {
  game_start: 'text-emerald-400',
  game_end: 'text-emerald-400',
  block_start: 'text-emerald-400',
  block_end: 'text-emerald-400',
  trigger_fire: 'text-orange-400',
  window_close: 'text-orange-400',
  reminder_fire: 'text-blue-400',
  robot_speak: 'text-blue-400',
  ambient_pulse: 'text-yellow-400',
  room_transition: 'text-purple-400',
  mcq_data: 'text-orange-300',
  mcq_result: 'text-orange-300',
}

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
    <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded border text-xs font-mono ${colors[type] || colors.info}`}>
      {message}
    </div>
  )
}

export default function Dashboard() {
  const [session, setSession] = useState(null)
  const [sessionState, setSessionState] = useState(null)
  const [events, setEvents] = useState([])
  const [logs, setLogs] = useState([])
  const [wsStatus, setWsStatus] = useState('disconnected')
  const [toast, setToast] = useState(null)
  const [blockNum, setBlockNum] = useState(1)
  const wsRef = useRef(null)
  const sessionRef = useRef(null)

  useEffect(() => { sessionRef.current = session }, [session])

  const showToast = useCallback((message, type = 'info', duration = 2000) => {
    setToast({ message, type })
    setTimeout(() => setToast(null), duration)
  }, [])

  const api = useCallback(async (path, opts = {}) => {
    try {
      const { headers: extraHeaders, ...rest } = opts
      const res = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json', ...extraHeaders }, ...rest })
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText)
        showToast(`API ${res.status}: ${text.slice(0, 60)}`, 'error')
        return null
      }
      return await res.json()
    } catch (err) {
      showToast(`Network error: ${path}`, 'error')
      return null
    }
  }, [showToast])

  useEffect(() => {
    api('/admin/active-session').then((s) => {
      if (s) {
        setSession(s)
        const msg = s.live ? `Auto-connected: ${s.session_id}` : `Session found (no live client): ${s.session_id}`
        showToast(msg, s.live ? 'ok' : 'info')
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!session) return
    const refresh = async () => {
      const [state, logData] = await Promise.all([
        api(`/admin/session/${session.session_id}/state`),
        api(`/admin/logs/${session.session_id}`),
      ])
      if (state) setSessionState(state)
      if (logData) setLogs(logData)
    }
    refresh()
    const timer = setInterval(refresh, 2000)
    return () => clearInterval(timer)
  }, [session, api])

  const connectWS = useCallback(() => {
    if (!sessionRef.current) return
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null }

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${protocol}://${window.location.host}/api/session/${sessionRef.current.session_id}/block/${blockNum}/stream?auto_start=false&client=dashboard`
    setWsStatus('connecting')

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setWsStatus('connected')
      setEvents(prev => [{ ts: new Date().toLocaleTimeString(), type: '🟢 CONNECTED', data: {} }, ...prev])
      showToast('WS connected', 'ok')
    }

    ws.onmessage = (msg) => {
      let payload = {}
      try { payload = JSON.parse(msg.data) } catch { payload = { event: 'unknown', data: { raw: msg.data } } }
      const type = payload.event || payload.event_type || 'unknown'
      const data = payload.data || payload
      if (type === 'keepalive') return
      setEvents(prev => [{ ts: new Date().toLocaleTimeString(), type, data }, ...prev].slice(0, 200))
    }

    ws.onerror = () => { setWsStatus('reconnecting') }
    ws.onclose = () => { setWsStatus('disconnected') }
  }, [blockNum, showToast])

  useEffect(() => { return () => { if (wsRef.current) wsRef.current.close() } }, [])

  useEffect(() => {
    if (session && session.live && wsStatus === 'disconnected') connectWS()
  }, [session, wsStatus, connectWS])

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-mono text-sm">
      {toast && <Toast message={toast.message} type={toast.type} />}

      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center gap-4">
        <h1 className="text-lg font-bold text-cyan-400">🔬 Experiment Observer</h1>
        <span className={`text-xs px-2 py-0.5 rounded ${
          wsStatus === 'connected' ? 'bg-green-900 text-green-300' :
          wsStatus === 'connecting' || wsStatus === 'reconnecting' ? 'bg-yellow-900 text-yellow-300' :
          'bg-gray-700 text-gray-500'
        }`}>WS: {wsStatus}</span>
        {session && (
          <span className="text-xs text-gray-400">
            Participant: <b className="text-cyan-300">{session.participant_id}</b> ·
            Session: <b className="text-cyan-300">{session.session_id}</b> ·
            Group: <b className="text-cyan-300">{session.latin_square_group || session.group}</b> ·
            Phase: <b className="text-cyan-300">{session.phase || '—'}</b>
            {!session.live && <span className="ml-2 text-amber-400">(no live client)</span>}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <a href="/" className="text-xs text-gray-500 hover:text-gray-300">Game</a>
          <a href="/manage" className="text-xs text-gray-500 hover:text-gray-300">Manage</a>
        </div>
      </div>

      {!session ? (
        <div className="flex items-center justify-center h-[80vh] text-gray-500">
          <div className="text-center">
            <p className="text-lg mb-2">No active session detected</p>
            <p className="text-xs">Start the game from the <a href="/" className="text-cyan-400 underline">main page</a> first</p>
            <button onClick={() => api('/admin/active-session').then(s => s && setSession(s))}
              className={`${btnPrimary} mt-4`}>↻ Retry</button>
          </div>
        </div>
      ) : (
        <div className="p-3 grid grid-cols-12 gap-3">
          {/* Left: Session + Controls */}
          <div className="col-span-3 space-y-3">
            <Panel title="📋 Session">
              <div className="text-xs space-y-1 text-gray-400">
                <div>WS clients: <b className="text-cyan-400">{sessionState?.ws_clients || 0}</b></div>
                <div>Participant: <b className={sessionState?.is_online ? 'text-emerald-400' : 'text-gray-500'}>{sessionState?.is_online ? 'online' : 'offline'}</b></div>
                <div>Timer: <b className="text-cyan-300">{fmtDuration(sessionState?.session_timer_s || 0)}</b></div>
                <div>Block: <b className="text-cyan-400">{session.current_block ?? '—'}</b></div>
                <div>Active timelines: <b className="text-cyan-400">{sessionState?.active_timelines?.length || 0}</b></div>
              </div>
            </Panel>

            <Panel title="🎛️ Block Controls">
              <div className="space-y-2">
                <div className="flex gap-1 items-center">
                  <select value={blockNum} onChange={e => setBlockNum(Number(e.target.value))}
                    className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs">
                    {[1,2,3,4].map(n => <option key={n} value={n}>Block {n}</option>)}
                  </select>
                  <button onClick={connectWS} className={btnPrimary}>📡 WS</button>
                </div>
                <button
                  onClick={async () => {
                    if (!sessionRef.current) return showToast('No session', 'error')
                    const ok = window.confirm(`Force-start Block ${blockNum} timeline?`)
                    if (!ok) return
                    const res = await api(`/admin/force-block/${sessionRef.current.session_id}/${blockNum}`, { method: 'POST' })
                    if (res) showToast(`⚡ Block ${blockNum} started (${res.condition})`, 'ok', 3000)
                  }}
                  className={`${btnOrange} w-full text-xs`}
                >
                  ⚡ Force-Start Block {blockNum}
                </button>
              </div>
            </Panel>

            <Panel title="🧠 PM Tasks (Block)">
              <div className="space-y-1">
                {(PM_TASKS[blockNum] || []).map(t => (
                  <div key={t.id} className="flex gap-1 items-center">
                    <span className="text-[10px] text-gray-500 w-16 font-mono truncate">{t.id}</span>
                    <span className="text-[10px] text-gray-600">slot {t.slot}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[10px] text-gray-600">
                Timeline: reminder → trigger (30s window) → auto-score
              </div>
            </Panel>

            <Panel title="🤖 Block Timeline">
              <div className="text-[10px] text-gray-500 space-y-0.5">
                <div>0:00 — Game A start (semantic cat)</div>
                <div className="text-blue-400">1:00 — Reminder A</div>
                <div className="text-orange-400">2:30 — Trigger A (30s window)</div>
                <div>3:00 — Game A end → Transition</div>
                <div>3:30 — Game B start (go/no-go)</div>
                <div className="text-blue-400">4:30 — Reminder B</div>
                <div className="text-orange-400">6:00 — Trigger B (30s window)</div>
                <div>6:30 — Game B end → Transition</div>
                <div>7:00 — Game C start (trivia buffer)</div>
                <div>8:00 — Game C end</div>
                <div className="text-emerald-400">8:30 — Block end</div>
              </div>
            </Panel>
          </div>

          {/* Center: Live Events */}
          <div className="col-span-5">
            <Panel title={`📡 Live Events (${events.filter(e => !e.type.includes('CONNECT')).length})`} className="h-[calc(100vh-80px)] overflow-y-auto">
              {events.length === 0 ? (
                <p className="text-gray-600 text-xs">Waiting for events…</p>
              ) : events.map((e, i) => (
                <div key={i} className="text-xs border-b border-gray-800/50 py-1 font-mono">
                  <span className="text-gray-600">{e.ts}</span>
                  <span className={`ml-2 font-bold ${
                    e.type.includes('CONNECT') ? 'text-green-400' :
                    EVENT_COLORS[e.type] || 'text-gray-300'
                  }`}>{e.type}</span>
                  <span className="text-gray-500 ml-1">{JSON.stringify(e.data).slice(0, 120)}</span>
                </div>
              ))}
            </Panel>
          </div>

          {/* Right: Action Logs */}
          <div className="col-span-4">
            <Panel title="📊 Action Logs (DB)" className="h-[calc(100vh-80px)] overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-gray-600 text-xs">No logged actions yet</p>
              ) : logs.map((l, i) => {
                const isPm = ['trigger_click', 'mcq_answer', 'encoding_confirm'].includes(l.action_type)
                let scoreInfo = null
                if (l.payload) {
                  try {
                    const p = JSON.parse(l.payload)
                    if (p.score !== undefined) scoreInfo = p.score
                  } catch {}
                }
                return (
                  <div key={i} className="text-xs border-b border-gray-800/50 py-1 font-mono">
                    <span className="text-gray-600">{new Date(l.ts * 1000).toLocaleTimeString()}</span>
                    <span className={`ml-2 font-bold ${isPm ? 'text-orange-400' : 'text-cyan-400'}`}>{l.action_type}</span>
                    {scoreInfo !== null && (
                      <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        scoreInfo === 2 ? 'bg-green-900 text-green-300' :
                        scoreInfo === 1 ? 'bg-yellow-900 text-yellow-300' :
                        'bg-red-900 text-red-300'
                      }`}>score:{scoreInfo}</span>
                    )}
                    {l.payload && <span className="text-gray-500 ml-1 break-all">{l.payload.slice(0, 80)}</span>}
                  </div>
                )
              })}
            </Panel>
          </div>
        </div>
      )}
    </div>
  )
}
