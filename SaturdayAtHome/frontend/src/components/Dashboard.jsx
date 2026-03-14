import { useState, useEffect, useRef, useCallback } from 'react'

const btn = 'px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-40'
const btnPrimary = `${btn} bg-cyan-600 hover:bg-cyan-700 text-white`
const btnSecondary = `${btn} bg-gray-700 hover:bg-gray-600 text-gray-200`
const btnGreen = `${btn} bg-emerald-600 hover:bg-emerald-700 text-white`
const btnRed = `${btn} bg-red-600 hover:bg-red-700 text-white`
const btnOrange = `${btn} bg-orange-600 hover:bg-orange-700 text-white`
const btnYellow = `${btn} bg-amber-500 hover:bg-amber-600 text-black`
const btnBlue = `${btn} bg-blue-600 hover:bg-blue-700 text-white`
const btnPurple = `${btn} bg-purple-600 hover:bg-purple-700 text-white`

const HOB_COLORS = { empty: 'bg-gray-600', cooking: 'bg-pink-500', ready: 'bg-amber-400 animate-pulse', burning: 'bg-red-600 animate-ping' }
const HOB_TEXT = { empty: 'text-gray-500', cooking: 'text-pink-300', ready: 'text-amber-300', burning: 'text-red-300' }

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

function HobIndicator({ hob }) {
  const progress = hob.status === 'cooking' && hob.started_at > 0
    ? Math.min(100, ((Date.now() / 1000 - hob.started_at) / (hob.cooking_ms / 1000)) * 100)
    : hob.status === 'ready' && hob.started_at > 0
    ? Math.min(100, ((Date.now() / 1000 - hob.started_at) / (hob.ready_ms / 1000)) * 100)
    : 0

  return (
    <div className="bg-gray-900 rounded-lg p-2 text-center">
      <div className="flex items-center justify-center gap-2 mb-1">
        <span className={`w-3 h-3 rounded-full ${HOB_COLORS[hob.status] || 'bg-gray-600'}`} />
        <span className={`text-xs font-bold ${HOB_TEXT[hob.status] || 'text-gray-500'}`}>
          Hob {hob.id}
        </span>
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{hob.status}</div>
      {(hob.status === 'cooking' || hob.status === 'ready') && (
        <div className="w-full h-1 bg-gray-700 rounded mt-1">
          <div className={`h-full rounded transition-all ${hob.status === 'cooking' ? 'bg-pink-500' : 'bg-amber-400'}`}
            style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [session, setSession] = useState(null)
  const [sessionState, setSessionState] = useState(null)
  const [events, setEvents] = useState([])
  const [logs, setLogs] = useState([])
  const [sseStatus, setSseStatus] = useState('disconnected')
  const [toast, setToast] = useState(null)
  const [blockNum, setBlockNum] = useState(1)
  const esRef = useRef(null)
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

  // Auto-detect active session on load
  useEffect(() => {
    api('/admin/active-session').then((s) => {
      if (s) {
        setSession(s)
        const msg = s.live ? `Auto-connected: ${s.session_id}` : `Session found (no live client): ${s.session_id}`
        showToast(msg, s.live ? 'ok' : 'info')
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh state & logs every 2s
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

  // SSE connection
  const connectSSE = useCallback(() => {
    if (!sessionRef.current) return
    if (esRef.current) { esRef.current.close(); esRef.current = null }

    const url = `/api/session/${sessionRef.current.session_id}/block/${blockNum}/stream?auto_start=false`
    setSseStatus('connecting')

    const es = new EventSource(url)
    esRef.current = es

    const ALL_EVENTS = [
      'steak_spawn', 'force_yellow_steak', 'trigger_appear', 'window_close',
      'reminder_fire', 'robot_neutral', 'fake_trigger_fire', 'message_bubble',
      'plant_needs_water', 'block_start', 'block_end', 'keepalive',
    ]

    ALL_EVENTS.forEach(type => {
      es.addEventListener(type, (e) => {
        let parsed = {}
        try { parsed = JSON.parse(e.data) } catch { parsed = { raw: e.data } }
        if (type === 'keepalive') return
        setEvents(prev => [{ ts: new Date().toLocaleTimeString(), type, data: parsed }, ...prev].slice(0, 200))
      })
    })

    es.onopen = () => {
      setSseStatus('connected')
      setEvents(prev => [{ ts: new Date().toLocaleTimeString(), type: '🟢 CONNECTED', data: {} }, ...prev])
      showToast('SSE connected', 'ok')
    }

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setSseStatus('disconnected')
      } else {
        setSseStatus('reconnecting')
      }
    }
  }, [blockNum, showToast])

  useEffect(() => { return () => { if (esRef.current) esRef.current.close() } }, [])

  // Auto-connect SSE only when a live participant is detected
  useEffect(() => {
    if (session && session.live && sseStatus === 'disconnected') connectSSE()
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  const fireEvent = useCallback(async (event, data = {}) => {
    if (!sessionRef.current) return showToast('No session', 'error')
    const result = await api('/admin/fire-event', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionRef.current.session_id, event, data }),
    })
    if (result) showToast(`✓ ${event}`, 'ok', 1200)
  }, [api, showToast])

  const hobs = sessionState?.hobs || []

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-mono text-sm">
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center gap-4">
        <h1 className="text-lg font-bold text-cyan-400">🔬 Experiment Observer</h1>
        <span className={`text-xs px-2 py-0.5 rounded ${
          sseStatus === 'connected' ? 'bg-green-900 text-green-300' :
          sseStatus === 'connecting' || sseStatus === 'reconnecting' ? 'bg-yellow-900 text-yellow-300' :
          'bg-gray-700 text-gray-500'
        }`}>SSE: {sseStatus}</span>
        {session && (
          <span className="text-xs text-gray-400">
            Participant: <b className="text-cyan-300">{session.participant_id}</b> ·
            Session: <b className="text-cyan-300">{session.session_id}</b> ·
            Group: <b className="text-cyan-300">{session.latin_square_group || session.group}</b>
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
          {/* Left: Live Status */}
          <div className="col-span-3 space-y-3">
            {/* Hob Monitor */}
            <Panel title="🍳 Kitchen Monitor">
              <div className="grid grid-cols-3 gap-2">
                {hobs.map(h => <HobIndicator key={h.id} hob={h} />)}
              </div>
            </Panel>

            {/* Session Info */}
            <Panel title="📋 Session">
              <div className="text-xs space-y-1 text-gray-400">
                <div>SSE clients: <b className="text-cyan-400">{sessionState?.sse_clients || 0}</b></div>
                <div>Active timelines: <b className="text-cyan-400">{sessionState?.active_timelines?.length || 0}</b></div>
              </div>
            </Panel>

            {/* Controls */}
            <Panel title="🎛️ Controls">
              <div className="space-y-2">
                <div className="flex gap-1 items-center">
                  <select value={blockNum} onChange={e => setBlockNum(Number(e.target.value))}
                    className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs">
                    {[1,2,3,4].map(n => <option key={n} value={n}>Block {n}</option>)}
                  </select>
                  <button onClick={connectSSE} className={btnPrimary}>📡 SSE</button>
                  <button onClick={() => fireEvent('block_start', { block_number: blockNum, condition: 'HighAF_HighCB' })}
                    className={btnGreen}>▶</button>
                  <button onClick={() => fireEvent('block_end', { block_number: blockNum })}
                    className={btnRed}>⏹</button>
                </div>
                {/* Super-admin: force-start the full timeline for this block */}
                <div className="border-t border-gray-700 pt-2">
                  <button
                    onClick={async () => {
                      if (!sessionRef.current) return showToast('No session', 'error')
                      const ok = window.confirm(`Force-start Block ${blockNum} timeline?\nThis resets hobs/windows and launches the scheduler.`)
                      if (!ok) return
                      const res = await api(`/admin/force-block/${sessionRef.current.session_id}/${blockNum}`, { method: 'POST' })
                      if (res) showToast(`⚡ Block ${blockNum} started (${res.condition})`, 'ok', 3000)
                    }}
                    className={`${btnOrange} w-full text-xs`}
                  >
                    ⚡ Force-Start Block {blockNum}
                  </button>
                </div>
                <div className="text-[10px] text-gray-600">Steak:</div>
                <div className="grid grid-cols-3 gap-1">
                  {[0,1,2].map(id => (
                    <div key={id} className="space-y-1">
                      <button onClick={() => fireEvent('steak_spawn', { hob_id: id, duration: { cooking: 18000, ready: 6000 } })}
                        className={`${btnPrimary} w-full text-[10px]`}>🥩{id}</button>
                      <button onClick={() => fireEvent('force_yellow_steak', { hob_id: id })}
                        className={`${btnYellow} w-full text-[10px]`}>⚡{id}</button>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-gray-600">PM Tasks:</div>
                <PMControls fireEvent={fireEvent} activeBlock={blockNum} />
                <div className="text-[10px] text-gray-600">Robot/Messages:</div>
                <RobotMessageControls fireEvent={fireEvent} />
                <div className="flex gap-1 flex-wrap">
                  <button onClick={() => fireEvent('fake_trigger_fire', { type: 'delivery' })}
                    className={`${btnOrange} text-[10px]`}>🔔</button>
                  <button onClick={() => fireEvent('fake_trigger_fire', { type: 'dishwasher' })}
                    className={`${btnOrange} text-[10px]`}>🫧</button>
                  <button onClick={() => fireEvent('fake_trigger_fire', { type: 'friend_online' })}
                    className={`${btnOrange} text-[10px]`}>👤</button>
                </div>
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
          </div>

          {/* Right: Action Logs */}
          <div className="col-span-4">
            <Panel title="📊 Action Logs (DB)" className="h-[calc(100vh-80px)] overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-gray-600 text-xs">No logged actions yet</p>
              ) : logs.map((l, i) => {
                const isPm = l.action_type === 'pm_action'
                const isSteak = l.action_type === 'steak_action'
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
                    <span className={`ml-2 font-bold ${
                      isPm ? 'text-orange-400' : isSteak ? 'text-pink-400' : 'text-cyan-400'
                    }`}>{l.action_type}</span>
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

function PMControls({ fireEvent, activeBlock }) {
  const taskMap = {
    1: ['medicine_a', 'medicine_b'],
    2: ['laundry_c', 'laundry_d'],
    3: ['comm_e', 'comm_f'],
    4: ['chores_g', 'chores_h'],
  }
  const tasks = taskMap[activeBlock] || taskMap[1]
  return (
    <div className="space-y-1">
      {tasks.map(taskId => {
        const slot = /[aceg]$/.test(taskId) ? 'A' : 'B'
        return (
          <div key={taskId} className="flex gap-1 items-center">
            <span className="text-[10px] text-gray-500 w-20 font-mono truncate">{taskId}</span>
            <button onClick={() => fireEvent('trigger_appear', { task_id: taskId, slot, window_ms: 30000 })}
              className={`${btnOrange} text-[10px]`}>👁</button>
            <button onClick={() => fireEvent('window_close', { task_id: taskId, slot })}
              className={`${btnRed} text-[10px]`}>✕</button>
          </div>
        )
      })}
    </div>
  )
}

function RobotMessageControls({ fireEvent }) {
  const [text, setText] = useState('')
  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Say…"
          className="flex-1 bg-gray-900 border border-gray-600 rounded px-2 py-0.5 text-[10px]"
          onKeyDown={e => { if (e.key === 'Enter') { fireEvent('robot_neutral', { text: text || 'Hello!' }); setText('') } }} />
        <button onClick={() => { fireEvent('robot_neutral', { text: text || 'Hello!' }); setText('') }}
          className={`${btnBlue} text-[10px]`}>🤖</button>
      </div>
      <div className="flex gap-1 flex-wrap">
        <button onClick={() => fireEvent('reminder_fire', { text: 'Remember your medicine!', slot: 'A', condition: 'HighAF_HighCB' })}
          className={`${btnPurple} text-[10px]`}>💬A</button>
        <button onClick={() => fireEvent('reminder_fire', { text: "Don't forget vitamins!", slot: 'B', condition: 'HighAF_HighCB' })}
          className={`${btnPurple} text-[10px]`}>💬B</button>
        <button onClick={() => fireEvent('message_bubble', { from: 'Sarah', subject: 'Test', body: 'Test email!', option_a: 'Yes!', option_b: 'No', avatar: 'S' })}
          className={`${btnGreen} text-[10px]`}>📬</button>
      </div>
    </div>
  )
}
