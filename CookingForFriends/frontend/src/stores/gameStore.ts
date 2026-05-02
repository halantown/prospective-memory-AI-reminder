/** Global game store — Zustand. */

import { create } from 'zustand'
import type {
  Phase, RoomId, Pan, PhoneNotification, PhoneMessage, RobotState, SessionData,
  ActivePMTrial, PMTaskConfig, DiningPhase, SteakState, SeatState, UtensilType,
  DishId, DishState, KitchenStationId, Contact,
  ActiveCookingStep, CookingStepResult, CookingStepOption, CookingWaitStep,
  TaskOrder, PMPipelineState, PMPipelineStep, KitchenTimerBannerItem,
} from '../types'

const EMPTY_SEAT: SeatState = { plate: false, knife: false, fork: false, glass: false }

/** Max visible phone messages — unused in chat mode but kept for backward compat. */
const MAX_PHONE_MESSAGES = 50
const COOKING_STATIONS = new Set<KitchenStationId>(['burner1', 'burner2', 'burner3', 'oven'])

function buildKitchenTimerMessage(stepLabel: string) {
  const text = stepLabel.trim()
  if (!text) return 'Check the kitchen!'
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}!`
}

function buildKitchenWarningMessage(dish: DishState | undefined) {
  const label = dish?.label?.toLowerCase() || 'food'
  return `The ${label} burned!`
}

interface GameState {
  // ── Session ──
  sessionId: string | null
  participantId: string | null
  condition: string | null
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
  /** Active cooking steps sent by backend (awaiting participant action) */
  activeCookingSteps: ActiveCookingStep[]
  /** Currently running wait steps (auto-progressing) */
  cookingWaitSteps: CookingWaitStep[]
  /** Accumulated results for scoring display */
  cookingScore: { correct: number; wrong: number; missed: number }

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
  kitchenTimerQueue: KitchenTimerBannerItem[]
  recipeTabBounce: boolean
  lockSystemNotifications: Array<{ id: string; sender: string; text: string; timestamp: number }>

  // ── Robot ──
  robot: RobotState

  // ── PM ──
  activePMTrials: ActivePMTrial[]
  completedPMTrialIds: Set<string>
  pmTargetSelected: string | null
  pmActionPhase: 'idle' | 'target_select' | 'action_confirm' | 'completed'

  // ── PM Module ──
  taskOrder: TaskOrder | null
  isTest: boolean
  currentPhase: string  // server-authoritative phase string
  pmPipelineState: PMPipelineState | null
  gameTimeFrozen: boolean
  cutsceneTaskIndex: number  // 0-3, which task we're showing in encoding
  cutsceneSegmentIndex: number  // 0-3

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
  handleCookingStepActivate: (data: Record<string, unknown>) => void
  handleCookingStepResult: (data: Record<string, unknown>) => void
  handleCookingStepTimeout: (data: Record<string, unknown>) => void
  handleCookingWaitStart: (data: Record<string, unknown>) => void
  handleCookingWaitEnd: (data: Record<string, unknown>) => void
  getActiveStepForStation: (station: KitchenStationId) => ActiveCookingStep | undefined

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
  showMessageFeedback: (messageId: string) => void
  expirePhoneMessage: (id: string) => void
  removePhoneMessage: (id: string) => void
  setPhoneBanner: (msg: PhoneMessage | null) => void
  setContacts: (contacts: Contact[]) => void
  setActiveContactId: (id: string | null) => void
  setActivePhoneTab: (tab: 'chats' | 'recipe') => void
  pushKitchenTimer: (timer: Omit<KitchenTimerBannerItem, 'appearedAt'>) => void
  dismissKitchenTimer: () => void
  removeKitchenTimerForStep: (dishId: DishId, stepIndex: number) => void
  markKitchenTimerWarning: (dishId: DishId, stepIndex: number, message: string) => void
  setRecipeTabBounce: (bounce: boolean) => void
  addLockSystemNotification: (notif: { id: string; sender: string; text: string; timestamp: number }) => void

  // Robot actions
  setRobotSpeaking: (text: string) => void
  clearRobotSpeech: () => void
  setRobotRoom: (room: RoomId) => void

  // PM actions
  addPMTrial: (trial: ActivePMTrial) => void
  completePMTrial: (triggerId: string) => void
  setPMTargetSelected: (target: string | null) => void
  setPMActionPhase: (phase: 'idle' | 'target_select' | 'action_confirm' | 'completed') => void

  // PM pipeline (new module)
  setTaskOrder: (order: TaskOrder) => void
  setIsTest: (isTest: boolean) => void
  setPMPipelineState: (state: PMPipelineState | null) => void
  advancePMPipelineStep: (step: PMPipelineStep) => void
  setGameTimeFrozen: (frozen: boolean) => void
  setCutsceneTaskIndex: (i: number) => void
  setCutsceneSegmentIndex: (i: number) => void

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
  { id: 'sp_pot_water', label: 'Prepare pot', station: 'burner1', description: 'Fill the large pot with water, add a pinch of salt.' },
  { id: 'sp_wait_boil', label: 'Water heating', station: 'burner1', description: 'Waiting for water to boil.' },
  { id: 'sp_add_pasta', label: 'Add pasta', station: 'burner1', description: 'Add spaghetti, cook for 9 minutes.' },
  { id: 'sp_wait_cook', label: 'Pasta cooking', station: 'burner1', description: 'Pasta is cooking.' },
  { id: 'sp_drain', label: 'Drain pasta', station: 'burner1', description: 'Drain and save a cup of pasta water.' },
  { id: 'sp_add_sauce', label: 'Add sauce', station: 'spice_rack', description: 'Add pesto sauce.' },
  { id: 'sp_toss', label: 'Toss pasta', station: 'burner1', description: 'Toss on low heat for 1 minute.' },
  { id: 'sp_plate', label: 'Plate spaghetti', station: 'plating_area', description: 'Serve on the flat yellow plate.' },
]

/** Steak recipe steps */
const STEAK_STEPS: DishState['steps'] = [
  { id: 'st_select', label: 'Select steak', station: 'fridge', description: 'Get the ribeye steak.' },
  { id: 'st_season', label: 'Season steak', station: 'cutting_board', description: 'Rub with salt, pepper, and olive oil.' },
  { id: 'st_heat_pan', label: 'Heat pan', station: 'burner3', description: 'Heat the cast iron pan on high.' },
  { id: 'st_place', label: 'Place steak', station: 'burner3', description: "Place steak and don't move it." },
  { id: 'st_wait_side1', label: 'Cooking side 1', station: 'burner3', description: 'Searing first side.' },
  { id: 'st_flip', label: 'Flip steak', station: 'burner3', description: 'Flip once, add a knob of butter.' },
  { id: 'st_wait_side2', label: 'Cooking side 2', station: 'burner3', description: 'Searing second side.' },
  { id: 'st_plate', label: 'Plate steak', station: 'plating_area', description: 'Rest on the warm black plate for 2 minutes.' },
]

/** Tomato soup recipe steps */
const SOUP_STEPS: DishState['steps'] = [
  { id: 'ts_select_ingredients', label: 'Select ingredients', station: 'fridge', description: 'Get tomatoes, onion, and garlic.' },
  { id: 'ts_chop', label: 'Chop ingredients', station: 'cutting_board', description: 'Dice the onion, crush the garlic, quarter the tomatoes.' },
  { id: 'ts_saute', label: 'Sauté base', station: 'burner2', description: 'Sauté onion and garlic on medium heat.' },
  { id: 'ts_add_liquid', label: 'Add liquid', station: 'burner2', description: 'Add vegetable stock.' },
  { id: 'ts_wait_simmer1', label: 'Simmering', station: 'burner2', description: 'Soup is simmering.' },
  { id: 'ts_stir', label: 'Stir soup', station: 'burner2', description: 'Stir and reduce heat to low.' },
  { id: 'ts_wait_simmer2', label: 'Continue simmering', station: 'burner2', description: 'Soup continues simmering.' },
  { id: 'ts_season', label: 'Season soup', station: 'spice_rack', description: 'Add salt + basil.' },
  { id: 'ts_plate', label: 'Serve soup', station: 'plating_area', description: 'Ladle into the deep red bowl.' },
]

/** Roasted vegetables recipe steps */
const VEGGIE_STEPS: DishState['steps'] = [
  { id: 'rv_select_veggies', label: 'Select vegetables', station: 'fridge', description: 'Get bell peppers, zucchini, and tomatoes.' },
  { id: 'rv_chop', label: 'Chop vegetables', station: 'cutting_board', description: 'Slice into thin rounds.' },
  { id: 'rv_season', label: 'Season vegetables', station: 'spice_rack', description: 'Add olive oil + dried herbs.' },
  { id: 'rv_oven_place', label: 'Place tray in oven', station: 'oven', description: 'Set oven to 200°C.' },
  { id: 'rv_wait_oven', label: 'Oven cooking', station: 'oven', description: 'Vegetables are roasting.' },
  { id: 'rv_oven_remove', label: 'Remove from oven', station: 'oven', description: 'Take out the tray and turn off oven.' },
  { id: 'rv_plate', label: 'Plate vegetables', station: 'plating_area', description: 'Arrange on the white oval plate.' },
]

function createInitialDishes(): Record<DishId, DishState> {
  return {
    spaghetti: {
      id: 'spaghetti', label: 'Spaghetti', emoji: '🍝',
      phase: 'idle', currentStepIndex: 0, steps: SPAGHETTI_STEPS,
      stepReady: true, startedAt: null, completedAt: null, stepResults: [],
    },
    steak: {
      id: 'steak', label: 'Steak', emoji: '🥩',
      phase: 'idle', currentStepIndex: 0, steps: STEAK_STEPS,
      stepReady: false, startedAt: null, completedAt: null, stepResults: [],
    },
    tomato_soup: {
      id: 'tomato_soup', label: 'Tomato Soup', emoji: '🍅',
      phase: 'idle', currentStepIndex: 0, steps: SOUP_STEPS,
      stepReady: false, startedAt: null, completedAt: null, stepResults: [],
    },
    roasted_vegetables: {
      id: 'roasted_vegetables', label: 'Roasted Vegetables', emoji: '🥕',
      phase: 'idle', currentStepIndex: 0, steps: VEGGIE_STEPS,
      stepReady: false, startedAt: null, completedAt: null, stepResults: [],
    },
  }
}

export const useGameStore = create<GameState>((set, get) => ({
  // ── Session ──
  sessionId: null,
  participantId: null,
  condition: null,
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
  activeCookingSteps: [],
  cookingWaitSteps: [],
  cookingScore: { correct: 0, wrong: 0, missed: 0 },

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
  lockSystemNotifications: [],

  // ── Robot ──
  robot: { room: 'kitchen', speaking: false, text: '', visible: true },

  // ── PM ──
  activePMTrials: [],
  completedPMTrialIds: new Set(),
  pmTargetSelected: null,
  pmActionPhase: 'idle',

  // ── PM Module ──
  taskOrder: null,
  isTest: false,
  currentPhase: 'welcome',
  pmPipelineState: null,
  gameTimeFrozen: false,
  cutsceneTaskIndex: 0,
  cutsceneSegmentIndex: 0,

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
    condition: data.condition,
    taskOrder: (data.task_order as TaskOrder) || null,
    isTest: data.is_test ?? false,
    currentPhase: data.current_phase ?? 'welcome',
  }),

  setPhase: (phase) => set({ phase }),

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

  handleCookingStepActivate: (data) => {
    const step: ActiveCookingStep = {
      dishId: data.dish as DishId,
      stepIndex: data.step_index as number,
      stepLabel: data.label as string,
      stepDescription: data.description as string || '',
      station: data.station as KitchenStationId,
      options: (data.options as CookingStepOption[]) || [],
      activatedAt: data.activated_at ? (data.activated_at as number) * 1000 : Date.now(),
      windowSeconds: data.window_s as number || 30,
      stepType: (data.step_type as 'active' | 'wait') || 'active',
      waitDurationS: data.wait_duration_s as number | undefined,
    }
    set((s) => ({
      activeCookingSteps: [...s.activeCookingSteps.filter(
        st => !(st.dishId === step.dishId && st.stepIndex === step.stepIndex)
      ), step],
      kitchenTimerQueue: [
        ...s.kitchenTimerQueue.filter(
          t => !(t.dishId === step.dishId && t.stepIndex === step.stepIndex)
        ),
        {
          id: `timer_${step.dishId}_${step.stepIndex}`,
          icon: '🍳',
          message: buildKitchenTimerMessage(step.stepLabel),
          dishId: step.dishId,
          stepIndex: step.stepIndex,
          station: step.station,
          status: 'active' as const,
          appearedAt: Date.now(),
        },
      ].slice(-2),
      dishes: {
        ...s.dishes,
        [step.dishId]: {
          ...s.dishes[step.dishId],
          phase: step.stepType === 'wait' ? 'waiting' : 'cooking',
          currentStepIndex: step.stepIndex,
          stepReady: true,
          startedAt: s.dishes[step.dishId].startedAt ?? Date.now(),
        },
      },
    }))
  },

  handleCookingStepResult: (data) => {
    const dishId = data.dish as DishId
    const stepIndex = data.step_index as number
    const result = data.result as 'correct' | 'wrong'
    const responseTimeMs = data.response_time_ms as number | undefined

    const stepResult: CookingStepResult = {
      dishId,
      stepIndex,
      result,
      chosenOptionId: data.chosen_option_id as string | undefined,
      responseTimeMs,
    }

    set((s) => {
      const dish = s.dishes[dishId]
      const score = { ...s.cookingScore }
      if (result === 'correct') score.correct++
      else score.wrong++

      return {
        // Remove from active steps
        activeCookingSteps: s.activeCookingSteps.filter(
          st => !(st.dishId === dishId && st.stepIndex === stepIndex)
        ),
        kitchenTimerQueue: s.kitchenTimerQueue.filter(
          t => !(t.dishId === dishId && t.stepIndex === stepIndex)
        ),
        // Add result to dish
        dishes: {
          ...s.dishes,
          [dishId]: {
            ...dish,
            stepResults: [...dish.stepResults, stepResult],
            stepReady: false,
          },
        },
        cookingScore: score,
      }
    })
  },

  handleCookingStepTimeout: (data) => {
    const dishId = data.dish as DishId
    const stepIndex = data.step_index as number
    const timedOutStep = get().activeCookingSteps.find(
      st => st.dishId === dishId && st.stepIndex === stepIndex
    )
    const isCookingStep = timedOutStep ? COOKING_STATIONS.has(timedOutStep.station) : false

    const stepResult: CookingStepResult = {
      dishId,
      stepIndex,
      result: 'missed',
    }

    set((s) => {
      const dish = s.dishes[dishId]
      const score = { ...s.cookingScore }
      score.missed++

      return {
        activeCookingSteps: s.activeCookingSteps.filter(
          st => !(st.dishId === dishId && st.stepIndex === stepIndex)
        ),
        kitchenTimerQueue: isCookingStep
          ? s.kitchenTimerQueue.map(t =>
              t.dishId === dishId && t.stepIndex === stepIndex
                ? { ...t, status: 'warning' as const, message: buildKitchenWarningMessage(dish) }
                : t
            )
          : s.kitchenTimerQueue.filter(
              t => !(t.dishId === dishId && t.stepIndex === stepIndex)
            ),
        dishes: {
          ...s.dishes,
          [dishId]: {
            ...dish,
            stepResults: [...dish.stepResults, stepResult],
            stepReady: false,
          },
        },
        cookingScore: score,
      }
    })
  },

  handleCookingWaitStart: (data) => {
    const waitStep: CookingWaitStep = {
      dishId: data.dish as DishId,
      stepIndex: data.step_index as number,
      stepLabel: data.label as string || '',
      stepDescription: data.description as string || '',
      station: data.station as KitchenStationId,
      startedAt: Date.now(),
      durationS: data.wait_duration_s as number || 60,
    }
    set((s) => ({
      cookingWaitSteps: [...s.cookingWaitSteps, waitStep],
      dishes: {
        ...s.dishes,
        [waitStep.dishId]: {
          ...s.dishes[waitStep.dishId],
          phase: 'waiting',
          currentStepIndex: waitStep.stepIndex,
        },
      },
    }))
  },

  handleCookingWaitEnd: (data) => {
    const dishId = data.dish as DishId
    const stepIndex = data.step_index as number
    set((s) => ({
      cookingWaitSteps: s.cookingWaitSteps.filter(
        w => !(w.dishId === dishId && w.stepIndex === stepIndex)
      ),
    }))
  },

  getActiveStepForStation: (station) => {
    return get().activeCookingSteps.find(s => s.station === station)
  },

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
    // Deduplicate by id — prevents re-delivered messages on reconnect
    if (s.phoneMessages.some((m) => m.id === msg.id)) return s
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
  showMessageFeedback: (messageId) => set((s) => ({
    phoneMessages: s.phoneMessages.map((m) =>
      m.id === messageId ? { ...m, feedbackVisible: true } : m
    ),
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
    kitchenTimerQueue: [
      ...s.kitchenTimerQueue.filter(t => t.id !== timer.id),
      { ...timer, appearedAt: Date.now(), status: timer.status ?? 'active' },
    ].slice(-2),
  })),
  dismissKitchenTimer: () => set((s) => ({
    kitchenTimerQueue: s.kitchenTimerQueue.slice(1),
  })),
  removeKitchenTimerForStep: (dishId, stepIndex) => set((s) => ({
    kitchenTimerQueue: s.kitchenTimerQueue.filter(
      t => !(t.dishId === dishId && t.stepIndex === stepIndex)
    ),
  })),
  markKitchenTimerWarning: (dishId, stepIndex, message) => set((s) => ({
    kitchenTimerQueue: s.kitchenTimerQueue.map(t =>
      t.dishId === dishId && t.stepIndex === stepIndex
        ? { ...t, status: 'warning', message }
        : t
    ),
  })),
  setRecipeTabBounce: (bounce) => set({ recipeTabBounce: bounce }),
  addLockSystemNotification: (notif) => set((s) => ({
    lockSystemNotifications: [...s.lockSystemNotifications, notif].slice(-2),
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

  // PM pipeline (new module)
  setTaskOrder: (order) => set({ taskOrder: order }),
  setIsTest: (isTest) => set({ isTest }),
  setPMPipelineState: (state) => set({ pmPipelineState: state }),
  advancePMPipelineStep: (step) => set((s) => {
    if (!s.pmPipelineState) return s
    return { pmPipelineState: { ...s.pmPipelineState, step } }
  }),
  setGameTimeFrozen: (frozen) => set({ gameTimeFrozen: frozen }),
  setCutsceneTaskIndex: (i) => set({ cutsceneTaskIndex: i }),
  setCutsceneSegmentIndex: (i) => set({ cutsceneSegmentIndex: i }),

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
      // Legacy steak system — disabled, replaced by multi-dish cooking
      return
    } else if (task === 'dining') {
      if (event === 'table_ready') {
        set({ diningPhase: 'active' as const })
      }
    } else if (task === 'cooking') {
      // Backend-driven cooking events
      if (event === 'step_activate') {
        get().handleCookingStepActivate(data)
      } else if (event === 'step_result') {
        get().handleCookingStepResult(data)
      } else if (event === 'step_timeout') {
        get().handleCookingStepTimeout(data)
      } else if (event === 'wait_start') {
        get().handleCookingWaitStart(data)
      } else if (event === 'wait_end') {
        get().handleCookingWaitEnd(data)
      } else if (event === 'step_ready') {
        const dishId = data.dish as DishId | undefined
        if (dishId) get().setDishStepReady(dishId, true)
      } else if (event === 'phase_change') {
        const dishId = data.dish as DishId | undefined
        const phase = data.phase as DishState['phase']
        if (dishId && phase) get().setDishPhase(dishId, phase)
      } else if (event === 'dish_complete') {
        const dishId = data.dish as DishId | undefined
        if (dishId) {
          set((s) => ({
            dishes: {
              ...s.dishes,
              [dishId]: { ...s.dishes[dishId], phase: 'served', completedAt: Date.now() },
            },
          }))
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
    activeCookingSteps: [],
    cookingWaitSteps: [],
    cookingScore: { correct: 0, wrong: 0, missed: 0 },
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
    lockSystemNotifications: [],
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
