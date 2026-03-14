import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'

/**
 * WebSocket client hook — connects to backend event stream and maps
 * pushed events to Zustand store actions.
 *
 * Only connects when sessionId + blockNumber are set and blockRunning is true.
 * In demo mode (no sessionId), this hook does nothing.
 */
export default function useWebSocket() {
  const sessionId = useGameStore((s) => s.sessionId)
  const blockNumber = useGameStore((s) => s.blockNumber)
  const blockRunning = useGameStore((s) => s.blockRunning)
  const setSseConnected = useGameStore((s) => s.setSseConnected)
  const wsRef = useRef(null)
  const reconnectTimerRef = useRef(null)

  useEffect(() => {
    if (!sessionId || !blockNumber || !blockRunning) return

    const eventHandlers = {
      steak_spawn:        (d) => useGameStore.getState().spawnSteak(d.hob_id, d.duration),
      force_yellow_steak: (d) => useGameStore.getState().forceYellowSteak(d.hob_id),
      trigger_appear:     (d) => useGameStore.getState().triggerAppear(d.task_id),
      window_close:       (d) => useGameStore.getState().windowClose(d.task_id),
      reminder_fire:      (d) => {
        useGameStore.getState().triggerRobot(d.text)
        // LOG-1: Report participant's current room when reminder plays
        const state = useGameStore.getState()
        fetch(`/api/session/${state.sessionId}/block/${state.blockNumber}/reminder-room`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slot: d.slot,
            room: state.activeRoom,
            client_ts: Date.now(),
          }),
        }).catch(err => console.warn('[WS] reminder-room POST failed:', err))
      },
      robot_neutral:      (d) => useGameStore.getState().triggerRobot(d.text),
      fake_trigger_fire:  (d) => useGameStore.getState().triggerFake(d.type),
      message_bubble:     (d) => useGameStore.getState().addMessageBubble(d),
      plant_needs_water:  ()  => useGameStore.getState().showPlantNeedsWater(),
      block_start:        (d) => console.log('[WS] block_start', d),
      block_end:          (d) => useGameStore.getState().endBlock(),
      keepalive:          ()  => {},
    }

    let closedByUser = false
    let retryCount = 0

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const url = `${protocol}://${window.location.host}/api/session/${sessionId}/block/${blockNumber}/stream`
      console.log('[WS] Connecting to', url)

      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[WS] Connected')
        retryCount = 0
        setSseConnected(true)
      }

      ws.onmessage = (message) => {
        try {
          const payload = JSON.parse(message.data)
          const event = payload?.event
          const data = payload?.data ?? {}
          if (!event) return
          const handler = eventHandlers[event]
          if (!handler) return
          console.log(`[WS] ← ${event}`, data)
          handler(data)
        } catch (err) {
          console.error('[WS] Failed to handle incoming message', err)
        }
      }

      ws.onerror = (e) => {
        console.warn('[WS] Connection error', e)
      }

      ws.onclose = () => {
        setSseConnected(false)
        if (closedByUser) return
        const delay = Math.min(5000, 500 * (2 ** retryCount))
        retryCount += 1
        reconnectTimerRef.current = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      closedByUser = true
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
      wsRef.current = null
      setSseConnected(false)
    }
  }, [sessionId, blockNumber, blockRunning, setSseConnected])
}
