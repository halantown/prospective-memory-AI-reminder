/** WebSocket hook — connect, dispatch events, heartbeat, reconnect. */

import { useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '../stores/gameStore'
import { getSessionState, getSessionToken } from '../services/api'
import { isMainExperimentPhase } from '../utils/phase'
import { playSound } from './useSoundEffects'
import type { PMPipelineStep, RoomId } from '../types'
import type { WSServerEvent } from '../types/wsEvents'

const HEARTBEAT_INTERVAL = 30_000
const RECONNECT_BASE_MS = 500
const RECONNECT_MAX_MS = 15_000

export function useWebSocket(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null)
  const retryCount = useRef(0)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const robotSpeechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Monotonically increasing connection id — only the latest connection should
  // attempt reconnects.  This prevents the race where a stale onclose handler
  // (whose closedByUser flag was already reset by the next effect run) spawns
  // an extra connection.
  const connIdRef = useRef(0)

  const handleMessage = useCallback((rawEvent: MessageEvent) => {
    let msg: WSServerEvent
    try {
      msg = JSON.parse(rawEvent.data)
    } catch (e) {
      console.error('[WS] Failed to parse message:', e, rawEvent.data?.slice?.(0, 200))
      return
    }

    const store = useGameStore.getState()

    console.log('[WS RECEIVED]', msg.event, msg.data)

    switch (msg.event) {
      case 'block_start':
        console.log('[WS] Block started:', msg.data)
        break

      case 'time_tick': {
        const { game_clock, elapsed, frozen } = msg.data
        if (game_clock) store.setGameClock(game_clock)
        if (elapsed != null) store.setElapsedSeconds(elapsed)
        if (frozen !== undefined && frozen !== store.gameTimeFrozen) {
          store.setGameTimeFrozen(frozen)
        }
        break
      }

      case 'robot_speak':
        store.setRobotSpeaking(msg.data.text)
        if (robotSpeechTimerRef.current) clearTimeout(robotSpeechTimerRef.current)
        robotSpeechTimerRef.current = setTimeout(() => store.clearRobotSpeech(), 5000)
        break

      case 'robot_idle_comment':
        playSound('robotBeep')
        store.setRobotSpeaking(msg.data.text)
        if (store.wsSend) {
          store.wsSend({
            type: 'robot_idle_comment_shown',
            data: {
              comment_id: msg.data.comment_id,
              text: msg.data.text,
              shown_at: Date.now() / 1000,
            },
          })
        }
        if (robotSpeechTimerRef.current) clearTimeout(robotSpeechTimerRef.current)
        robotSpeechTimerRef.current = setTimeout(() => store.clearRobotSpeech(), 3000)
        break

      case 'robot_move': {
        const VALID_ROOMS = ['kitchen', 'dining_room', 'living_room', 'study', 'bathroom', 'hallway']
        const toRoom = msg.data.to_room
        if (VALID_ROOMS.includes(toRoom)) {
          store.setRobotRoom(toRoom as RoomId)
        } else {
          console.warn('[WS] Invalid robot room:', toRoom)
        }
        break
      }

      case 'pm_trigger': {
        const d = msg.data
        const isFake = Boolean(d.is_fake)
        const taskId = d.task_id || null
        const triggerType = d.trigger_type || 'doorbell'
        const taskPosition = d.position ?? null
        const scheduleIndex = d.schedule_index || 0

        if (!isFake && !taskId) {
          console.warn('[WS] Ignoring malformed real pm_trigger without task_id:', d)
          break
        }

        store.setPMPipelineState({
          step: 'trigger_event',
          taskId: isFake ? null : taskId,
          triggerType,
          isFake,
          taskPosition: isFake ? null : taskPosition,
          scheduleIndex,
          firedAt: Date.now() / 1000,
          wasInterrupted: false,
          condition: d.condition,
          guestName: d.guest_name,
          reminderText: d.reminder_text,
          greetingLines: d.greeting_lines,
          fakeResolutionLines: d.fake_resolution_lines,
          itemOptions: d.item_options,
          triggerRespondedAt: null,
          triggerTimedOut: false,
          triggerTimeoutStage: 0,
        })
        store.setGameTimeFrozen(true)

        store.addTriggerEffect(triggerType === 'doorbell' ? 'visitor_arrival' : 'phone_message_banner')
        break
      }

      case 'avatar_action':
        window.dispatchEvent(new CustomEvent('pm:avatar_action', { detail: msg.data }))
        break

      case 'session_end':
        store.setPMPipelineState(null)
        store.setGameTimeFrozen(false)
        store.clearRobotSpeech()
        store.setPhase('session_transition')
        break

      case 'heartbeat_ack':
        if (msg.data.frozen !== undefined && msg.data.frozen !== store.gameTimeFrozen) {
          store.setGameTimeFrozen(msg.data.frozen)
        }
        break

      case 'phone_contacts':
        store.setContacts(msg.data.contacts || [])
        break

      case 'phone_message': {
        const now = Date.now()
        const d = msg.data
        const channel = d.channel || 'notification'
        const contactId = d.contact_id || undefined
        const pmStep = store.pmPipelineState?.step
        const suppressPhonePush = pmStep === 'confidence_rating'
          || pmStep === 'item_selection'
          || pmStep === 'greeting'
          || pmStep === 'reminder'

        if (channel === 'notification') {
          const bannerMsg = {
            id: d.id,
            text: d.text,
            channel: 'notification' as const,
            sender: d.sender,
            timestamp: now,
            read: false,
            answered: false,
          }
          if (!suppressPhonePush) {
            store.setPhoneBanner(bannerMsg)
          }
          store.addLockSystemNotification({ id: d.id, sender: d.sender || '', text: d.text, timestamp: now })
          break
        }

        const phoneMsg = {
          id: d.id,
          text: d.text,
          channel: 'chat' as const,
          contactId,
          correctChoice: d.correct_choice,
          wrongChoice: d.wrong_choice,
          correctPosition: d.correct_position ?? null,
          feedbackCorrect: d.feedback_correct,
          feedbackIncorrect: d.feedback_incorrect,
          feedbackMissed: d.feedback_missed,
          timestamp: now,
          read: false,
          answered: false,
        }
        store.addPhoneMessage(phoneMsg)

        const isActiveChat = !store.phoneLocked
          && store.activePhoneTab === 'chats'
          && contactId === store.activeContactId
        if (!isActiveChat && !suppressPhonePush) {
          store.setPhoneBanner(phoneMsg)
        }
        break
      }

      case 'block_end':
        store.setPMPipelineState(null)
        store.setGameTimeFrozen(false)
        store.clearRobotSpeech()
        store.setPhase('session_transition')
        break

      case 'block_error':
        console.error('[WS] Block runtime error:', msg.data)
        store.setBlockError(msg.data.message || 'Internal server error')
        break

      case 'pm_received':
        break

      case 'ongoing_task_event':
        store.handleOngoingTaskEvent(msg.data)
        break

      case 'force_sync':
        console.log('[WS] Force sync:', msg.data)
        break

      case 'keepalive':
        break

      default:
        console.log('[WS] Unknown event:', (msg as { event: string }).event, (msg as { data: unknown }).data)
    }
  }, [sessionId])

  const connect = useCallback(() => {
    if (!sessionId) return

    const myConnId = ++connIdRef.current

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const autoStart = isMainExperimentPhase(useGameStore.getState().phase)
    const token = getSessionToken()
    const params = new URLSearchParams({ auto_start: String(autoStart) })
    if (token) params.set('token', token)
    const url = `${proto}//${host}/ws/game/${sessionId}?${params.toString()}`

    console.log('[WS] Connecting:', { sessionId, autoStart, hasToken: Boolean(token) })
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

      if (isMainExperimentPhase(useGameStore.getState().phase)) {
        sendFn({ type: 'start_game', data: {} })
      }

      // Restore authoritative runtime state on every connect. This covers both
      // automatic reconnects and full page reloads where the Zustand store was
      // recreated before the still-running backend runtime was reattached.
      if (sessionId) {
        getSessionState(sessionId).then((state) => {
          if (state?.runtime_state && typeof state.runtime_state === 'object') {
            useGameStore.getState().restoreRuntimeState(state.runtime_state as Record<string, unknown>)
          }
          if (state?.pipeline_step && state.pipeline_step !== 'idle') {
            useGameStore.getState().setPMPipelineState({
              step: (state.pipeline_step as PMPipelineStep) || 'trigger_event',
              taskId: (state.current_task_id as string) || null,
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
        reconnectTimerRef.current = setTimeout(connect, delay)
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
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
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
