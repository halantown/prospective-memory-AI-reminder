import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'

/**
 * WebSocket client hook for the state-driven timeline stream.
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
      room_transition: (d) => {
        useGameStore.getState().applyRoomTransition(d.room, d.activity, d.narrative)
      },
      robot_speak: (d) => {
        useGameStore.getState().triggerRobot(d.text)
      },
      reminder_fire: (d) => {
        useGameStore.getState().triggerRobot(d.full_text || d.text)

        const state = useGameStore.getState()
        fetch(`/api/session/${state.sessionId}/block/${state.blockNumber}/reminder-room`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slot: d.slot,
            room: d.room || state.currentRoom,
            activity: d.activity || state.currentActivity,
            client_ts: Date.now(),
          }),
        }).catch((err) => console.warn('[WS] reminder-room POST failed:', err))
      },
      trigger_appear: (d) => {
        useGameStore.getState().triggerAppear(d)
      },
      window_close: (d) => {
        useGameStore.getState().windowClose(d.task_id)
      },
      block_end: () => {
        useGameStore.getState().endBlock()
      },
      keepalive: () => {},
      block_start: () => {},
    }

    let closedByUser = false
    let retryCount = 0

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const url = `${protocol}://${window.location.host}/api/session/${sessionId}/block/${blockNumber}/stream?client=participant`

      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
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
          handler(data)
        } catch (err) {
          console.error('[WS] Failed to handle incoming message', err)
        }
      }

      ws.onerror = () => {
        // intentionally silent; reconnect handled in onclose
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
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (wsRef.current) wsRef.current.close()
      wsRef.current = null
      setSseConnected(false)
    }
  }, [sessionId, blockNumber, blockRunning, setSseConnected])
}
