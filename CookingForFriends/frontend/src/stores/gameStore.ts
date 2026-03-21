/** Global game store — Zustand. */

import { create } from 'zustand'
import type {
  Phase, Condition, RoomId, Pan, PhoneNotification, RobotState, SessionData,
  ActivePMTrial, PMTaskConfig, DiningPhase, SteakState,
} from '../types'

interface GameState {
  // ── Session ──
  sessionId: string | null
  participantId: string | null
  group: string | null
  conditionOrder: Condition[]
  blockNumber: number
  phase: Phase

  // ── Room ──
  currentRoom: RoomId
  previousRoom: RoomId | null
  avatarMoving: boolean

  // ── Kitchen ──
  pans: Pan[]
  kitchenScore: number

  // ── Dining ──
  diningPlacedItems: string[]
  diningPhase: DiningPhase
  messyItems: string[]

  // ── Visitors ──
  visitors: string[]

  // ── Phone ──
  phoneNotifications: PhoneNotification[]
  phoneLocked: boolean
  phoneLastActivity: number

  // ── Robot ──
  robot: RobotState

  // ── PM ──
  activePMTrials: ActivePMTrial[]
  completedPMTrialIds: Set<string>
  pmTargetSelected: string | null
  pmActionPhase: 'idle' | 'target_select' | 'action_confirm' | 'completed'

  // ── Trigger Effects ──
  activeTriggerEffects: Array<{ triggerEvent: string; timestamp: number }>

  // ── Game Clock ──
  gameClock: string
  elapsedSeconds: number

  // ── WebSocket ──
  wsConnected: boolean
  wsSend: ((msg: Record<string, unknown>) => void) | null

  // ── Actions ──
  setSession: (data: SessionData) => void
  setPhase: (phase: Phase) => void
  setBlockNumber: (n: number) => void
  setCurrentRoom: (room: RoomId) => void
  setAvatarMoving: (moving: boolean) => void

  // Kitchen actions
  setPans: (pans: Pan[]) => void
  updatePan: (panId: number, update: Partial<Pan>) => void
  addKitchenScore: (points: number) => void

  // Dining actions
  addDiningPlacedItem: (item: string) => void
  setDiningPhase: (phase: DiningPhase) => void
  removeMessyItem: (item: string) => void

  // Visitor actions
  addVisitor: (name: string) => void

  // Phone actions
  addPhoneNotification: (notif: PhoneNotification) => void
  setPhoneLocked: (locked: boolean) => void
  markNotificationRead: (id: string) => void

  // Robot actions
  setRobotSpeaking: (text: string) => void
  clearRobotSpeech: () => void
  setRobotRoom: (room: RoomId) => void

  // PM actions
  addPMTrial: (trial: ActivePMTrial) => void
  completePMTrial: (triggerId: string) => void
  setPMTargetSelected: (target: string | null) => void
  setPMActionPhase: (phase: 'idle' | 'target_select' | 'action_confirm' | 'completed') => void

  // Trigger effects
  addTriggerEffect: (triggerEvent: string) => void
  clearTriggerEffect: (triggerEvent: string) => void

  // Game clock
  setGameClock: (clock: string) => void
  setElapsedSeconds: (s: number) => void

  // Ongoing task events from backend
  handleOngoingTaskEvent: (data: Record<string, unknown>) => void

  // WS
  setWsConnected: (connected: boolean) => void
  setWsSend: (fn: (msg: Record<string, unknown>) => void) => void

  // Helpers
  getActivePMForRoom: (room: RoomId) => ActivePMTrial | undefined
  hasActivePMTrigger: () => boolean

  // Reset
  resetBlock: () => void
}

const initialPans: Pan[] = [
  { id: 1, state: 'empty', timer: null, placedAt: null },
  { id: 2, state: 'empty', timer: null, placedAt: null },
  { id: 3, state: 'empty', timer: null, placedAt: null },
]

export const useGameStore = create<GameState>((set, get) => ({
  // ── Session ──
  sessionId: null,
  participantId: null,
  group: null,
  conditionOrder: [],
  blockNumber: 1,
  phase: 'welcome',

  // ── Room ──
  currentRoom: 'kitchen',
  previousRoom: null,
  avatarMoving: false,

  // ── Kitchen ──
  pans: [...initialPans],
  kitchenScore: 0,

  // ── Dining ──
  diningPlacedItems: [],
  diningPhase: 'idle',
  messyItems: [],

  // ── Visitors ──
  visitors: [],

  // ── Phone ──
  phoneNotifications: [],
  phoneLocked: true,
  phoneLastActivity: Date.now(),

  // ── Robot ──
  robot: { room: 'kitchen', speaking: false, text: '', visible: true },

  // ── PM ──
  activePMTrials: [],
  completedPMTrialIds: new Set(),
  pmTargetSelected: null,
  pmActionPhase: 'idle',

  // ── Trigger Effects ──
  activeTriggerEffects: [],

  // ── Game Clock ──
  gameClock: '17:00',
  elapsedSeconds: 0,

  // ── WebSocket ──
  wsConnected: false,
  wsSend: null,

  // ── Actions ──
  setSession: (data) => set({
    sessionId: data.session_id,
    participantId: data.participant_id,
    group: data.group,
    conditionOrder: data.condition_order,
    blockNumber: data.current_block,
  }),

  setPhase: (phase) => set({ phase }),
  setBlockNumber: (n) => set({ blockNumber: n }),

  setCurrentRoom: (room) => {
    const prev = get().currentRoom
    set({ currentRoom: room, previousRoom: prev })
    const send = get().wsSend
    if (send) {
      send({
        type: 'room_switch',
        data: { from: prev, to: room, timestamp: Date.now() / 1000 },
      })
    }
  },

  setAvatarMoving: (moving) => set({ avatarMoving: moving }),

  // Kitchen
  setPans: (pans) => set({ pans }),
  updatePan: (panId, update) => set((s) => ({
    pans: s.pans.map((p) => p.id === panId ? { ...p, ...update } : p),
  })),
  addKitchenScore: (points) => set((s) => ({ kitchenScore: s.kitchenScore + points })),

  // Dining
  addDiningPlacedItem: (item) => set((s) => ({
    diningPlacedItems: s.diningPlacedItems.includes(item)
      ? s.diningPlacedItems
      : [...s.diningPlacedItems, item],
  })),
  setDiningPhase: (phase) => set({ diningPhase: phase }),
  removeMessyItem: (item) => set((s) => ({
    messyItems: s.messyItems.filter(i => i !== item),
  })),

  // Visitors
  addVisitor: (name) => set((s) => ({
    visitors: s.visitors.includes(name) ? s.visitors : [...s.visitors, name],
  })),

  // Phone
  addPhoneNotification: (notif) => set((s) => ({
    phoneNotifications: [...s.phoneNotifications, notif],
  })),
  setPhoneLocked: (locked) => set({ phoneLocked: locked, phoneLastActivity: Date.now() }),
  markNotificationRead: (id) => set((s) => ({
    phoneNotifications: s.phoneNotifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    ),
  })),

  // Robot
  setRobotSpeaking: (text) => set((s) => ({
    robot: { ...s.robot, speaking: true, text },
  })),
  clearRobotSpeech: () => set((s) => ({
    robot: { ...s.robot, speaking: false, text: '' },
  })),
  setRobotRoom: (room) => set((s) => ({
    robot: { ...s.robot, room },
  })),

  // PM
  addPMTrial: (trial) => set((s) => {
    if (s.completedPMTrialIds.has(trial.triggerId)) return s
    const exists = s.activePMTrials.some(t => t.triggerId === trial.triggerId)
    if (exists) return s
    return { activePMTrials: [...s.activePMTrials, trial] }
  }),

  completePMTrial: (triggerId) => set((s) => {
    const trial = s.activePMTrials.find(t => t.triggerId === triggerId)
    const newCompleted = new Set(s.completedPMTrialIds)
    newCompleted.add(triggerId)
    // Add visitor if trigger was visitor-type (doorbell/knock)
    const visitorTriggers = ['doorbell', 'knock', 'doorbell_ring']
    const newVisitors = trial && visitorTriggers.includes(trial.triggerEvent)
      ? [...s.visitors, trial.taskConfig.task_id.replace(/^pm_/, '').replace(/_/g, ' ')]
      : s.visitors
    return {
      activePMTrials: s.activePMTrials.filter(t => t.triggerId !== triggerId),
      completedPMTrialIds: newCompleted,
      pmTargetSelected: null,
      pmActionPhase: 'idle',
      visitors: newVisitors,
    }
  }),

  setPMTargetSelected: (target) => set({ pmTargetSelected: target }),
  setPMActionPhase: (phase) => set({ pmActionPhase: phase }),

  // Trigger effects
  addTriggerEffect: (triggerEvent) => set((s) => ({
    activeTriggerEffects: [
      ...s.activeTriggerEffects,
      { triggerEvent, timestamp: Date.now() },
    ],
  })),
  clearTriggerEffect: (triggerEvent) => set((s) => ({
    activeTriggerEffects: s.activeTriggerEffects.filter(
      e => e.triggerEvent !== triggerEvent
    ),
  })),

  // Game clock
  setGameClock: (clock) => set({ gameClock: clock }),
  setElapsedSeconds: (s) => set({ elapsedSeconds: s }),

  // Ongoing task event dispatcher from backend timeline
  handleOngoingTaskEvent: (data) => {
    const task = data.task as string
    const event = data.event as string

    if (task === 'steak') {
      if (event === 'auto_place' || event === 'place_meat') {
        const pans = get().pans
        const emptyPan = pans.find(p => p.state === 'empty')
        if (emptyPan) {
          set({
            pans: pans.map(p =>
              p.id === emptyPan.id
                ? { ...p, state: 'cooking' as const, placedAt: Date.now() }
                : p
            ),
          })
        }
      } else if (event === 'urgent_flip' || event === 'ready_to_flip') {
        const pans = get().pans
        const cookingPan = pans.find(p => p.state === 'cooking')
        if (cookingPan) {
          set({
            pans: pans.map(p =>
              p.id === cookingPan.id
                ? { ...p, state: 'ready_to_flip' as const }
                : p
            ),
          })
        }
      }
    } else if (task === 'dining') {
      if (event === 'table_messy' || event === 'table_needs_clearing') {
        const itemCount = (data.items_to_clear as number) || 6
        const labels = ['📰 Old newspaper', '☕ Dirty mug', '🍬 Candy wrapper',
                        '📮 Junk mail', '🥤 Empty glass', '🧾 Old receipt',
                        '📋 Used napkin', '🍪 Crumb plate']
        const items = labels.slice(0, itemCount)
        set({ diningPhase: 'messy' as const, messyItems: items })
      } else if (event === 'table_cleared_check') {
        if (get().messyItems.length === 0) {
          set({ diningPhase: 'setting' as const })
        }
      }
    }
  },

  // WS
  setWsConnected: (connected) => set({ wsConnected: connected }),
  setWsSend: (fn) => set({ wsSend: fn }),

  // Helpers
  getActivePMForRoom: (room) => {
    return get().activePMTrials.find(
      t => t.taskConfig.target_room.toLowerCase() === room.toLowerCase()
    )
  },

  hasActivePMTrigger: () => get().activePMTrials.length > 0,

  // Reset for new block
  resetBlock: () => set({
    currentRoom: 'kitchen',
    previousRoom: null,
    avatarMoving: false,
    pans: [...initialPans],
    kitchenScore: 0,
    diningPlacedItems: [],
    diningPhase: 'idle',
    messyItems: [],
    visitors: [],
    phoneNotifications: [],
    phoneLocked: true,
    robot: { room: 'kitchen', speaking: false, text: '', visible: true },
    activePMTrials: [],
    completedPMTrialIds: new Set(),
    pmTargetSelected: null,
    pmActionPhase: 'idle',
    activeTriggerEffects: [],
    gameClock: '17:00',
    elapsedSeconds: 0,
  }),
}))
