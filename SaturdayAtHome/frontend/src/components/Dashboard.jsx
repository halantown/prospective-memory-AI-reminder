import { useCallback, useEffect, useRef, useState } from 'react'

const btn = 'px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-40'
const btnPrimary = `${btn} bg-cyan-600 hover:bg-cyan-700 text-white`
const btnSecondary = `${btn} bg-gray-700 hover:bg-gray-600 text-gray-200`
const btnGreen = `${btn} bg-emerald-600 hover:bg-emerald-700 text-white`
const btnOrange = `${btn} bg-orange-600 hover:bg-orange-700 text-white`

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

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  const showToast = useCallback((message, type = 'info', duration = 2000) => {
    setToast({ message, type })
    setTimeout(() => setToast(null), duration)
  }, [])

  const api = useCallback(async (path, opts = {}) => {
    try {
      const { headers: extraHeaders, ...rest } = opts
      const res = await fetch(`/api${path}`, {
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        ...rest,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText)
        showToast(`API ${res.status}: ${text.slice(0, 70)}`, 'error')
        return null
      }
      return await res.json()
    } catch {
      showToast(`Network error: ${path}`, 'error')
      return null
    }
  }, [showToast])

  useEffect(() => {
    api('/admin/active-session').then((s) => {
      if (!s) return
      setSession(s)
      showToast(s.live ? `Auto-connected: ${s.session_id}` : `Session found: ${s.session_id}`)
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

  const connectAdminStream = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${protocol}://${window.location.host}/api/admin/stream`
    setWsStatus('connecting')

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setWsStatus('connected')
      showToast('Admin stream connected', 'ok')
    }

    ws.onmessage = (msg) => {
      try {
        const payload = JSON.parse(msg.data)
        if (payload.event_type === 'keepalive') return
        setEvents((prev) => [
          { ts: new Date().toLocaleTimeString(), type: payload.event_type || 'event', data: payload },
          ...prev,
        ].slice(0, 200))
      } catch {
        // ignore malformed payload
      }
    }

    ws.onclose = () => setWsStatus('disconnected')
    ws.onerror = () => setWsStatus('reconnecting')
  }, [showToast])

  useEffect(() => () => wsRef.current?.close(), [])

  const forceBlock = useCallback(async () => {
    if (!sessionRef.current) return showToast('No session selected', 'error')
    const res = await api(`/admin/force-block/${sessionRef.current.session_id}/${blockNum}`, { method: 'POST' })
    if (res) showToast(`Block ${blockNum} started (${res.condition})`, 'ok')
  }, [api, blockNum, showToast])

  const fireRoomTransition = useCallback(async (room, activity) => {
    if (!sessionRef.current) return
    const res = await api('/admin/fire-event', {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionRef.current.session_id,
        event: 'room_transition',
        data: { room, activity, narrative: `Admin moved to ${room}` },
      }),
    })
    if (res) showToast(`room_transition -> ${room}`, 'ok', 1200)
  }, [api, showToast])

  const fireRobotSpeak = useCallback(async () => {
    if (!sessionRef.current) return
    const res = await api('/admin/fire-event', {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionRef.current.session_id,
        event: 'robot_speak',
        data: { text: 'You are doing great. Keep going.' },
      }),
    })
    if (res) showToast('robot_speak sent', 'ok', 1200)
  }, [api, showToast])

  const fireReminder = useCallback(async () => {
    if (!sessionRef.current) return
    const res = await api('/admin/fire-event', {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionRef.current.session_id,
        event: 'reminder_fire',
        data: {
          slot: 'A',
          task_id: 'medicine',
          text: 'Remember your planned task later today.',
          full_text: 'Quick pause from your current task — remember your planned task later today.',
          room: sessionState?.current_room || 'kitchen',
          activity: sessionState?.current_activity || 'recipe_following',
        },
      }),
    })
    if (res) showToast('reminder_fire sent', 'ok', 1200)
  }, [api, showToast, sessionState])

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-mono text-sm">
      {toast && <Toast message={toast.message} type={toast.type} />}

      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center gap-4">
        <h1 className="text-lg font-bold text-cyan-400">Experiment Dashboard (State-driven)</h1>
        <span className={`text-xs px-2 py-0.5 rounded ${
          wsStatus === 'connected'
            ? 'bg-green-900 text-green-300'
            : wsStatus === 'connecting' || wsStatus === 'reconnecting'
              ? 'bg-yellow-900 text-yellow-300'
              : 'bg-gray-700 text-gray-500'
        }`}>stream: {wsStatus}</span>

        {session && (
          <span className="text-xs text-gray-400">
            Participant: <b className="text-cyan-300">{session.participant_id}</b> · Session: <b className="text-cyan-300">{session.session_id}</b>
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
            <p className="text-lg mb-2">No active session</p>
            <button onClick={() => api('/admin/active-session').then((s) => s && setSession(s))} className={btnPrimary}>Retry</button>
          </div>
        </div>
      ) : (
        <div className="p-3 grid grid-cols-12 gap-3">
          <div className="col-span-4 space-y-3">
            <Panel title="Live state">
              <div className="text-xs space-y-1 text-gray-300">
                <div>Phase: <b className="text-cyan-300">{sessionState?.phase || '—'}</b></div>
                <div>Block: <b className="text-cyan-300">{sessionState?.current_block ?? '—'}</b></div>
                <div>Room: <b className="text-emerald-300">{sessionState?.current_room || '—'}</b></div>
                <div>Activity: <b className="text-emerald-300">{sessionState?.current_activity || '—'}</b></div>
                <div>Timer(s): <b className="text-cyan-300">{Math.floor(sessionState?.session_timer_s || 0)}</b></div>
                <div>WS clients: <b className="text-cyan-300">{sessionState?.ws_clients || 0}</b></div>
                {sessionState?.next_event && (
                  <div>Next event: <b className="text-amber-300">{sessionState.next_event.type}</b> @ {sessionState.next_event.at_s}s</div>
                )}
              </div>
            </Panel>

            <Panel title="Controls">
              <div className="flex gap-1 mb-2">
                <button onClick={connectAdminStream} className={btnPrimary}>Connect stream</button>
                <select value={blockNum} onChange={(e) => setBlockNum(Number(e.target.value))}
                  className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs">
                  {[1, 2, 3, 4].map((n) => <option key={n} value={n}>Block {n}</option>)}
                </select>
                <button onClick={forceBlock} className={btnGreen}>Force block</button>
              </div>

              <div className="text-[11px] text-gray-500 mb-1">Manual events</div>
              <div className="flex gap-1 flex-wrap">
                <button onClick={() => fireRoomTransition('kitchen', 'recipe_following')} className={btnSecondary}>Kitchen</button>
                <button onClick={() => fireRoomTransition('living_room', 'message_processing')} className={btnSecondary}>Living</button>
                <button onClick={() => fireRoomTransition('balcony', 'household_checks')} className={btnSecondary}>Balcony</button>
                <button onClick={() => fireRoomTransition('entrance', 'item_management')} className={btnSecondary}>Entrance</button>
                <button onClick={fireRobotSpeak} className={btnOrange}>Robot speak</button>
                <button onClick={fireReminder} className={btnOrange}>Reminder</button>
              </div>
            </Panel>
          </div>

          <div className="col-span-4">
            <Panel title={`Admin events (${events.length})`} className="h-[calc(100vh-90px)] overflow-y-auto">
              {events.length === 0 ? (
                <p className="text-gray-600 text-xs">No admin-stream events yet.</p>
              ) : events.map((e, i) => (
                <div key={i} className="text-xs border-b border-gray-800/50 py-1 font-mono">
                  <span className="text-gray-600">{e.ts}</span>
                  <span className="ml-2 text-cyan-300 font-bold">{e.type}</span>
                </div>
              ))}
            </Panel>
          </div>

          <div className="col-span-4">
            <Panel title="Action logs" className="h-[calc(100vh-90px)] overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-gray-600 text-xs">No logs yet.</p>
              ) : logs.map((l, i) => (
                <div key={i} className="text-xs border-b border-gray-800/50 py-1 font-mono">
                  <span className="text-gray-600">{new Date(l.ts * 1000).toLocaleTimeString()}</span>
                  <span className="ml-2 text-emerald-300 font-bold">{l.action_type}</span>
                  {l.payload && <span className="ml-1 text-gray-500">{l.payload.slice(0, 80)}</span>}
                </div>
              ))}
            </Panel>
          </div>
        </div>
      )}
    </div>
  )
}
