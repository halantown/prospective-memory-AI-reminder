/** Global game store — Zustand. */

import { create } from 'zustand'
import type {
  Phase, Condition, RoomId, Pan, PhoneNotification, RobotState, SessionData,
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

  // ── Phone ──
  phoneNotifications: PhoneNotification[]
  phoneLocked: boolean
  phoneLastActivity: number

  // ── Robot ──
  robot: RobotState

  // ── PM ──
  pmTriggered: string | null  // trigger_id of active PM trigger
  pmTriggerEvent: string | null
  executionWindowActive: boolean

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

  // Phone actions
  addPhoneNotification: (notif: PhoneNotification) => void
  setPhoneLocked: (locked: boolean) => void
  markNotificationRead: (id: string) => void

  // Robot actions
  setRobotSpeaking: (text: string) => void
  clearRobotSpeech: () => void
  setRobotRoom: (room: RoomId) => void

  // PM actions
  triggerPM: (triggerId: string, triggerEvent: string) => void
  clearPMTrigger: () => void

  // Game clock
  setGameClock: (clock: string) => void
  setElapsedSeconds: (s: number) => void

  // WS
  setWsConnected: (connected: boolean) => void
  setWsSend: (fn: (msg: Record<string, unknown>) => void) => void

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

  // ── Phone ──
  phoneNotifications: [],
  phoneLocked: true,
  phoneLastActivity: Date.now(),

  // ── Robot ──
  robot: { room: 'kitchen', speaking: false, text: '', visible: true },

  // ── PM ──
  pmTriggered: null,
  pmTriggerEvent: null,
  executionWindowActive: false,

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
    // Report room switch to backend
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
  triggerPM: (triggerId, triggerEvent) => set({
    pmTriggered: triggerId,
    pmTriggerEvent: triggerEvent,
    executionWindowActive: true,
  }),
  clearPMTrigger: () => set({
    pmTriggered: null,
    pmTriggerEvent: null,
    executionWindowActive: false,
  }),

  // Game clock
  setGameClock: (clock) => set({ gameClock: clock }),
  setElapsedSeconds: (s) => set({ elapsedSeconds: s }),

  // WS
  setWsConnected: (connected) => set({ wsConnected: connected }),
  setWsSend: (fn) => set({ wsSend: fn }),

  // Reset for new block
  resetBlock: () => set({
    currentRoom: 'kitchen',
    previousRoom: null,
    avatarMoving: false,
    pans: [...initialPans],
    kitchenScore: 0,
    phoneNotifications: [],
    phoneLocked: true,
    robot: { room: 'kitchen', speaking: false, text: '', visible: true },
    pmTriggered: null,
    pmTriggerEvent: null,
    executionWindowActive: false,
    gameClock: '17:00',
    elapsedSeconds: 0,
  }),
}))
