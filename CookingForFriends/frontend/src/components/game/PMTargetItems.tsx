/** PM Target Items — scene-embedded interactive items for PM task execution.
 *
 * Renders target + 2 distractor items (3 per task) in each room using SVG
 * components from RoomItems. Items appear as subtle decorations when inactive
 * and become interactive when a PM trial fires. Only items from the currently
 * active block are shown.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'
import { ROOM_ITEMS } from './items/RoomItems'
import type { RoomItemProps } from './items/RoomItems'
import type { RoomId } from '../../types'
import { useSoundEffects } from '../../hooks/useSoundEffects'

// ── Item data for all 12 PM tasks (target + d1 + d2) ──

interface TaskItemInfo {
  id: string
  type: 'target' | 'd1' | 'd2'
  label: string
  description: string
}

interface TaskItemGroup {
  taskId: string
  block: number
  room: RoomId
  items: TaskItemInfo[]
}

const TASK_ITEMS: TaskItemGroup[] = [
  // Block 1
  {
    taskId: 'b1_book', block: 1, room: 'study',
    items: [
      { id: 'b1_book_target', type: 'target', label: 'Red book (mountain)', description: 'Red paperback with mountain illustration — "Erta Ale"' },
      { id: 'b1_book_d1', type: 'd1', label: 'Red book (ocean)', description: 'Red paperback with ocean illustration — "Blue Horizon"' },
      { id: 'b1_book_d2', type: 'd2', label: 'Blue book (mountain)', description: 'Blue paperback with mountain illustration — "Erta Ale"' },
    ]
  },
  {
    taskId: 'b1_giftbag', block: 1, room: 'dining_room',
    items: [
      { id: 'b1_giftbag_target', type: 'target', label: 'Small bag + bow', description: 'Small blue gift bag with bow decoration' },
      { id: 'b1_giftbag_d1', type: 'd1', label: 'Small bag + ribbon', description: 'Small blue gift bag with ribbon decoration' },
      { id: 'b1_giftbag_d2', type: 'd2', label: 'Medium bag + bow', description: 'Medium blue gift bag with bow decoration' },
    ]
  },
  {
    taskId: 'b1_dish', block: 1, room: 'living_room',
    items: [
      { id: 'b1_dish_target', type: 'target', label: 'Oval + blue handles', description: 'Oval white ceramic dish with blue handles' },
      { id: 'b1_dish_d1', type: 'd1', label: 'Round + blue handles', description: 'Round white ceramic dish with blue handles' },
      { id: 'b1_dish_d2', type: 'd2', label: 'Oval + red handles', description: 'Oval white ceramic dish with red handles' },
    ]
  },
  {
    taskId: 'b1_soap', block: 1, room: 'bathroom',
    items: [
      { id: 'b1_soap_target', type: 'target', label: 'Pump + lemon', description: 'White pump bottle with lemon label' },
      { id: 'b1_soap_d1', type: 'd1', label: 'Flip-cap + lemon', description: 'White flip-cap bottle with lemon label' },
      { id: 'b1_soap_d2', type: 'd2', label: 'Pump + mint', description: 'White pump bottle with mint label' },
    ]
  },
  // Block 2
  {
    taskId: 'b2_vinyl', block: 2, room: 'study',
    items: [
      { id: 'b2_vinyl_target', type: 'target', label: 'Car + Night Drive', description: 'Vinyl sleeve with car illustration, titled "Night Drive"' },
      { id: 'b2_vinyl_d1', type: 'd1', label: 'Car + Dark Side', description: 'Vinyl sleeve with car illustration, titled "Dark Side"' },
      { id: 'b2_vinyl_d2', type: 'd2', label: 'Abstract + Night Drive', description: 'Vinyl sleeve with abstract art, titled "Night Drive"' },
    ]
  },
  {
    taskId: 'b2_napkinrings', block: 2, room: 'dining_room',
    items: [
      { id: 'b2_napkinrings_target', type: 'target', label: 'Wood + light oak', description: 'Wooden napkin rings, light oak color' },
      { id: 'b2_napkinrings_d1', type: 'd1', label: 'Wood + dark', description: 'Wooden napkin rings, dark walnut color' },
      { id: 'b2_napkinrings_d2', type: 'd2', label: 'Metal + light', description: 'Metal napkin rings, silver polished' },
    ]
  },
  {
    taskId: 'b2_pot', block: 2, room: 'living_room',
    items: [
      { id: 'b2_pot_target', type: 'target', label: 'Medium + saucer', description: 'Medium terracotta pot with saucer' },
      { id: 'b2_pot_d1', type: 'd1', label: 'Small + saucer', description: 'Small terracotta pot with saucer' },
      { id: 'b2_pot_d2', type: 'd2', label: 'Medium + no saucer', description: 'Medium terracotta pot without saucer' },
    ]
  },
  {
    taskId: 'b2_softener', block: 2, room: 'bathroom',
    items: [
      { id: 'b2_softener_target', type: 'target', label: 'Lavender + purple', description: 'Purple bottle with lavender label' },
      { id: 'b2_softener_d1', type: 'd1', label: 'Eucalyptus + purple', description: 'Purple bottle with eucalyptus label' },
      { id: 'b2_softener_d2', type: 'd2', label: 'Lavender + white', description: 'White bottle with lavender label' },
    ]
  },
  // Block 3
  {
    taskId: 'b3_hanger', block: 3, room: 'study',
    items: [
      { id: 'b3_hanger_target', type: 'target', label: 'Wide + bar', description: 'Wooden hanger with wide shoulders and trouser bar' },
      { id: 'b3_hanger_d1', type: 'd1', label: 'Wide + no bar', description: 'Wooden hanger with wide shoulders, no bar' },
      { id: 'b3_hanger_d2', type: 'd2', label: 'Narrow + bar', description: 'Wooden hanger with narrow shoulders and trouser bar' },
    ]
  },
  {
    taskId: 'b3_speaker', block: 3, room: 'living_room',
    items: [
      { id: 'b3_speaker_target', type: 'target', label: 'Fabric + round', description: 'Round Bluetooth speaker with fabric mesh cover' },
      { id: 'b3_speaker_d1', type: 'd1', label: 'Rubber + round', description: 'Round Bluetooth speaker with rubber cover' },
      { id: 'b3_speaker_d2', type: 'd2', label: 'Fabric + square', description: 'Square Bluetooth speaker with fabric mesh cover' },
    ]
  },
  {
    taskId: 'b3_vase', block: 3, room: 'dining_room',
    items: [
      { id: 'b3_vase_target', type: 'target', label: 'Blue + small', description: 'Small ceramic vase with blue glaze' },
      { id: 'b3_vase_d1', type: 'd1', label: 'Green + small', description: 'Small ceramic vase with green glaze' },
      { id: 'b3_vase_d2', type: 'd2', label: 'Blue + large', description: 'Large ceramic vase with blue glaze' },
    ]
  },
  {
    taskId: 'b3_handcream', block: 3, room: 'bathroom',
    items: [
      { id: 'b3_handcream_target', type: 'target', label: 'Lavender + white', description: 'White tube with lavender label' },
      { id: 'b3_handcream_d1', type: 'd1', label: 'Mint + white', description: 'White tube with mint label' },
      { id: 'b3_handcream_d2', type: 'd2', label: 'Lavender + beige', description: 'Beige tube with lavender label' },
    ]
  },
]

// Room label lookup for destination messages
const ROOM_LABELS: Record<string, string> = {
  kitchen: 'Kitchen',
  dining_room: 'Dining Room',
  living_room: 'Living Room',
  study: 'Study',
  bathroom: 'Bathroom',
}

/** Deterministic shuffle: always produces the same order for a given taskId. */
function deterministicShuffle<T>(arr: T[], seed: string): T[] {
  const shuffled = [...arr]
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  }
  // Fisher-Yates with seeded PRNG
  let s = Math.abs(hash)
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const j = s % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/** Furniture labels and emoji for each room — clicking these opens the PM item popup. */
const ROOM_FURNITURE: Record<string, { label: string; emoji: string }> = {
  study: { label: 'Bookshelf', emoji: '📚' },
  dining_room: { label: 'Cabinet', emoji: '🗄️' },
  living_room: { label: 'Shelf', emoji: '📖' },
  bathroom: { label: 'Supply Shelf', emoji: '🧴' },
  kitchen: { label: 'Kitchen Shelf', emoji: '🍶' },
}

interface PMTargetItemsProps {
  room: RoomId
}

export default function PMTargetItems({ room }: PMTargetItemsProps) {
  const activePMTrials = useGameStore((s) => s.activePMTrials)
  const completedPMTrialIds = useGameStore((s) => s.completedPMTrialIds)
  const completePMTrial = useGameStore((s) => s.completePMTrial)
  const wsSend = useGameStore((s) => s.wsSend)
  const currentRoom = useGameStore((s) => s.currentRoom)
  const blockNumber = useGameStore((s) => s.blockNumber)

  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)
  const [actionPhase, setActionPhase] = useState<'browse' | 'confirm' | 'done'>('browse')
  const [popupOpen, setPopupOpen] = useState(false)
  const [destinationMsg, setDestinationMsg] = useState<string | null>(null)
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const play = useSoundEffects()

  useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current)
    }
  }, [])

  // Task groups for this room in the current block
  const roomTaskGroups = useMemo(() => {
    return TASK_ITEMS.filter(g => g.room === room && g.block === blockNumber)
  }, [room, blockNumber])

  // Find the active PM trial for this room (at most one at a time)
  const activeTrial = useMemo(() => {
    return activePMTrials.find(
      t => t.taskConfig?.target_room?.toLowerCase() === room.toLowerCase()
        && !completedPMTrialIds.has(t.triggerId)
    )
  }, [activePMTrials, completedPMTrialIds, room])

  const activeTaskId = activeTrial?.taskConfig.task_id ?? null

  // Auto-clear destination message after 3s
  useEffect(() => {
    if (!destinationMsg) return
    const timer = setTimeout(() => setDestinationMsg(null), 3000)
    return () => clearTimeout(timer)
  }, [destinationMsg])

  // Auto-close popup only when an active trial transitions to completed
  const prevActiveTrialRef = useRef(activeTrial)
  useEffect(() => {
    const hadTrial = !!prevActiveTrialRef.current
    prevActiveTrialRef.current = activeTrial
    if (hadTrial && !activeTrial && popupOpen) {
      setPopupOpen(false)
    }
  }, [activeTrial, popupOpen])

  // Reset state on room change
  useEffect(() => {
    setSelectedTarget(null)
    setActionPhase('browse')
    setPopupOpen(false)
  }, [room])

  const handleItemClick = useCallback((itemId: string) => {
    if (actionPhase === 'done') return
    // Allow switching selection in both browse and confirm phases
    setSelectedTarget(itemId)
    setActionPhase('confirm')
    play('pmSelect')
  }, [actionPhase, play])

  const handleConfirmAction = useCallback(() => {
    if (!activeTrial || !selectedTarget) return

    const now = Date.now() / 1000
    const cfg = activeTrial.taskConfig

    if (wsSend) {
      wsSend({
        type: 'pm_attempt',
        data: {
          action: 'pm_execute',
          action_step: cfg.target_action,
          target_selected: selectedTarget,
          room: currentRoom,
          timestamp: now,
          target_selected_at: now,
          action_completed_at: now,
        },
      })
    }

    setActionPhase('done')
    play('pmConfirm')
    // Show destination message for correct target selection
    const isCorrect = selectedTarget.endsWith('_target')
    if (isCorrect && cfg.action_destination) {
      const destLabel = ROOM_LABELS[cfg.action_destination] || cfg.action_destination
      setDestinationMsg(`Now bring it to the ${destLabel}!`)
    }

    if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current)
    confirmTimeoutRef.current = setTimeout(() => {
      completePMTrial(activeTrial.triggerId)
      setSelectedTarget(null)
      setActionPhase('browse')
      setPopupOpen(false)
      confirmTimeoutRef.current = null
    }, 1500)
  }, [activeTrial, selectedTarget, wsSend, currentRoom, completePMTrial, play])

  const handleCancelSelection = useCallback(() => {
    setSelectedTarget(null)
    setActionPhase('browse')
  }, [])

  const handleFurnitureClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setPopupOpen(prev => !prev)
    setSelectedTarget(null)
    setActionPhase('browse')
  }, [])

  const handleClosePopup = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setPopupOpen(false)
    setSelectedTarget(null)
    setActionPhase('browse')
  }, [])

  if (roomTaskGroups.length === 0) return null

  const furniture = ROOM_FURNITURE[room] || { label: 'Storage', emoji: '📦' }
  const hasActiveTask = !!activeTrial
  const actionLabel = activeTrial ? activeTrial.taskConfig.target_action : ''

  return (
    <div className="relative">
      {/* Clickable furniture button */}
      <button
        onClick={handleFurnitureClick}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium
          transition-all border cursor-pointer select-none ${
            hasActiveTask
              ? 'bg-amber-900/40 border-amber-500/60 text-amber-200 animate-pulse shadow-md shadow-amber-500/20'
              : 'bg-slate-800/50 border-slate-600/50 text-slate-300 hover:bg-slate-700/50'
          }`}
      >
        <span className="text-sm">{furniture.emoji}</span>
        <span>{furniture.label}</span>
        {hasActiveTask && <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />}
      </button>

      {/* Popup overlay — appears above/near the furniture */}
      <AnimatePresence>
        {popupOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="absolute bottom-full left-0 mb-2 z-[60]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900/95 backdrop-blur-md border border-slate-600/80 rounded-xl shadow-2xl
                            p-3 min-w-[260px] max-w-[320px]">
              {/* Popup header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-200">
                  {furniture.emoji} {furniture.label}
                </span>
                <button
                  onClick={handleClosePopup}
                  className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded
                             hover:bg-slate-700 transition-colors"
                >
                  ✕
                </button>
              </div>

              {!hasActiveTask ? (
                <p className="text-[10px] text-slate-500 text-center py-3">
                  Nothing to select right now.
                </p>
              ) : (
                <>
                  {roomTaskGroups.map(taskGroup => {
                    const isActive = taskGroup.taskId === activeTaskId
                    if (!isActive) return null

                    const itemGroup = ROOM_ITEMS[taskGroup.taskId]
                    if (!itemGroup) return null

                    const components: Array<{
                      id: string
                      type: 'target' | 'd1' | 'd2'
                      info: TaskItemInfo
                      Component: React.FC<RoomItemProps>
                    }> = [
                      { id: `${taskGroup.taskId}_target`, type: 'target', info: taskGroup.items[0], Component: itemGroup.target },
                      { id: `${taskGroup.taskId}_d1`, type: 'd1', info: taskGroup.items[1], Component: itemGroup.d1 },
                      { id: `${taskGroup.taskId}_d2`, type: 'd2', info: taskGroup.items[2], Component: itemGroup.d2 },
                    ]

                    const shuffled = deterministicShuffle(components, taskGroup.taskId)

                    return (
                      <div key={taskGroup.taskId}>
                        <p className="text-[9px] text-slate-400 mb-1.5">
                          Choose the correct item:
                        </p>

                        {/* Items displayed as cards in the popup */}
                        <div className="flex gap-2 justify-center">
                          {shuffled.map((item) => {
                            const isSelected = selectedTarget === item.id
                            const isDone = actionPhase === 'done' && isSelected

                            return (
                              <button
                                key={item.id}
                                onClick={() => handleItemClick(item.id)}
                                disabled={actionPhase === 'done' && !isSelected}
                                className={`relative flex flex-col items-center rounded-lg border-2 p-1.5
                                  transition-all cursor-pointer ${
                                    isDone
                                      ? 'border-green-400 bg-green-900/30'
                                      : isSelected
                                        ? 'border-amber-400 bg-amber-900/30 scale-105'
                                        : 'border-slate-600 bg-slate-800/60 hover:border-slate-400 hover:bg-slate-700/60'
                                  }`}
                              >
                                <svg viewBox="0 0 60 70" className="w-[60px] h-[70px]">
                                  <item.Component x={5} y={5} scale={0.85} clickable={false} />
                                </svg>
                                <span className="text-[8px] text-slate-300 mt-0.5 text-center leading-tight max-w-[70px]">
                                  {item.info.label}
                                </span>
                                {isDone && (
                                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-green-500 rounded-full
                                                  flex items-center justify-center text-white text-[10px] font-bold">
                                    ✓
                                  </div>
                                )}
                              </button>
                            )
                          })}
                        </div>

                        {/* Action confirmation */}
                        <AnimatePresence>
                          {actionPhase === 'confirm' && selectedTarget && (
                            <motion.div
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 5 }}
                              className="flex gap-1.5 mt-2 justify-center"
                            >
                              <button
                                onClick={handleConfirmAction}
                                className="px-3 py-1.5 bg-cooking-500 hover:bg-cooking-600
                                           text-white text-[10px] font-bold rounded-lg
                                           transition-colors cursor-pointer whitespace-nowrap"
                              >
                                {actionLabel}
                              </button>
                              <button
                                onClick={handleCancelSelection}
                                className="px-2 py-1.5 bg-slate-600 hover:bg-slate-500
                                           text-slate-200 text-[10px] rounded-lg
                                           transition-colors cursor-pointer"
                              >
                                ✕ Cancel
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Destination message after correct target selection */}
      <AnimatePresence>
        {destinationMsg && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute bottom-full left-0 mb-1 flex items-center gap-2 px-3 py-1.5 bg-emerald-900/60
                       border border-emerald-500/40 rounded-lg text-emerald-200
                       text-xs font-medium w-fit whitespace-nowrap"
          >
            <span className="text-base">➡️</span>
            {destinationMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
