/** Trigger Effects — audio and visual feedback for PM trigger events.
 *
 * Supports 4 PM trigger types: visitor, communication, appliance, activity.
 * Each trigger_visual value maps to a distinct audio tone + visual cue.
 * Fake triggers (non-PM) show a brief banner but don't create PM trials.
 * Uses Web Audio API for synthesized tones.
 */

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'
import type { RoomId } from '../../types'

// Map trigger_visual values → source room, audio config, and display info
const TRIGGER_EFFECTS: Record<string, {
  sourceRoom: RoomId | null
  audioFreq: number
  audioDuration: number
  audioPattern: 'single' | 'double' | 'triple'
  icon: string
  label: string
}> = {
  // ── Visitor ──
  visitor_arrival: {
    sourceRoom: 'living_room',
    audioFreq: 880,
    audioDuration: 0.3,
    audioPattern: 'double',
    icon: '🔔',
    label: "Ding-dong! Someone's at the door!",
  },
  // ── Communication ──
  phone_message_banner: {
    sourceRoom: null,
    audioFreq: 1000,
    audioDuration: 0.15,
    audioPattern: 'double',
    icon: '💬',
    label: 'New message!',
  },
  // ── Appliance ──
  dishwasher_indicator_done: {
    sourceRoom: 'kitchen',
    audioFreq: 660,
    audioDuration: 0.2,
    audioPattern: 'triple',
    icon: '🍽️',
    label: 'Dishwasher finished!',
  },
  oven_indicator_green: {
    sourceRoom: 'kitchen',
    audioFreq: 660,
    audioDuration: 0.2,
    audioPattern: 'triple',
    icon: '🫕',
    label: 'Oven is ready!',
  },
  washer_indicator_done: {
    sourceRoom: 'bathroom',
    audioFreq: 660,
    audioDuration: 0.2,
    audioPattern: 'triple',
    icon: '🫧',
    label: 'Washing machine finished!',
  },
  dryer_indicator_done: {
    sourceRoom: 'bathroom',
    audioFreq: 660,
    audioDuration: 0.2,
    audioPattern: 'triple',
    icon: '👔',
    label: 'Dryer finished!',
  },
  // ── Activity ──
  steak_all_plated: {
    sourceRoom: 'kitchen',
    audioFreq: 440,
    audioDuration: 0.3,
    audioPattern: 'single',
    icon: '🥩',
    label: 'All steaks are plated!',
  },
  table_complete: {
    sourceRoom: 'bedroom',
    audioFreq: 440,
    audioDuration: 0.3,
    audioPattern: 'single',
    icon: '🍽️',
    label: 'Table is fully set!',
  },
  phone_batch_end: {
    sourceRoom: null,
    audioFreq: 1000,
    audioDuration: 0.3,
    audioPattern: 'single',
    icon: '📱',
    label: 'Message batch finished!',
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

  // Play audio when new trigger effects appear and schedule auto-clear
  useEffect(() => {
    const timeoutIds: ReturnType<typeof setTimeout>[] = []

    for (const effect of activeTriggerEffects) {
      const key = `${effect.triggerEvent}_${effect.timestamp}`
      if (playedRef.current.has(key)) continue
      playedRef.current.add(key)

      const cfg = TRIGGER_EFFECTS[effect.triggerEvent]
      if (cfg) {
        playTriggerTone(cfg.audioFreq, cfg.audioDuration, cfg.audioPattern)
      }

      // Fake triggers use their own duration; real triggers default to 4s
      const clearDelay = (effect.isFake && effect.duration ? effect.duration : 4) * 1000
      timeoutIds.push(setTimeout(() => {
        clearTriggerEffect(effect.triggerEvent, effect.timestamp)
        playedRef.current.delete(key)
      }, clearDelay))
    }

    return () => timeoutIds.forEach(id => clearTimeout(id))
  }, [activeTriggerEffects, clearTriggerEffect])

  // Render notification banners for active trigger effects
  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {activeTriggerEffects.map((effect) => {
          const cfg = TRIGGER_EFFECTS[effect.triggerEvent]
          if (!cfg) return null
          return (
            <motion.div
              key={`${effect.triggerEvent}_${effect.timestamp}`}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 60 }}
              transition={{ duration: 0.3 }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg backdrop-blur
                ${effect.isFake
                  ? 'bg-slate-700/80 border border-slate-500/40'
                  : 'bg-amber-900/80 border border-amber-400/50'}`}
            >
              <span className="text-xl">{cfg.icon}</span>
              <span className="text-sm text-white font-medium">{cfg.label}</span>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

/** Room glow indicator — shows which room a trigger is coming from.
 *  Only glows for real PM triggers (not fake triggers). */
export function TriggerRoomGlow({ room }: { room: RoomId }) {
  const activeTriggerEffects = useGameStore((s) => s.activeTriggerEffects)

  const isGlowing = activeTriggerEffects.some(e => {
    if (e.isFake) return false
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

/** HUD clock trigger effect — kept for backward compatibility.
 *  No current trigger_visual maps to a clock effect. */
export function ClockTriggerEffect() {
  const activeTriggerEffects = useGameStore((s) => s.activeTriggerEffects)

  // No trigger_visual currently activates the clock effect
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
