/** WebSocket hook — connect, dispatch events, heartbeat, reconnect. */

import { useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '../stores/gameStore'
import type { ActivePMTrial, PMTaskConfig, RoomId } from '../types'

const HEARTBEAT_INTERVAL = 10_000
const RECONNECT_BASE_MS = 500
const RECONNECT_MAX_MS = 5_000

export function useWebSocket(sessionId: string | null, blockNumber: number) {
  const wsRef = useRef<WebSocket | null>(null)
  const retryCount = useRef(0)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const robotSpeechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Monotonically increasing connection id — only the latest connection should
  // attempt reconnects.  This prevents the race where a stale onclose handler
  // (whose closedByUser flag was already reset by the next effect run) spawns
  // an extra connection.
  const connIdRef = useRef(0)

  const handleMessage = useCallback((event: MessageEvent) => {
    let msg: { event: string; data: Record<string, unknown>; server_ts?: number }
    try {
      msg = JSON.parse(event.data)
    } catch (e) {
      console.error('[WS] Failed to parse message:', e, event.data?.slice?.(0, 200))
      return
    }

    const { event: eventType, data } = msg
    const store = useGameStore.getState()

    console.log('[WS RECEIVED]', eventType, data)

    switch (eventType) {
      case 'block_start':
        console.log('[WS] Block started:', data)
        break

      case 'time_tick':
        if (data.game_clock) store.setGameClock(data.game_clock as string)
        if (data.elapsed != null) store.setElapsedSeconds(data.elapsed as number)
        break

      case 'robot_speak':
        store.setRobotSpeaking(data.text as string)
        if (robotSpeechTimerRef.current) clearTimeout(robotSpeechTimerRef.current)
        robotSpeechTimerRef.current = setTimeout(() => store.clearRobotSpeech(), 5000)
        break

      case 'robot_move': {
        const VALID_ROOMS = ['kitchen', 'bedroom', 'living_room', 'study', 'bathroom']
        const toRoom = data.to_room as string
        if (VALID_ROOMS.includes(toRoom)) {
          store.setRobotRoom(toRoom as RoomId)
        } else {
          console.warn('[WS] Invalid robot room:', toRoom)
        }
        break
      }

      case 'pm_trigger': {
        const receivedAt = Date.now() / 1000
        const triggerId = data.trigger_id as string
        const triggerEvent = data.trigger_event as string
        const serverTs = (data.server_trigger_ts as number) || msg.server_ts || receivedAt
        const taskConfig = (data.task_config as PMTaskConfig) || {
          task_id: triggerId,
          trigger_event: triggerEvent,
          target_room: (data.target_room as string) || '',
          target_object: (data.target_object as string) || '',
          target_action: (data.target_action as string) || '',
          distractor_object: (data.distractor_object as string) || '',
          action_destination: (data.action_destination as string) || '',
          discriminating_cue: (data.discriminating_cue as string) || '',
        }

        store.addPMTrial({
          triggerId,
          triggerEvent,
          serverTriggerTs: serverTs,
          receivedAt,
          taskConfig,
        })

        store.addTriggerEffect(triggerEvent)

        const send = useGameStore.getState().wsSend
        if (send) {
          send({
            type: 'trigger_ack',
            data: { trigger_id: triggerId, received_at: receivedAt },
          })
        }
        break
      }

      case 'fake_trigger': {
        const triggerType = data.trigger_type as string
        const duration = (data.duration as number) || 4

        // Map trigger_type to a default trigger_visual for audio/display lookup
        const visualMap: Record<string, string> = {
          visitor: 'visitor_arrival',
          communication: 'phone_message_banner',
          appliance: 'dishwasher_indicator_done',
          activity: 'steak_all_plated',
        }
        const triggerEvent = visualMap[triggerType] || triggerType

        store.addTriggerEffect(triggerEvent, { isFake: true, duration })
        break
      }

      case 'phone_message': {
        const now = Date.now()
        const category = (data.category as string) || 'notification'
        const phoneMsg = {
          id: data.id as string,
          sender: data.sender as string,
          avatar: (data.avatar as string) || '💬',
          text: data.text as string,
          category: category as 'question' | 'notification',
          choices: data.choices as string[] | undefined,
          correctIndex: data.correct_index as number | undefined,
          timestamp: now,
          status: 'active' as const,
          read: false,
        }
        store.addPhoneMessage(phoneMsg)
        store.setPhoneBanner(phoneMsg)
        break
      }

      case 'phone_notification':
        store.addPhoneNotification({
          id: `notif_${Date.now()}`,
          sender: data.sender as string,
          preview: data.preview as string,
          is_ad: data.is_ad as boolean,
          timestamp: Date.now(),
          read: false,
        })
        break

      case 'phone_lock':
        store.setPhoneLocked(true)
        break

      case 'block_end':
        store.setPhase('microbreak')
        break

      case 'pm_received':
        break

      case 'ongoing_task_event':
        store.handleOngoingTaskEvent(data)
        break

      case 'force_sync':
        console.log('[WS] Force sync:', data)
        break

      case 'keepalive':
        break

      default:
        console.log('[WS] Unknown event:', eventType, data)
    }
  }, [])   // no deps — reads from getState() so always stable

  const connect = useCallback(() => {
    if (!sessionId || blockNumber < 1) return

    const myConnId = ++connIdRef.current

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
      useGameStore.getState().setWsConnected(true)

      const sendFn = (msg: Record<string, unknown>) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(msg))
        }
      }
      useGameStore.getState().setWsSend(sendFn)

      if (useGameStore.getState().phase === 'playing') {
        sendFn({ type: 'start_game', data: { block_number: blockNumber } })
      }

      heartbeatRef.current = setInterval(() => {
        sendFn({ type: 'heartbeat', data: { timestamp: Date.now() / 1000 } })
      }, HEARTBEAT_INTERVAL)
    }

    ws.onmessage = handleMessage

    ws.onclose = () => {
      useGameStore.getState().setWsConnected(false)
      useGameStore.getState().setWsSend(null)
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)

      // Only reconnect if this is still the latest connection attempt
      if (connIdRef.current === myConnId) {
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
  }, [sessionId, blockNumber, handleMessage])

  useEffect(() => {
    connect()

    return () => {
      // Bump connId so the closing WS won't attempt to reconnect
      connIdRef.current++
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      if (robotSpeechTimerRef.current) clearTimeout(robotSpeechTimerRef.current)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  return wsRef
}
