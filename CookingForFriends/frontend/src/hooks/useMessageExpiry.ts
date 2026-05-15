import { useEffect, useRef } from 'react'
import { useGameStore } from '../stores/gameStore'
import { playSound } from './useSoundEffects'

const MESSAGE_REPLY_WINDOW_MS = 50_000

interface TimerEntry {
  timerId: ReturnType<typeof setTimeout>
  remainingMs: number
  startedAt: number
}

export function useMessageExpiry() {
  const phoneMessages = useGameStore((s) => s.phoneMessages)
  const gameTimeFrozen = useGameStore((s) => s.gameTimeFrozen)
  const timersRef = useRef<Map<string, TimerEntry>>(new Map())

  useEffect(() => {
    const timers = timersRef.current

    for (const msg of phoneMessages) {
      if (msg.channel !== 'chat') continue
      if (!msg.correctChoice || !msg.wrongChoice) continue
      if (msg.answered || msg.expired) {
        const existing = timers.get(msg.id)
        if (existing) {
          clearTimeout(existing.timerId)
          timers.delete(msg.id)
        }
        continue
      }
      if (timers.has(msg.id)) continue
      if (gameTimeFrozen) continue

      const elapsed = Date.now() - msg.timestamp
      const remaining = Math.max(0, MESSAGE_REPLY_WINDOW_MS - elapsed)

      const timerId = setTimeout(() => {
        timers.delete(msg.id)
        const current = useGameStore.getState()
        const m = current.phoneMessages.find((pm) => pm.id === msg.id)
        if (!m || m.answered || m.expired) return
        current.expirePhoneMessage(msg.id)
        playSound('phoneMessageSoft')
        if (current.wsSend) {
          current.wsSend({
            type: 'phone_message_expired',
            data: {
              message_id: msg.id,
              contact_id: msg.contactId,
              expired_at: Date.now() / 1000,
              game_time: current.elapsedSeconds,
              reply_window_ms: MESSAGE_REPLY_WINDOW_MS,
            },
          })
        }
      }, remaining)

      timers.set(msg.id, { timerId, remainingMs: remaining, startedAt: Date.now() })
    }
  }, [phoneMessages, gameTimeFrozen])

  // Pause/resume on PM overlay (gameTimeFrozen)
  useEffect(() => {
    const timers = timersRef.current
    if (gameTimeFrozen) {
      for (const [id, entry] of timers) {
        clearTimeout(entry.timerId)
        const elapsed = Date.now() - entry.startedAt
        entry.remainingMs = Math.max(0, entry.remainingMs - elapsed)
      }
    } else {
      for (const [id, entry] of timers) {
        const remaining = entry.remainingMs
        entry.startedAt = Date.now()
        entry.timerId = setTimeout(() => {
          timers.delete(id)
          const current = useGameStore.getState()
          const m = current.phoneMessages.find((pm) => pm.id === id)
          if (!m || m.answered || m.expired) return
          current.expirePhoneMessage(id)
          playSound('phoneMessageSoft')
          if (current.wsSend) {
            current.wsSend({
              type: 'phone_message_expired',
              data: {
                message_id: id,
                contact_id: m.contactId,
                expired_at: Date.now() / 1000,
                game_time: current.elapsedSeconds,
                reply_window_ms: MESSAGE_REPLY_WINDOW_MS,
              },
            })
          }
        }, remaining)
      }
    }
  }, [gameTimeFrozen])

  // Cleanup on unmount
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const entry of timers.values()) {
        clearTimeout(entry.timerId)
      }
      timers.clear()
    }
  }, [])
}
