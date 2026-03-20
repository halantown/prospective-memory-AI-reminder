/** PM Target Items — scene-embedded interactive items for PM task execution.
 *
 * Renders 2 visually similar items inside the target room when a PM trial
 * is active for that room. Items are positioned within the room scene,
 * not in a modal. Participant must find and click the correct item,
 * then confirm the action.
 */

import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'
import type { RoomId, ActivePMTrial } from '../../types'

// Item visual configs keyed by target_object ID
const ITEM_VISUALS: Record<string, {
  emoji: string
  label: string
  description: string
}> = {
  red_book: { emoji: '📕', label: 'Red Book', description: 'A book with a red cover and mountain illustration' },
  blue_book: { emoji: '📘', label: 'Blue Book', description: 'A book with a blue cover and ocean illustration' },
  calendar: { emoji: '📅', label: 'Blue Calendar', description: 'Wall calendar with a blue label' },
  notebook: { emoji: '📓', label: 'Blue Notebook', description: 'A notebook with a blue cover' },
  black_sweater: { emoji: '🧥', label: 'Black Sweater', description: 'A black wool sweater' },
  gray_sweater: { emoji: '🧥', label: 'Gray Sweater', description: 'A gray cotton sweater' },
  red_medicine_bottle: { emoji: '💊', label: 'Doxycycline', description: 'Red bottle labeled Doxycycline' },
  orange_vitamin_bottle: { emoji: '💊', label: 'Vitamin C', description: 'Orange bottle labeled Vitamin C' },
}

// Action labels keyed by target_action
const ACTION_LABELS: Record<string, string> = {
  give_to_friend: 'Give to Friend',
  mark_appointment: 'Mark Appointment',
  hang_to_dry: 'Hang to Dry',
  take_medicine: 'Take Tablet',
}

interface PMTargetItemsProps {
  room: RoomId
}

export default function PMTargetItems({ room }: PMTargetItemsProps) {
  const activePMTrials = useGameStore((s) => s.activePMTrials)
  const completedPMTrialIds = useGameStore((s) => s.completedPMTrialIds)
  const completePMTrial = useGameStore((s) => s.completePMTrial)
  const wsSend = useGameStore((s) => s.wsSend)

  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)
  const [actionPhase, setActionPhase] = useState<'browse' | 'confirm' | 'done'>('browse')
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

  // Find active PM trial targeting this room
  const activeTrial = useMemo(() => {
    return activePMTrials.find(
      t => t.taskConfig.target_room.toLowerCase() === room.toLowerCase()
        && !completedPMTrialIds.has(t.triggerId)
    )
  }, [activePMTrials, completedPMTrialIds, room])

  const items = useMemo(() => {
    if (!activeTrial) return []
    const cfg = activeTrial.taskConfig
    const target = ITEM_VISUALS[cfg.target_object] || {
      emoji: '📦', label: cfg.target_object, description: 'Target item',
    }
    const distractor = ITEM_VISUALS[cfg.distractor_object] || {
      emoji: '📦', label: cfg.distractor_object, description: 'Similar item',
    }
    // Randomize order so correct item isn't always first
    const pair = [
      { id: cfg.target_object, ...target, isCorrect: true },
      { id: cfg.distractor_object, ...distractor, isCorrect: false },
    ]
    // Deterministic shuffle based on trigger ID
    const hash = activeTrial.triggerId.charCodeAt(activeTrial.triggerId.length - 1)
    return hash % 2 === 0 ? pair : pair.reverse()
  }, [activeTrial])

  const handleItemClick = useCallback((itemId: string) => {
    if (actionPhase !== 'browse' || selectedTarget) return
    setSelectedTarget(itemId)
    setActionPhase('confirm')
  }, [actionPhase, selectedTarget])

  const handleConfirmAction = useCallback(() => {
    if (!activeTrial || !selectedTarget) return

    const now = Date.now() / 1000
    const actionStep = activeTrial.taskConfig.target_action

    if (wsSend) {
      wsSend({
        type: 'pm_attempt',
        data: {
          action: 'pm_execute',
          action_step: actionStep,
          target_selected: selectedTarget,
          room,
          timestamp: now,
          target_selected_at: now,
          action_completed_at: now,
        },
      })
    }

    setActionPhase('done')

    // Brief visual feedback then clean up
    setTimeout(() => {
      completePMTrial(activeTrial.triggerId)
      setSelectedTarget(null)
      setActionPhase('browse')
    }, 1200)
  }, [activeTrial, selectedTarget, wsSend, room, completePMTrial])

  const handleCancelSelection = useCallback(() => {
    setSelectedTarget(null)
    setActionPhase('browse')
  }, [])

  if (!activeTrial || items.length === 0) return null

  const actionLabel = ACTION_LABELS[activeTrial.taskConfig.target_action]
    || activeTrial.taskConfig.target_action

  return (
    <div className="mt-2 flex gap-3 items-end">
      <AnimatePresence>
        {items.map((item, idx) => {
          const isSelected = selectedTarget === item.id
          const isOther = selectedTarget && !isSelected
          const isDone = actionPhase === 'done' && isSelected

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ delay: idx * 0.1 }}
              className="relative"
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <button
                onClick={() => handleItemClick(item.id)}
                disabled={actionPhase === 'done' || (actionPhase === 'confirm' && !isSelected)}
                className={`
                  relative w-16 h-16 rounded-lg border-2 flex flex-col items-center
                  justify-center transition-all duration-200
                  ${isDone
                    ? 'border-green-400 bg-green-900/40 scale-105'
                    : isSelected
                    ? 'border-cooking-400 bg-cooking-900/30 scale-105 ring-2 ring-cooking-400/50'
                    : isOther
                    ? 'border-slate-600 bg-slate-800/60 opacity-40'
                    : 'border-slate-500 bg-slate-700/60 hover:border-slate-400 hover:bg-slate-600/60 cursor-pointer'
                  }
                `}
              >
                <span className="text-xl">{item.emoji}</span>
                <span className="text-[8px] text-slate-300 mt-0.5 truncate max-w-[56px]">
                  {item.label}
                </span>

                {isDone && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full
                               flex items-center justify-center text-white text-[8px]"
                  >
                    ✓
                  </motion.div>
                )}
              </button>

              {/* Tooltip on hover */}
              <AnimatePresence>
                {hoveredItem === item.id && actionPhase === 'browse' && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                               bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5
                               text-[10px] text-slate-200 whitespace-nowrap z-30 shadow-lg"
                  >
                    {item.description}
                    <div className="absolute top-full left-1/2 -translate-x-1/2
                                    border-4 border-transparent border-t-slate-800" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </AnimatePresence>

      {/* Action confirmation */}
      <AnimatePresence>
        {actionPhase === 'confirm' && selectedTarget && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex gap-1.5"
          >
            <button
              onClick={handleConfirmAction}
              className="px-2 py-1.5 bg-cooking-500 hover:bg-cooking-600
                         text-white text-[10px] font-bold rounded-lg
                         transition-colors cursor-pointer whitespace-nowrap"
            >
              {actionLabel}
            </button>
            <button
              onClick={handleCancelSelection}
              className="px-1.5 py-1.5 bg-slate-600 hover:bg-slate-500
                         text-slate-200 text-[10px] rounded-lg
                         transition-colors cursor-pointer"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
