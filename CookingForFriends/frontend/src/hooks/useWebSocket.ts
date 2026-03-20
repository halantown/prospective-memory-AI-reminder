/** WebSocket hook — connect, dispatch events, heartbeat, reconnect. */

import { useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '../stores/gameStore'

const HEARTBEAT_INTERVAL = 10_000
const RECONNECT_BASE_MS = 500
const RECONNECT_MAX_MS = 5_000

export function useWebSocket(sessionId: string | null, blockNumber: number) {
  const wsRef = useRef<WebSocket | null>(null)
  const retryCount = useRef(0)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const closedByUser = useRef(false)

  const {
    setWsConnected,
    setWsSend,
    setGameClock,
    setElapsedSeconds,
    setRobotSpeaking,
    clearRobotSpeech,
    setRobotRoom,
    addPhoneNotification,
    setPhoneLocked,
    triggerPM,
    setPhase,
    phase,
  } = useGameStore()

  const handleMessage = useCallback((event: MessageEvent) => {
    let msg: { event: string; data: Record<string, unknown> }
    try {
      msg = JSON.parse(event.data)
    } catch {
      return
    }

    const { event: eventType, data } = msg

    switch (eventType) {
      case 'block_start':
        console.log('[WS] Block started:', data)
        break

      case 'time_tick':
        if (data.game_clock) setGameClock(data.game_clock as string)
        if (data.elapsed != null) setElapsedSeconds(data.elapsed as number)
        break

      case 'robot_speak':
        // No is_reminder field — treat all robot speech identically
        setRobotSpeaking(data.text as string)
        setTimeout(() => clearRobotSpeech(), 5000)
        break

      case 'robot_move':
        setRobotRoom(data.to_room as any)
        break

      case 'pm_trigger':
        triggerPM(data.trigger_id as string, data.trigger_event as string)
        break

      case 'phone_notification':
        addPhoneNotification({
          id: `notif_${Date.now()}`,
          sender: data.sender as string,
          preview: data.preview as string,
          is_ad: data.is_ad as boolean,
          timestamp: Date.now(),
          read: false,
        })
        break

      case 'phone_lock':
        setPhoneLocked(true)
        break

      case 'block_end':
        setPhase('microbreak')
        break

      case 'pm_received':
        // Ack — no score info
        break

      case 'ongoing_task_event':
        // Dispatch to kitchen/dining task handlers
        console.log('[WS] Ongoing task event:', data)
        break

      case 'force_sync':
        console.log('[WS] Force sync:', data)
        break

      case 'keepalive':
        break

      default:
        console.log('[WS] Unknown event:', eventType, data)
    }
  }, [setGameClock, setElapsedSeconds, setRobotSpeaking, clearRobotSpeech,
      setRobotRoom, addPhoneNotification, setPhoneLocked, triggerPM, setPhase])

  const connect = useCallback(() => {
    if (!sessionId || blockNumber < 1) return

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const autoStart = useGameStore.getState().phase === 'playing'
    const url = `${proto}//${host}/ws/game/${sessionId}/${blockNumber}?auto_start=${autoStart}`

    console.log('[WS] Connecting:', url)
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WS] Connected')
      retryCount.current = 0
      setWsConnected(true)

      const sendFn = (msg: Record<string, unknown>) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(msg))
        }
      }
      setWsSend(sendFn)

      // Start heartbeat
      heartbeatRef.current = setInterval(() => {
        sendFn({ type: 'heartbeat', data: { timestamp: Date.now() / 1000 } })
      }, HEARTBEAT_INTERVAL)
    }

    ws.onmessage = handleMessage

    ws.onclose = () => {
      setWsConnected(false)
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)

      if (!closedByUser.current) {
        const delay = Math.min(
          RECONNECT_BASE_MS * Math.pow(2, retryCount.current),
          RECONNECT_MAX_MS,
        )
        retryCount.current++
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${retryCount.current})`)
        setTimeout(connect, delay)
      }
    }

    ws.onerror = (err) => {
      console.error('[WS] Error:', err)
    }
  }, [sessionId, blockNumber, handleMessage, setWsConnected, setWsSend])

  useEffect(() => {
    closedByUser.current = false
    connect()

    return () => {
      closedByUser.current = true
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  return wsRef
}
