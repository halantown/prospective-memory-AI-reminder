/** Global game store — Zustand. */

import { create } from 'zustand'
import type {
  Phase, Condition, RoomId, Pan, PhoneNotification, PhoneMessage, RobotState, SessionData,
  ActivePMTrial, PMTaskConfig, DiningPhase, SteakState, SeatState, UtensilType,
  DishId, DishState, KitchenStationId, Contact,
} from '../types'

const EMPTY_SEAT: SeatState = { plate: false, knife: false, fork: false, glass: false }

/** Max visible phone messages — unused in chat mode but kept for backward compat. */
const MAX_PHONE_MESSAGES = 50

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

  // ── Kitchen (legacy steak pans — kept for backward compat) ──
  pans: Pan[]
  kitchenScore: number

  // ── Cooking (new multi-dish system) ──
  dishes: Record<DishId, DishState>
  /** Which station's popup is currently open */
  activeStation: KitchenStationId | null

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
  contacts: Contact[]
  activeContactId: string | null
  activePhoneTab: 'chats' | 'recipe'
  kitchenTimerQueue: Array<{ id: string; icon: string; message: string; appearedAt: number }>
  recipeTabBounce: boolean

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

  // Kitchen actions (legacy)
  setPans: (pans: Pan[]) => void
  updatePan: (panId: number, update: Partial<Pan>) => void
  addKitchenScore: (points: number) => void

  // Cooking actions (new multi-dish)
  setActiveStation: (station: KitchenStationId | null) => void
  advanceDishStep: (dishId: DishId) => void
  setDishStepReady: (dishId: DishId, ready: boolean) => void
  setDishPhase: (dishId: DishId, phase: DishState['phase']) => void

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
  markContactMessagesRead: (contactId: string) => void
  answerPhoneMessage: (messageId: string, chosenText: string, isCorrect: boolean) => void
  expirePhoneMessage: (id: string) => void
  removePhoneMessage: (id: string) => void
  setPhoneBanner: (msg: PhoneMessage | null) => void
  setContacts: (contacts: Contact[]) => void
  setActiveContactId: (id: string | null) => void
  setActivePhoneTab: (tab: 'chats' | 'recipe') => void
  pushKitchenTimer: (timer: { id: string; icon: string; message: string }) => void
  dismissKitchenTimer: () => void
  setRecipeTabBounce: (bounce: boolean) => void

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

/** Spaghetti recipe steps */
const SPAGHETTI_STEPS: DishState['steps'] = [
  { id: 'place_pot',    label: 'Place pot of water', station: 'burner1', description: 'Put a pot of water on the burner' },
  { id: 'add_pasta',    label: 'Add pasta',          station: 'burner1', description: 'Add spaghetti to boiling water' },
  { id: 'drain',        label: 'Drain pasta',        station: 'burner1', description: 'Drain the cooked pasta' },
  { id: 'add_sauce',    label: 'Add sauce',          station: 'spice_rack', description: 'Add tomato sauce' },
  { id: 'toss',         label: 'Toss pasta',         station: 'burner1', description: 'Toss pasta with sauce' },
  { id: 'plate',        label: 'Plate spaghetti',    station: 'plating_area', description: 'Plate the finished spaghetti' },
]

/** Steak recipe steps */
const STEAK_STEPS: DishState['steps'] = [
  { id: 'select_steak', label: 'Select steak',    station: 'fridge',        description: 'Get the steak from the fridge' },
  { id: 'season',       label: 'Season steak',    station: 'cutting_board', description: 'Season and marinate the steak' },
  { id: 'heat_pan',     label: 'Heat pan',        station: 'burner3',       description: 'Heat up the pan' },
  { id: 'place_steak',  label: 'Place steak',     station: 'burner3',       description: 'Place steak in hot pan' },
  { id: 'flip',         label: 'Flip steak',      station: 'burner3',       description: 'Flip to cook other side' },
  { id: 'remove',       label: 'Remove steak',    station: 'burner3',       description: 'Remove from pan' },
  { id: 'plate',        label: 'Plate steak',     station: 'plating_area',  description: 'Plate the finished steak' },
]

/** Tomato soup recipe steps */
const SOUP_STEPS: DishState['steps'] = [
  { id: 'select_ingr',  label: 'Select ingredients', station: 'fridge',        description: 'Get onion and tomatoes' },
  { id: 'chop',         label: 'Chop vegetables',    station: 'cutting_board', description: 'Chop onion and tomato' },
  { id: 'saute',        label: 'Sauté base',         station: 'burner2',       description: 'Sauté the chopped vegetables' },
  { id: 'add_water',    label: 'Add water',           station: 'burner2',       description: 'Add water to the pot' },
  { id: 'stir',         label: 'Stir soup',           station: 'burner2',       description: 'Give the soup a stir' },
  { id: 'season',       label: 'Add seasoning',       station: 'spice_rack',    description: 'Season the soup' },
  { id: 'ladle',        label: 'Ladle into bowl',     station: 'plating_area',  description: 'Ladle soup into serving bowl' },
]

/** Roasted vegetables recipe steps */
const VEGGIE_STEPS: DishState['steps'] = [
  { id: 'select_veggies', label: 'Select vegetables',    station: 'fridge',        description: 'Get vegetables from the fridge' },
  { id: 'chop',           label: 'Chop vegetables',      station: 'cutting_board', description: 'Chop the vegetables' },
  { id: 'season',         label: 'Season vegetables',    station: 'spice_rack',    description: 'Add oil, salt, and herbs' },
  { id: 'place_tray',     label: 'Place on baking tray', station: 'oven',          description: 'Arrange on baking tray' },
  { id: 'set_oven',       label: 'Set oven temperature', station: 'oven',          description: 'Set oven to 200°C' },
  { id: 'remove_tray',    label: 'Remove from oven',     station: 'oven',          description: 'Take the tray out of the oven' },
  { id: 'plate',          label: 'Plate vegetables',     station: 'plating_area',  description: 'Plate the roasted vegetables' },
]

function createInitialDishes(): Record<DishId, DishState> {
  return {
    spaghetti: {
      id: 'spaghetti', label: 'Spaghetti', emoji: '🍝',
      phase: 'idle', currentStepIndex: 0, steps: SPAGHETTI_STEPS,
      stepReady: true, startedAt: null, completedAt: null,
    },
    steak: {
      id: 'steak', label: 'Steak', emoji: '🥩',
      phase: 'idle', currentStepIndex: 0, steps: STEAK_STEPS,
      stepReady: false, startedAt: null, completedAt: null,
    },
    tomato_soup: {
      id: 'tomato_soup', label: 'Tomato Soup', emoji: '🍅',
      phase: 'idle', currentStepIndex: 0, steps: SOUP_STEPS,
      stepReady: false, startedAt: null, completedAt: null,
    },
    roasted_vegetables: {
      id: 'roasted_vegetables', label: 'Roasted Vegetables', emoji: '🥕',
      phase: 'idle', currentStepIndex: 0, steps: VEGGIE_STEPS,
      stepReady: false, startedAt: null, completedAt: null,
    },
  }
}

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

  // ── Kitchen (legacy) ──
  pans: [...initialPans],
  kitchenScore: 0,

  // ── Cooking (new multi-dish) ──
  dishes: createInitialDishes(),
  activeStation: null,

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
  contacts: [],
  activeContactId: null,
  activePhoneTab: 'chats',
  kitchenTimerQueue: [],
  recipeTabBounce: false,

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

  // Kitchen (legacy)
  setPans: (pans) => set({ pans }),
  updatePan: (panId, update) => set((s) => ({
    pans: s.pans.map((p) => p.id === panId ? { ...p, ...update } : p),
  })),
  addKitchenScore: (points) => set((s) => ({ kitchenScore: s.kitchenScore + points })),

  // Cooking (new multi-dish)
  setActiveStation: (station) => set({ activeStation: station }),

  advanceDishStep: (dishId) => {
    const dishes = get().dishes
    const dish = dishes[dishId]
    if (!dish || dish.currentStepIndex >= dish.steps.length) return

    const nextIndex = dish.currentStepIndex + 1
    const isComplete = nextIndex >= dish.steps.length
    const now = Date.now()

    // Report action to backend
    const send = get().wsSend
    if (send) {
      const step = dish.steps[dish.currentStepIndex]
      send({
        type: 'task_action',
        data: {
          task: 'cooking',
          action: step.id,
          dish: dishId,
          step_index: dish.currentStepIndex,
          timestamp: now / 1000,
        },
      })
    }

    set({
      dishes: {
        ...dishes,
        [dishId]: {
          ...dish,
          currentStepIndex: nextIndex,
          phase: isComplete ? 'plated' : dish.phase === 'idle' ? 'prep' : dish.phase,
          stepReady: false, // backend must gate the next step
          startedAt: dish.startedAt ?? now,
          completedAt: isComplete ? now : null,
        },
      },
    })
  },

  setDishStepReady: (dishId, ready) => set((s) => ({
    dishes: {
      ...s.dishes,
      [dishId]: { ...s.dishes[dishId], stepReady: ready },
    },
  })),

  setDishPhase: (dishId, phase) => set((s) => ({
    dishes: {
      ...s.dishes,
      [dishId]: { ...s.dishes[dishId], phase },
    },
  })),

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
    const messages = [...s.phoneMessages, msg]
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
  markContactMessagesRead: (contactId) => set((s) => ({
    phoneMessages: s.phoneMessages.map((m) =>
      m.contactId === contactId && !m.read ? { ...m, read: true } : m
    ),
  })),
  answerPhoneMessage: (messageId, chosenText, isCorrect) => set((s) => ({
    phoneMessages: s.phoneMessages.map((m) => {
      if (m.id !== messageId || m.answered) return m
      return {
        ...m,
        answered: true,
        answeredCorrect: isCorrect,
        userChoice: chosenText,
        respondedAt: Date.now(),
      }
    }),
  })),
  expirePhoneMessage: (_id) => {
    // No-op in chat mode — messages persist in conversation
  },
  removePhoneMessage: (id) => set((s) => ({
    phoneMessages: s.phoneMessages.filter((m) => m.id !== id),
  })),
  setPhoneBanner: (msg) => set({ phoneBanner: msg }),
  setContacts: (contacts) => set({ contacts }),
  setActiveContactId: (id) => set({ activeContactId: id }),
  setActivePhoneTab: (tab) => set({ activePhoneTab: tab }),
  pushKitchenTimer: (timer) => set((s) => ({
    kitchenTimerQueue: [...s.kitchenTimerQueue, { ...timer, appearedAt: Date.now() }],
  })),
  dismissKitchenTimer: () => set((s) => ({
    kitchenTimerQueue: s.kitchenTimerQueue.slice(1),
  })),
  setRecipeTabBounce: (bounce) => set({ recipeTabBounce: bounce }),

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
    } else if (task === 'cooking') {
      // New multi-dish cooking events from backend
      const dishId = data.dish as DishId | undefined
      if (!dishId) return

      if (event === 'step_ready') {
        // Backend signals that the next step can be performed
        get().setDishStepReady(dishId, true)
      } else if (event === 'phase_change') {
        const phase = data.phase as DishState['phase']
        if (phase) get().setDishPhase(dishId, phase)
      } else if (event === 'unlock_dish') {
        // Backend unlocks a dish for cooking
        get().setDishStepReady(dishId, true)
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
    dishes: createInitialDishes(),
    activeStation: null,
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
    contacts: [],
    activeContactId: null,
    activePhoneTab: 'chats',
    kitchenTimerQueue: [],
    recipeTabBounce: false,
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
