/** PM Target Items — scene-embedded interactive items for PM task execution.
 *
 * Renders target + distractor item pairs in each room. Items appear as subtle
 * decorations when inactive, and become interactive when a PM trial fires
 * for that task. Only items from the currently active block are shown.
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'
import type { RoomId } from '../../types'

// ── Item visual data for all 12 PM tasks ──

interface TaskItemVisual {
  id: string
  label: string
  description: string
  emoji: string
  color: string
}

interface TaskItemPair {
  taskId: string
  block: number
  room: RoomId
  target: TaskItemVisual
  distractor: TaskItemVisual
  cue: string
}

const TASK_ITEM_PAIRS: TaskItemPair[] = [
  // ── Block 1 (Mei) ──
  {
    taskId: 'b1_book',
    block: 1,
    room: 'study',
    target: {
      id: 'b1_book_target',
      label: 'Book (gold title)',
      description: 'Red hardcover book with gold title',
      emoji: '📕',
      color: 'bg-amber-700',
    },
    distractor: {
      id: 'b1_book_distractor',
      label: 'Book (silver title)',
      description: 'Red hardcover book with silver title',
      emoji: '📕',
      color: 'bg-slate-500',
    },
    cue: 'gold title lettering (not silver)',
  },
  {
    taskId: 'b1_giftbag',
    block: 1,
    room: 'bedroom',
    target: {
      id: 'b1_giftbag_target',
      label: 'Gift bag (ribbon)',
      description: 'Red gift bag with ribbon handles',
      emoji: '🎁',
      color: 'bg-red-600',
    },
    distractor: {
      id: 'b1_giftbag_distractor',
      label: 'Gift bag (cord)',
      description: 'Red gift bag with cord handles',
      emoji: '🎁',
      color: 'bg-red-400',
    },
    cue: 'ribbon handles (not cord)',
  },
  {
    taskId: 'b1_dish',
    block: 1,
    room: 'living_room',
    target: {
      id: 'b1_dish_target',
      label: 'Dish (oval)',
      description: 'Oval white ceramic serving dish',
      emoji: '🍽️',
      color: 'bg-sky-100',
    },
    distractor: {
      id: 'b1_dish_distractor',
      label: 'Dish (round)',
      description: 'Round white ceramic serving dish',
      emoji: '🍽️',
      color: 'bg-stone-200',
    },
    cue: 'oval (not round)',
  },
  {
    taskId: 'b1_soap',
    block: 1,
    room: 'bathroom',
    target: {
      id: 'b1_soap_target',
      label: 'Soap (amber)',
      description: 'Amber glass soap dispenser',
      emoji: '🧴',
      color: 'bg-amber-500',
    },
    distractor: {
      id: 'b1_soap_distractor',
      label: 'Soap (clear)',
      description: 'Clear glass soap dispenser',
      emoji: '🧴',
      color: 'bg-gray-300',
    },
    cue: 'amber glass (not clear)',
  },

  // ── Block 2 (Lucas) ──
  {
    taskId: 'b2_vinyl',
    block: 2,
    room: 'study',
    target: {
      id: 'b2_vinyl_target',
      label: 'Vinyl (blue label)',
      description: 'Vinyl record with blue label',
      emoji: '💿',
      color: 'bg-blue-600',
    },
    distractor: {
      id: 'b2_vinyl_distractor',
      label: 'Vinyl (red label)',
      description: 'Vinyl record with red label',
      emoji: '💿',
      color: 'bg-red-500',
    },
    cue: 'blue label (not red)',
  },
  {
    taskId: 'b2_napkinrings',
    block: 2,
    room: 'bedroom',
    target: {
      id: 'b2_napkinrings_target',
      label: 'Rings (leaf)',
      description: 'Silver napkin rings with leaf pattern',
      emoji: '💍',
      color: 'bg-emerald-600',
    },
    distractor: {
      id: 'b2_napkinrings_distractor',
      label: 'Rings (plain)',
      description: 'Silver napkin rings with plain band',
      emoji: '💍',
      color: 'bg-zinc-400',
    },
    cue: 'leaf pattern (not plain)',
  },
  {
    taskId: 'b2_pot',
    block: 2,
    room: 'living_room',
    target: {
      id: 'b2_pot_target',
      label: 'Pot (terracotta rim)',
      description: 'Short round ceramic pot with terracotta rim',
      emoji: '🪴',
      color: 'bg-orange-600',
    },
    distractor: {
      id: 'b2_pot_distractor',
      label: 'Pot (white rim)',
      description: 'Short round ceramic pot with white rim',
      emoji: '🪴',
      color: 'bg-stone-100',
    },
    cue: 'terracotta rim (not white)',
  },
  {
    taskId: 'b2_softener',
    block: 2,
    room: 'bathroom',
    target: {
      id: 'b2_softener_target',
      label: 'Softener (pink cap)',
      description: 'Fabric softener with pink cap',
      emoji: '🧴',
      color: 'bg-pink-400',
    },
    distractor: {
      id: 'b2_softener_distractor',
      label: 'Softener (blue cap)',
      description: 'Fabric softener with blue cap',
      emoji: '🧴',
      color: 'bg-blue-400',
    },
    cue: 'pink cap (not blue)',
  },

  // ── Block 3 (Sophie) ──
  {
    taskId: 'b3_hanger',
    block: 3,
    room: 'study',
    target: {
      id: 'b3_hanger_target',
      label: 'Hanger (wide)',
      description: 'Wide-shoulder wooden hanger',
      emoji: '🪝',
      color: 'bg-amber-600',
    },
    distractor: {
      id: 'b3_hanger_distractor',
      label: 'Hanger (narrow)',
      description: 'Narrow-shoulder wooden hanger',
      emoji: '🪝',
      color: 'bg-yellow-700',
    },
    cue: 'wide shoulders (not narrow)',
  },
  {
    taskId: 'b3_speaker',
    block: 3,
    room: 'living_room',
    target: {
      id: 'b3_speaker_target',
      label: 'Speaker (fabric)',
      description: 'Round speaker with fabric cover',
      emoji: '🔊',
      color: 'bg-gray-500',
    },
    distractor: {
      id: 'b3_speaker_distractor',
      label: 'Speaker (rubber)',
      description: 'Round speaker with rubber cover',
      emoji: '🔊',
      color: 'bg-gray-800',
    },
    cue: 'fabric (not rubber)',
  },
  {
    taskId: 'b3_vase',
    block: 3,
    room: 'bedroom',
    target: {
      id: 'b3_vase_target',
      label: 'Vase (blue)',
      description: 'Small blue glazed ceramic vase',
      emoji: '🏺',
      color: 'bg-blue-500',
    },
    distractor: {
      id: 'b3_vase_distractor',
      label: 'Vase (green)',
      description: 'Small green glazed ceramic vase',
      emoji: '🏺',
      color: 'bg-green-500',
    },
    cue: 'blue (not green)',
  },
  {
    taskId: 'b3_handcream',
    block: 3,
    room: 'bathroom',
    target: {
      id: 'b3_handcream_target',
      label: 'Cream (lavender)',
      description: 'Hand cream with lavender label',
      emoji: '🧴',
      color: 'bg-purple-400',
    },
    distractor: {
      id: 'b3_handcream_distractor',
      label: 'Cream (mint)',
      description: 'Hand cream with mint label',
      emoji: '🧴',
      color: 'bg-green-400',
    },
    cue: 'lavender (not mint)',
  },
]

// Lookup by task_id for quick access
const TASK_ITEM_MAP = new Map(TASK_ITEM_PAIRS.map(p => [p.taskId, p]))

// Room label lookup for destination messages
const ROOM_LABELS: Record<string, string> = {
  kitchen: 'Kitchen',
  bedroom: 'Bedroom',
  living_room: 'Living Room',
  study: 'Study',
  bathroom: 'Bathroom',
}

interface PMTargetItemsProps {
  room: RoomId
}

export default function PMTargetItems({ room }: PMTargetItemsProps) {
  const activePMTrials = useGameStore((s) => s.activePMTrials)
  const completedPMTrialIds = useGameStore((s) => s.completedPMTrialIds)
  const completePMTrial = useGameStore((s) => s.completePMTrial)
  const wsSend = useGameStore((s) => s.wsSend)
  const blockNumber = useGameStore((s) => s.blockNumber)

  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)
  const [actionPhase, setActionPhase] = useState<'browse' | 'confirm' | 'done'>('browse')
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [destinationMsg, setDestinationMsg] = useState<string | null>(null)

  // Items for this room in the current block
  const roomItems = useMemo(() => {
    return TASK_ITEM_PAIRS.filter(p => p.room === room && p.block === blockNumber)
  }, [room, blockNumber])

  // Find the active PM trial for this room (at most one at a time)
  const activeTrial = useMemo(() => {
    return activePMTrials.find(
      t => t.taskConfig.target_room.toLowerCase() === room.toLowerCase()
        && !completedPMTrialIds.has(t.triggerId)
    )
  }, [activePMTrials, completedPMTrialIds, room])

  // The task_id of the currently active trial (if any)
  const activeTaskId = activeTrial?.taskConfig.task_id ?? null

  // Build renderable items: all room items as decorations, active ones interactive
  const renderItems = useMemo(() => {
    return roomItems.flatMap(pair => {
      const isActive = pair.taskId === activeTaskId
      // Deterministic order shuffle based on taskId
      const hash = pair.taskId.charCodeAt(pair.taskId.length - 1)
      const items = [
        { ...pair.target, isCorrect: true, taskId: pair.taskId, isActive },
        { ...pair.distractor, isCorrect: false, taskId: pair.taskId, isActive },
      ]
      return hash % 2 === 0 ? items : items.reverse()
    })
  }, [roomItems, activeTaskId])

  // Auto-clear destination message after 3s
  useEffect(() => {
    if (!destinationMsg) return
    const timer = setTimeout(() => setDestinationMsg(null), 3000)
    return () => clearTimeout(timer)
  }, [destinationMsg])

  const handleItemClick = useCallback((itemId: string) => {
    if (actionPhase !== 'browse' || selectedTarget) return
    setSelectedTarget(itemId)
    setActionPhase('confirm')
  }, [actionPhase, selectedTarget])

  const handleConfirmAction = useCallback(() => {
    if (!activeTrial || !selectedTarget) return

    const now = Date.now() / 1000
    const cfg = activeTrial.taskConfig
    const pair = TASK_ITEM_MAP.get(cfg.task_id)
    const isCorrect = pair ? selectedTarget === pair.target.id : false

    if (wsSend) {
      wsSend({
        type: 'pm_attempt',
        data: {
          action: 'pm_execute',
          action_step: cfg.target_action,
          target_selected: selectedTarget,
          room,
          timestamp: now,
          target_selected_at: now,
          action_completed_at: now,
        },
      })
    }

    setActionPhase('done')

    // Show destination message for correct target selection
    if (isCorrect && cfg.action_destination) {
      const destLabel = ROOM_LABELS[cfg.action_destination] || cfg.action_destination
      setDestinationMsg(`Now bring it to the ${destLabel}!`)
    }

    setTimeout(() => {
      completePMTrial(activeTrial.triggerId)
      setSelectedTarget(null)
      setActionPhase('browse')
    }, 1500)
  }, [activeTrial, selectedTarget, wsSend, room, completePMTrial])

  const handleCancelSelection = useCallback(() => {
    setSelectedTarget(null)
    setActionPhase('browse')
  }, [])

  if (renderItems.length === 0) return null

  const actionLabel = activeTrial
    ? activeTrial.taskConfig.target_action
    : ''

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-3 items-end flex-wrap">
        <AnimatePresence>
          {renderItems.map((item, idx) => {
            const isSelected = selectedTarget === item.id
            const isOther = selectedTarget && !isSelected
            const isDone = actionPhase === 'done' && isSelected
            const isActive = item.isActive

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ delay: idx * 0.05 }}
                className="relative"
                onMouseEnter={() => isActive ? setHoveredItem(item.id) : undefined}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <button
                  onClick={() => isActive ? handleItemClick(item.id) : undefined}
                  disabled={
                    !isActive
                    || actionPhase === 'done'
                    || (actionPhase === 'confirm' && !isSelected)
                  }
                  className={`
                    relative flex flex-col items-center justify-center
                    rounded-lg border-2 transition-all duration-200
                    ${isActive
                      ? isDone
                        ? 'w-16 h-16 border-green-400 bg-green-900/40 scale-105'
                        : isSelected
                        ? 'w-16 h-16 border-cooking-400 bg-cooking-900/30 scale-105 ring-2 ring-cooking-400/50'
                        : isOther
                        ? 'w-16 h-16 border-slate-600 bg-slate-800/60 opacity-40'
                        : 'w-16 h-16 border-slate-500 bg-slate-700/60 hover:border-slate-400 hover:bg-slate-600/60 cursor-pointer'
                      : 'w-10 h-10 border-slate-700/40 bg-slate-800/30 opacity-50 cursor-default'
                    }
                  `}
                >
                  {/* Color accent dot */}
                  <span className={`
                    absolute -top-1 -left-1 rounded-full
                    ${isActive ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5'}
                    ${item.color}
                  `} />

                  <span className={isActive ? 'text-xl' : 'text-sm'}>
                    {item.emoji}
                  </span>
                  {isActive && (
                    <span className="text-[8px] text-slate-300 mt-0.5 truncate max-w-[56px]">
                      {item.label}
                    </span>
                  )}

                  {/* Pulse ring when active and browsing */}
                  {isActive && actionPhase === 'browse' && !selectedTarget && (
                    <span className="absolute inset-0 rounded-lg border-2 border-cooking-400/40 animate-pulse pointer-events-none" />
                  )}

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

                {/* Tooltip on hover (active items only) */}
                <AnimatePresence>
                  {hoveredItem === item.id && isActive && actionPhase === 'browse' && (
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

      {/* Destination message after correct target selection */}
      <AnimatePresence>
        {destinationMsg && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-900/60
                       border border-emerald-500/40 rounded-lg text-emerald-200
                       text-xs font-medium w-fit"
          >
            <span className="text-base">➡️</span>
            {destinationMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
