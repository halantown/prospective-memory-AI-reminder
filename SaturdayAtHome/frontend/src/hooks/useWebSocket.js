import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'

export default function useWebSocket() {
  const sessionId = useGameStore(s => s.sessionId)
  const blockNumber = useGameStore(s => s.blockNumber)
  const phase = useGameStore(s => s.phase)
  const setWsConnected = useGameStore(s => s.setWsConnected)
  const setWsReconnecting = useGameStore(s => s.setWsReconnecting)
  const setWsSend = useGameStore(s => s.setWsSend)
  const wsRef = useRef(null)
  const reconnectRef = useRef(null)

  useEffect(() => {
    if (!sessionId || !blockNumber || !['encoding', 'playing', 'questionnaire', 'complete'].includes(phase)) return

    // Validate block number range
    if (blockNumber < 1 || blockNumber > 4) {
      console.error(`[WS] Invalid block number: ${blockNumber}`)
      return
    }

    const eventHandlers = {
      game_start: (d) => useGameStore.getState().handleGameStart(d),
      game_end: () => useGameStore.getState().handleGameEnd(),
      room_transition: (d) => useGameStore.getState().handleRoomTransition(d),
      reminder_fire: (d) => useGameStore.getState().handleRobotSpeak({ ...d, type: 'reminder' }),
      robot_speak: (d) => useGameStore.getState().handleRobotSpeak({ ...d, type: 'neutral' }),
      trigger_fire: (d) => useGameStore.getState().handleTriggerFire(d),
      window_close: (d) => useGameStore.getState().handleWindowClose(d),
      ambient_pulse: (d) => useGameStore.getState().handleAmbientPulse(d),
      block_start: (d) => console.log('[WS] block_start', d),
      block_end: () => useGameStore.getState().handleBlockEnd(),
      mcq_data: (d) => useGameStore.getState().showMCQ(d),
      mcq_result: (d) => console.log('[WS] mcq_result', d),
      encoding_ack: () => {},
      questionnaire_ack: () => {},
      ongoing_ack: () => {},
      keepalive: () => {},
    }

    let closedByUser = false
    let retryCount = 0

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const autoStart = phase === 'playing'
      // Build WS URL from current location (works behind reverse proxies)
      const baseUrl = `${protocol}://${window.location.host}`
      const url = `${baseUrl}/api/session/${sessionId}/block/${blockNumber}/stream?client=participant&auto_start=${autoStart}`

      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        retryCount = 0
        setWsConnected(true)
        setWsReconnecting(false)
        setWsSend((msg) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg))
          }
        })
      }

      ws.onmessage = (message) => {
        try {
          const payload = JSON.parse(message.data)
          const event = payload?.event
          const data = payload?.data ?? {}
          if (!event) return
          const handler = eventHandlers[event]
          if (handler) handler(data)
        } catch (err) {
          console.error('[WS] Failed to handle message', err)
        }
      }

      ws.onerror = (e) => console.warn('[WS] Error', e)

      ws.onclose = () => {
        setWsConnected(false)
        setWsSend(null)
        if (closedByUser) return
        setWsReconnecting(true)
        const delay = Math.min(5000, 500 * (2 ** retryCount))
        retryCount++
        reconnectRef.current = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      closedByUser = true
      clearTimeout(reconnectRef.current)
      if (wsRef.current) wsRef.current.close()
      wsRef.current = null
      setWsConnected(false)
      setWsReconnecting(false)
      setWsSend(null)
    }
  }, [sessionId, blockNumber, phase, setWsConnected, setWsReconnecting, setWsSend])

  // Heartbeat every 10s
  useEffect(() => {
    if (!sessionId) return
    const timer = setInterval(() => {
      const s = useGameStore.getState().wsSend
      if (s) s({ type: 'heartbeat' })
    }, 10000)
    return () => clearInterval(timer)
  }, [sessionId])

  // Flush ongoing responses every 5s (single timer — no duplicate in GameShell)
  useEffect(() => {
    const timer = setInterval(() => {
      useGameStore.getState().flushResponseBuffer()
    }, 5000)
    return () => clearInterval(timer)
  }, [])
}
