/** PM Target Items — scene-embedded interactive items for PM task execution.
 *
 * Renders target + 2 distractor items (3 per task) in each room using SVG
 * components from RoomItems. Items appear as subtle decorations when inactive
 * and become interactive when a PM trial fires. Only items from the currently
 * active block are shown.
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../stores/gameStore'
import { ROOM_ITEMS } from './items/RoomItems'
import type { RoomItemProps } from './items/RoomItems'
import type { RoomId } from '../../types'

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
    taskId: 'b1_giftbag', block: 1, room: 'bedroom',
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
    taskId: 'b2_napkinrings', block: 2, room: 'bedroom',
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
    taskId: 'b3_vase', block: 3, room: 'bedroom',
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
  bedroom: 'Bedroom',
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
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [destinationMsg, setDestinationMsg] = useState<string | null>(null)

  // Task groups for this room in the current block
  const roomTaskGroups = useMemo(() => {
    return TASK_ITEMS.filter(g => g.room === room && g.block === blockNumber)
  }, [room, blockNumber])

  // Find the active PM trial for this room (at most one at a time)
  const activeTrial = useMemo(() => {
    return activePMTrials.find(
      t => t.taskConfig.target_room.toLowerCase() === room.toLowerCase()
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

  const handleItemClick = useCallback((itemId: string) => {
    if (actionPhase !== 'browse' || selectedTarget) return
    setSelectedTarget(itemId)
    setActionPhase('confirm')
  }, [actionPhase, selectedTarget])

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

    // Show destination message for correct target selection
    const isCorrect = selectedTarget.endsWith('_target')
    if (isCorrect && cfg.action_destination) {
      const destLabel = ROOM_LABELS[cfg.action_destination] || cfg.action_destination
      setDestinationMsg(`Now bring it to the ${destLabel}!`)
    }

    setTimeout(() => {
      completePMTrial(activeTrial.triggerId)
      setSelectedTarget(null)
      setActionPhase('browse')
    }, 1500)
  }, [activeTrial, selectedTarget, wsSend, currentRoom, completePMTrial])

  const handleCancelSelection = useCallback(() => {
    setSelectedTarget(null)
    setActionPhase('browse')
  }, [])

  if (roomTaskGroups.length === 0) return null

  const actionLabel = activeTrial
    ? activeTrial.taskConfig.target_action
    : ''

  return (
    <div className="mt-2 space-y-2">
      {roomTaskGroups.map(taskGroup => {
        const isActive = taskGroup.taskId === activeTaskId
        const itemGroup = ROOM_ITEMS[taskGroup.taskId]
        if (!itemGroup) return null

        // Build renderable item list with SVG components
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
          <div key={taskGroup.taskId} className="flex gap-2 items-end flex-wrap">
            {/* SVG item container */}
            <svg
              viewBox="0 0 240 80"
              className={`max-w-[360px] ${isActive ? 'w-full' : 'w-[180px] opacity-50'}`}
            >
              {shuffled.map((item, i) => {
                const isSelected = selectedTarget === item.id
                const isDone = actionPhase === 'done' && isSelected

                return (
                  <g key={item.id}>
                    {/* Selection highlight ring */}
                    {isActive && isSelected && (
                      <rect
                        x={6 + i * 80} y={1}
                        width={68} height={78}
                        rx={8}
                        fill="none"
                        stroke={isDone ? '#4ade80' : '#f59e0b'}
                        strokeWidth={2}
                        opacity={0.8}
                      />
                    )}
                    {/* Pulse indicator when browsing */}
                    {isActive && actionPhase === 'browse' && !selectedTarget && (
                      <rect
                        x={6 + i * 80} y={1}
                        width={68} height={78}
                        rx={8}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth={1}
                        opacity={0.3}
                        className="animate-pulse"
                      />
                    )}
                    <item.Component
                      x={10 + i * 80}
                      y={5}
                      scale={isActive ? 0.9 : 0.6}
                      clickable={isActive && actionPhase === 'browse'}
                      onClick={() => handleItemClick(item.id)}
                    />
                    {/* Done checkmark */}
                    {isDone && (
                      <>
                        <circle cx={68 + i * 80} cy={8} r={6} fill="#22c55e" />
                        <text x={68 + i * 80} y={11} textAnchor="middle" fontSize={8} fill="white">✓</text>
                      </>
                    )}
                  </g>
                )
              })}
            </svg>

            {/* Tooltip on hover (active items only) */}
            <AnimatePresence>
              {isActive && hoveredItem && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5
                             text-[10px] text-slate-200 whitespace-nowrap z-30 shadow-lg"
                >
                  {taskGroup.items.find(it => it.id === hoveredItem)?.description}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Hover detection layer — positioned over SVG items */}
            {isActive && (
              <div className="absolute" style={{ pointerEvents: 'none' }}>
                {shuffled.map((item) => (
                  <div
                    key={`hover_${item.id}`}
                    style={{ pointerEvents: 'auto', position: 'absolute' }}
                    onMouseEnter={() => setHoveredItem(item.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                  />
                ))}
              </div>
            )}

            {/* Action confirmation */}
            <AnimatePresence>
              {isActive && actionPhase === 'confirm' && selectedTarget && (
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
      })}

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
