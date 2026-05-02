/** WebSocket hook — connect, dispatch events, heartbeat, reconnect. */

import { useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '../stores/gameStore'
import { getSessionState } from '../services/api'
import type { ActivePMTrial, PMTaskConfig, RoomId } from '../types'

const HEARTBEAT_INTERVAL = 30_000
const RECONNECT_BASE_MS = 500
const RECONNECT_MAX_MS = 15_000

export function useWebSocket(sessionId: string | null) {
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
        const VALID_ROOMS = ['kitchen', 'dining_room', 'living_room', 'study', 'bathroom', 'hallway']
        const toRoom = data.to_room as string
        if (VALID_ROOMS.includes(toRoom)) {
          store.setRobotRoom(toRoom as RoomId)
        } else {
          console.warn('[WS] Invalid robot room:', toRoom)
        }
        break
      }

      case 'pm_trigger': {
        // New format: is_fake, task_id, trigger_type, position, schedule_index, game_time_fired
        const isFake = Boolean(data.is_fake)
        const taskId = (data.task_id as string) || null
        const triggerType = (data.trigger_type as 'doorbell' | 'phone_call') || 'doorbell'
        const taskPosition = data.position != null ? (data.position as number) : null
        const scheduleIndex = (data.schedule_index as number) || 0

        if (!isFake && !taskId) {
          console.warn('[WS] Ignoring malformed real pm_trigger without task_id:', data)
          break
        }

        store.setPMPipelineState({
          step: 'trigger_affordance',
          taskId: isFake ? null : taskId,
          triggerType,
          isFake,
          taskPosition: isFake ? null : taskPosition,
          scheduleIndex,
          firedAt: Date.now() / 1000,
          wasInterrupted: false,
        })
        store.setGameTimeFrozen(true)

        // Also add legacy trigger effect for visual feedback
        store.addTriggerEffect(triggerType === 'doorbell' ? 'visitor_arrival' : 'phone_message_banner')
        break
      }

      case 'avatar_action': {
        // Signal PMTriggerModal via custom DOM event
        window.dispatchEvent(new CustomEvent('pm:avatar_action', { detail: data }))
        break
      }

      case 'session_end': {
        store.setPhase('post_questionnaire')
        break
      }

      case 'heartbeat_ack': {
        if (data.frozen !== undefined && data.frozen !== store.gameTimeFrozen) {
          store.setGameTimeFrozen(Boolean(data.frozen))
        }
        break
      }

      case 'phone_contacts': {
        const contacts = (data.contacts as Array<{ id: string; name: string; avatar: string }>) || []
        store.setContacts(contacts)
        break
      }

      case 'phone_message': {
        const now = Date.now()
        const channel = (data.channel as string) || 'notification'
        const contactId = (data.contact_id as string) || undefined

        // Notification messages → banner only + persist to lock screen list
        if (channel === 'notification') {
          const sender = data.sender as string
          const text = data.text as string
          const bannerMsg = {
            id: data.id as string,
            text,
            channel: 'notification' as const,
            sender,
            timestamp: now,
            read: false,
            answered: false,
          }
          store.setPhoneBanner(bannerMsg)
          store.addLockSystemNotification({ id: data.id as string, sender, text, timestamp: now })
          break
        }

        // Chat message → store and conditionally show banner
        const phoneMsg = {
          id: data.id as string,
          text: data.text as string,
          channel: 'chat' as const,
          contactId,
          correctChoice: data.correct_choice as string | undefined,
          wrongChoice: data.wrong_choice as string | undefined,
          correctPosition: (data.correct_position as number | null) ?? null,
          feedbackCorrect: data.feedback_correct as string | undefined,
          feedbackIncorrect: data.feedback_incorrect as string | undefined,
          timestamp: now,
          read: false,
          answered: false,
        }
        store.addPhoneMessage(phoneMsg)

        // Show banner when not viewing this contact's chat
        const isActiveChat = !store.phoneLocked
          && store.activePhoneTab === 'chats'
          && contactId === store.activeContactId
        if (!isActiveChat) {
          store.setPhoneBanner(phoneMsg)
        }
        break
      }

      case 'kitchen_timer': {
        store.pushKitchenTimer({
          id: data.id as string,
          icon: (data.icon as string) || '🍳',
          message: data.message as string,
        })
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
        store.setPhase('debrief')
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
    if (!sessionId) return

    const myConnId = ++connIdRef.current

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const autoStart = useGameStore.getState().phase === 'playing'
    const url = `${proto}//${host}/ws/game/${sessionId}?auto_start=${autoStart}`

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
        sendFn({ type: 'start_game', data: {} })
      }

      // On reconnect: restore PM pipeline state if server reports active pipeline
      if (retryCount.current > 0 && sessionId) {
        getSessionState(sessionId).then((state) => {
          if (state?.pipeline_step && state.pipeline_step !== 'idle') {
            useGameStore.getState().setPMPipelineState({
              step: 'trigger_affordance',
              taskId: (state.task_id as string) || null,
              triggerType: (state.trigger_type as 'doorbell' | 'phone_call') || 'doorbell',
              isFake: Boolean(state.is_fake),
              taskPosition: (state.task_position as number) || null,
              scheduleIndex: (state.schedule_index as number) || 0,
              firedAt: Date.now() / 1000,
              wasInterrupted: true,
            })
            useGameStore.getState().setGameTimeFrozen(true)
          }
        }).catch(() => {
          // Non-critical — ignore state restore failure on reconnect
        })
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
  }, [sessionId, handleMessage])

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
