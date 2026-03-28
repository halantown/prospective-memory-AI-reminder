/** Global game store — Zustand. */

import { create } from 'zustand'
import type {
  Phase, Condition, RoomId, Pan, PhoneNotification, PhoneMessage, RobotState, SessionData,
  ActivePMTrial, PMTaskConfig, DiningPhase, SteakState, SeatState, UtensilType,
} from '../types'

const EMPTY_SEAT: SeatState = { plate: false, knife: false, fork: false, glass: false }

/** Max visible phone messages — when a new one arrives and we're at max, oldest gets dismissed. */
const MAX_PHONE_MESSAGES = 5

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
  diningPhase: DiningPhase
  diningSeats: SeatState[]
  diningSelectedUtensil: UtensilType | null
  diningRound: number
  diningScore: number

  // ── Visitors ──
  visitors: string[]

  // ── Phone ──
  phoneMessages: PhoneMessage[]
  phoneNotifications: PhoneNotification[]  // backward compat
  phoneLocked: boolean
  phoneLastActivity: number
  phoneBanner: PhoneMessage | null

  // ── Robot ──
  robot: RobotState

  // ── PM ──
  activePMTrials: ActivePMTrial[]
  completedPMTrialIds: Set<string>
  pmTargetSelected: string | null
  pmActionPhase: 'idle' | 'target_select' | 'action_confirm' | 'completed'

  // ── Trigger Effects ──
  activeTriggerEffects: Array<{ triggerEvent: string; timestamp: number; isFake?: boolean; duration?: number }>

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
  setDiningPhase: (phase: DiningPhase) => void
  selectUtensil: (utensil: UtensilType | null) => void
  placeUtensil: (seatIndex: number) => boolean
  completeDiningRound: () => void
  addDiningScore: (points: number) => void

  // Visitor actions
  addVisitor: (name: string) => void

  // Phone actions
  addPhoneMessage: (msg: PhoneMessage) => void
  addPhoneNotification: (notif: PhoneNotification) => void
  setPhoneLocked: (locked: boolean) => void
  markNotificationRead: (id: string) => void
  markMessageRead: (id: string) => void
  answerPhoneMessage: (messageId: string, choiceIndex: number) => void
  expirePhoneMessage: (id: string) => void
  removePhoneMessage: (id: string) => void
  setPhoneBanner: (msg: PhoneMessage | null) => void

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
  addTriggerEffect: (triggerEvent: string, opts?: { isFake?: boolean; duration?: number }) => void
  clearTriggerEffect: (triggerEvent: string, timestamp?: number) => void

  // Game clock
  setGameClock: (clock: string) => void
  setElapsedSeconds: (s: number) => void

  // Ongoing task events from backend
  handleOngoingTaskEvent: (data: Record<string, unknown>) => void

  // WS
  setWsConnected: (connected: boolean) => void
  setWsSend: (fn: ((msg: Record<string, unknown>) => void) | null) => void

  // Helpers
  getActivePMForRoom: (room: RoomId) => ActivePMTrial | undefined
  hasActivePMTrigger: () => boolean
  totalScore: () => number

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
  diningPhase: 'idle',
  diningSeats: [{ ...EMPTY_SEAT }, { ...EMPTY_SEAT }, { ...EMPTY_SEAT }, { ...EMPTY_SEAT }],
  diningSelectedUtensil: null,
  diningRound: 0,
  diningScore: 0,

  // ── Visitors ──
  visitors: [],

  // ── Phone ──
  phoneMessages: [],
  phoneNotifications: [],
  phoneLocked: true,
  phoneLastActivity: Date.now(),
  phoneBanner: null,

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
  setDiningPhase: (phase) => set({ diningPhase: phase }),
  selectUtensil: (utensil) => set({ diningSelectedUtensil: utensil }),
  placeUtensil: (seatIndex) => {
    const { diningSeats, diningSelectedUtensil } = get()
    if (!diningSelectedUtensil) return false
    const seat = diningSeats[seatIndex]
    if (!seat || seat[diningSelectedUtensil]) return false

    const newSeats = diningSeats.map((s, i) =>
      i === seatIndex ? { ...s, [diningSelectedUtensil]: true } : s
    )
    set({ diningSeats: newSeats, diningSelectedUtensil: null })
    return true
  },
  completeDiningRound: () => set((s) => ({
    diningRound: s.diningRound + 1,
    diningScore: s.diningScore + 20,
    diningSeats: [{ ...EMPTY_SEAT }, { ...EMPTY_SEAT }, { ...EMPTY_SEAT }, { ...EMPTY_SEAT }],
    diningSelectedUtensil: null,
  })),
  addDiningScore: (points) => set((s) => ({ diningScore: s.diningScore + points })),

  // Visitors
  addVisitor: (name) => set((s) => ({
    visitors: s.visitors.includes(name) ? s.visitors : [...s.visitors, name],
  })),

  // Phone
  addPhoneMessage: (msg) => set((s) => {
    let messages = [...s.phoneMessages, msg]
    // Enforce max visible: dismiss oldest active if over limit
    const active = messages.filter(m => m.status === 'active')
    if (active.length > MAX_PHONE_MESSAGES) {
      const oldest = active[0]
      messages = messages.map(m =>
        m.id === oldest.id ? { ...m, status: 'dismissed' as const } : m
      )
    }
    return { phoneMessages: messages }
  }),
  addPhoneNotification: (notif) => set((s) => ({
    phoneNotifications: [...s.phoneNotifications, notif],
  })),
  setPhoneLocked: (locked) => set({ phoneLocked: locked, phoneLastActivity: Date.now() }),
  markNotificationRead: (id) => set((s) => ({
    phoneNotifications: s.phoneNotifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    ),
  })),
  markMessageRead: (id) => set((s) => ({
    phoneMessages: s.phoneMessages.map((m) =>
      m.id === id ? { ...m, read: true } : m
    ),
  })),
  answerPhoneMessage: (messageId, choiceIndex) => set((s) => ({
    phoneMessages: s.phoneMessages.map((m) => {
      if (m.id !== messageId || m.status !== 'active') return m
      const isCorrect = m.correctIndex !== undefined && choiceIndex === m.correctIndex
      return {
        ...m,
        status: (isCorrect ? 'answered_correct' : 'answered_incorrect') as PhoneMessage['status'],
        userChoice: choiceIndex,
        respondedAt: Date.now(),
      }
    }),
  })),
  expirePhoneMessage: (id) => set((s) => ({
    phoneMessages: s.phoneMessages.map((m) =>
      m.id === id && m.status === 'active' ? { ...m, status: 'dismissed' as const } : m
    ),
  })),
  removePhoneMessage: (id) => set((s) => ({
    phoneMessages: s.phoneMessages.filter((m) => m.id !== id),
  })),
  setPhoneBanner: (msg) => set({ phoneBanner: msg }),

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
  addTriggerEffect: (triggerEvent, opts) => set((s) => ({
    activeTriggerEffects: [
      ...s.activeTriggerEffects,
      { triggerEvent, timestamp: Date.now(), ...opts },
    ],
  })),
  clearTriggerEffect: (triggerEvent, timestamp) => set((s) => ({
    activeTriggerEffects: s.activeTriggerEffects.filter(e => {
      if (e.triggerEvent !== triggerEvent) return true
      if (timestamp !== undefined) return e.timestamp !== timestamp
      return false
    }),
  })),

  // Game clock
  setGameClock: (clock) => set({ gameClock: clock }),
  setElapsedSeconds: (s) => set({ elapsedSeconds: s }),

  // Ongoing task event dispatcher from backend timeline
  handleOngoingTaskEvent: (data) => {
    const task = data.task as string
    const event = data.event as string

    if (task === 'steak') {
      if (event === 'place_steak' || event === 'auto_place' || event === 'place_meat') {
        const panId = data.pan as number | undefined
        const pans = get().pans

        // Target a specific pan if specified, otherwise find first empty
        const targetPan = panId
          ? pans.find(p => p.id === panId && p.state === 'empty')
          : pans.find(p => p.state === 'empty')

        if (targetPan) {
          set({
            pans: pans.map(p =>
              p.id === targetPan.id
                ? { ...p, state: 'cooking' as const, placedAt: Date.now() }
                : p
            ),
          })
        }
      }
    } else if (task === 'dining') {
      if (event === 'table_ready') {
        set({ diningPhase: 'active' as const })
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

  totalScore: () => get().kitchenScore + get().diningScore,

  // Reset for new block
  resetBlock: () => set({
    currentRoom: 'kitchen',
    previousRoom: null,
    avatarMoving: false,
    pans: [...initialPans],
    kitchenScore: 0,
    diningPhase: 'idle',
    diningSeats: [{ ...EMPTY_SEAT }, { ...EMPTY_SEAT }, { ...EMPTY_SEAT }, { ...EMPTY_SEAT }],
    diningSelectedUtensil: null,
    diningRound: 0,
    diningScore: 0,
    visitors: [],
    phoneMessages: [],
    phoneNotifications: [],
    phoneLocked: true,
    phoneBanner: null,
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
