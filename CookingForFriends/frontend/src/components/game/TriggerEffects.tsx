/** Trigger Effects — audio and visual feedback for PM trigger events.
 *
 * Each trigger type gets a distinct audio tone + visual cue.
 * Effects are noticeable but don't tell the participant what to do.
 * Uses Web Audio API for placeholder tones (replace with real audio later).
 */

import { useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'
import type { RoomId } from '../../types'

// Map trigger events to their source room and visual config
const TRIGGER_EFFECTS: Record<string, {
  sourceRoom: RoomId | null
  audioFreq: number
  audioDuration: number
  audioPattern: 'single' | 'double' | 'triple'
  icon: string
  label: string
}> = {
  doorbell: {
    sourceRoom: 'living_room',
    audioFreq: 880,
    audioDuration: 0.3,
    audioPattern: 'double',
    icon: '🔔',
    label: 'Ding-dong!',
  },
  email_dentist: {
    sourceRoom: null, // phone sidebar
    audioFreq: 1200,
    audioDuration: 0.15,
    audioPattern: 'single',
    icon: '📧',
    label: 'New email',
  },
  washing_done: {
    sourceRoom: 'balcony',
    audioFreq: 660,
    audioDuration: 0.2,
    audioPattern: 'triple',
    icon: '🫧',
    label: 'Beep beep beep!',
  },
  clock_6pm: {
    sourceRoom: null, // HUD clock
    audioFreq: 523,
    audioDuration: 0.5,
    audioPattern: 'single',
    icon: '🕕',
    label: 'Clock chimes',
  },
  knock: {
    sourceRoom: 'living_room',
    audioFreq: 220,
    audioDuration: 0.1,
    audioPattern: 'triple',
    icon: '🚪',
    label: 'Knock knock!',
  },
  phone_message: {
    sourceRoom: null,
    audioFreq: 1000,
    audioDuration: 0.15,
    audioPattern: 'double',
    icon: '💬',
    label: 'New message',
  },
  plant_reminder: {
    sourceRoom: 'balcony',
    audioFreq: 440,
    audioDuration: 0.3,
    audioPattern: 'single',
    icon: '🌱',
    label: 'Reminder tone',
  },
  tv_on: {
    sourceRoom: 'living_room',
    audioFreq: 350,
    audioDuration: 0.4,
    audioPattern: 'single',
    icon: '📺',
    label: 'TV turns on',
  },
}

const audioCtxRef: { current: AudioContext | null } = { current: null }

function getAudioContext(): AudioContext {
  if (!audioCtxRef.current) {
    audioCtxRef.current = new AudioContext()
  }
  return audioCtxRef.current
}

function playTriggerTone(freq: number, duration: number, pattern: 'single' | 'double' | 'triple') {
  try {
    const ctx = getAudioContext()
    const count = pattern === 'single' ? 1 : pattern === 'double' ? 2 : 3
    const gap = 0.15

    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.value = 0.15

      const start = ctx.currentTime + i * (duration + gap)
      gain.gain.setValueAtTime(0.15, start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
      osc.start(start)
      osc.stop(start + duration + 0.05)
    }
  } catch {
    // Audio not available — fail silently
  }
}

export default function TriggerEffects() {
  const activeTriggerEffects = useGameStore((s) => s.activeTriggerEffects)
  const clearTriggerEffect = useGameStore((s) => s.clearTriggerEffect)
  const playedRef = useRef<Set<string>>(new Set())

  // Play audio when new trigger effects appear
  useEffect(() => {
    for (const effect of activeTriggerEffects) {
      const key = `${effect.triggerEvent}_${effect.timestamp}`
      if (playedRef.current.has(key)) continue
      playedRef.current.add(key)

      const cfg = TRIGGER_EFFECTS[effect.triggerEvent]
      if (cfg) {
        playTriggerTone(cfg.audioFreq, cfg.audioDuration, cfg.audioPattern)
      }

      // Auto-clear effect after 4 seconds
      setTimeout(() => {
        clearTriggerEffect(effect.triggerEvent)
        playedRef.current.delete(key)
      }, 4000)
    }
  }, [activeTriggerEffects, clearTriggerEffect])

  return null
}

/** Room glow indicator — shows which room a trigger is coming from. */
export function TriggerRoomGlow({ room }: { room: RoomId }) {
  const activeTriggerEffects = useGameStore((s) => s.activeTriggerEffects)

  const isGlowing = activeTriggerEffects.some(e => {
    const cfg = TRIGGER_EFFECTS[e.triggerEvent]
    return cfg?.sourceRoom === room
  })

  if (!isGlowing) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0.3, 0.7, 0.3] }}
      transition={{ repeat: 3, duration: 1 }}
      className="absolute inset-0 rounded-xl border-2 border-amber-400/60
                 pointer-events-none z-10"
      style={{ boxShadow: '0 0 20px 4px rgba(251, 191, 36, 0.3)' }}
    />
  )
}

/** HUD clock trigger effect — highlights clock when clock trigger fires. */
export function ClockTriggerEffect() {
  const activeTriggerEffects = useGameStore((s) => s.activeTriggerEffects)

  const isClockTrigger = activeTriggerEffects.some(
    e => e.triggerEvent === 'clock_6pm'
  )

  if (!isClockTrigger) return null

  return (
    <motion.span
      animate={{ scale: [1, 1.2, 1], color: ['#fff', '#fbbf24', '#fff'] }}
      transition={{ repeat: 3, duration: 0.8 }}
      className="absolute inset-0"
    />
  )
}
