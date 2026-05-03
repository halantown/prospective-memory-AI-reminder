/** Global game store — Zustand. */

import { create } from 'zustand'
import type {
  Phase, RoomId, Pan, PhoneNotification, PhoneMessage, RobotState, SessionData,
  ActivePMTrial, PMTaskConfig, DiningPhase, SteakState, SeatState, UtensilType,
  DishId, DishState, KitchenStationId, Contact,
  ActiveCookingStep, CookingStepResult, CookingStepOption, CookingWaitStep,
  TaskOrder, PMPipelineState, PMPipelineStep,
  CookingDefinitions,
} from '../types'

const EMPTY_SEAT: SeatState = { plate: false, knife: false, fork: false, glass: false }

/** Max visible phone messages — unused in chat mode but kept for backward compat. */
const MAX_PHONE_MESSAGES = 50
export const FALLBACK_DISH_ORDER: DishId[] = ['spaghetti', 'steak', 'tomato_soup', 'roasted_vegetables']

const FALLBACK_DISH_META: Record<DishId, { label: string; emoji: string }> = {
  spaghetti: { label: 'Spaghetti', emoji: '🍝' },
  steak: { label: 'Steak', emoji: '🥩' },
  tomato_soup: { label: 'Tomato Soup', emoji: '🍅' },
  roasted_vegetables: { label: 'Roasted Vegetables', emoji: '🥕' },
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
  cookingDefinitions: CookingDefinitions | null
  cookingDishOrder: DishId[]
  dishes: Record<DishId, DishState>
  /** Which station's popup is currently open */
  activeStation: KitchenStationId | null
  /** Active cooking steps sent by backend (awaiting participant action) */
  activeCookingSteps: ActiveCookingStep[]
  /** Steps currently showing "missed" flash before disappearing */
  missedStepFlashes: { dishId: string; stepIndex: number; stepLabel: string; emoji: string }[]
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
  initializeCookingDefinitions: (definitions: CookingDefinitions) => void
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

function upsertStepResult(results: CookingStepResult[], next: CookingStepResult) {
  return [
    ...results.filter(r => r.stepIndex !== next.stepIndex),
    next,
  ].sort((a, b) => a.stepIndex - b.stepIndex)
}

function createInitialDishes(definitions?: CookingDefinitions | null): Record<DishId, DishState> {
  const dishes = {} as Record<DishId, DishState>
  for (const dishId of FALLBACK_DISH_ORDER) {
    const definition = definitions?.dishes?.[dishId]
    const meta = definition ?? FALLBACK_DISH_META[dishId]
    dishes[dishId] = {
      id: dishId,
      label: meta.label,
      emoji: meta.emoji,
      phase: 'idle',
      currentStepIndex: 0,
      steps: definition
        ? definition.steps.map(step => ({
            id: step.id,
            label: step.label,
            station: step.station,
            description: step.description,
            stepType: step.step_type,
            waitDurationS: step.wait_duration_s,
          }))
        : [],
      stepReady: false,
      startedAt: null,
      completedAt: null,
      stepResults: [],
    }
  }
  return dishes
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
  cookingDefinitions: null,
  cookingDishOrder: FALLBACK_DISH_ORDER,
  dishes: createInitialDishes(),
  activeStation: null,
  activeCookingSteps: [],
  missedStepFlashes: [],
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
  setSession: (data) => {
    const cookingState = data.cooking_definitions
      ? {
          cookingDefinitions: data.cooking_definitions,
          cookingDishOrder: data.cooking_definitions.dish_order,
          dishes: createInitialDishes(data.cooking_definitions),
        }
      : {}
    set({
      sessionId: data.session_id,
      participantId: data.participant_id,
      condition: data.condition,
      taskOrder: (data.task_order as TaskOrder) || null,
      isTest: data.is_test ?? false,
      currentPhase: data.current_phase ?? 'welcome',
      ...cookingState,
    })
  },

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
  initializeCookingDefinitions: (definitions) => set({
    cookingDefinitions: definitions,
    cookingDishOrder: definitions.dish_order,
    dishes: createInitialDishes(definitions),
    activeCookingSteps: [],
    missedStepFlashes: [],
    cookingWaitSteps: [],
    cookingScore: { correct: 0, wrong: 0, missed: 0 },
    activeStation: null,
  }),

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
      activatedGameTime: data.activated_game_time as number | undefined,
      deadlineGameTime: data.deadline_game_time as number | undefined,
      windowSeconds: data.window_s as number || 30,
      stepType: (data.step_type as 'active' | 'wait') || 'active',
      waitDurationS: data.wait_duration_s as number | undefined,
    }
    set((s) => ({
      activeCookingSteps: [...s.activeCookingSteps.filter(
        st => !(st.dishId === step.dishId && st.stepIndex === step.stepIndex)
      ), step],
      cookingWaitSteps: s.cookingWaitSteps.filter(w => w.dishId !== step.dishId),
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
      const alreadyRecorded = dish.stepResults.some(r => r.stepIndex === stepIndex)
      if (!alreadyRecorded) {
        if (result === 'correct') score.correct++
        else score.wrong++
      }

      return {
        // Remove from active steps
        activeCookingSteps: s.activeCookingSteps.filter(
          st => !(st.dishId === dishId && st.stepIndex === stepIndex)
        ),
        // Add result to dish
        dishes: {
          ...s.dishes,
          [dishId]: {
            ...dish,
            phase: 'prep',
            stepResults: upsertStepResult(dish.stepResults, stepResult),
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

    const stepResult: CookingStepResult = {
      dishId,
      stepIndex,
      result: 'missed',
    }

    set((s) => {
      const dish = s.dishes[dishId]
      const score = { ...s.cookingScore }
      const alreadyRecorded = dish.stepResults.some(r => r.stepIndex === stepIndex)
      if (!alreadyRecorded) score.missed++

      // Grab the step label & emoji before removing from activeCookingSteps
      const timedOutStep = s.activeCookingSteps.find(
        st => st.dishId === dishId && st.stepIndex === stepIndex
      )
      const flash = timedOutStep
        ? {
            dishId,
            stepIndex,
            stepLabel: timedOutStep.stepLabel,
            emoji: s.dishes[dishId]?.emoji || '🍳',
          }
        : null

      // Schedule removal of the flash after 1.5 s
      if (flash) {
        setTimeout(() => {
          set((s2) => ({
            missedStepFlashes: s2.missedStepFlashes.filter(
              f => !(f.dishId === dishId && f.stepIndex === stepIndex)
            ),
          }))
        }, 1500)
      }

      return {
        activeCookingSteps: s.activeCookingSteps.filter(
          st => !(st.dishId === dishId && st.stepIndex === stepIndex)
        ),
        missedStepFlashes: flash
          ? [...s.missedStepFlashes, flash]
          : s.missedStepFlashes,
        dishes: {
          ...s.dishes,
          [dishId]: {
            ...dish,
            phase: 'prep',
            stepResults: upsertStepResult(dish.stepResults, stepResult),
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
      startedAt: data.started_at ? (data.started_at as number) * 1000 : Date.now(),
      startedGameTime: data.started_game_time as number | undefined,
      durationS: data.wait_duration_s as number || 60,
    }
    set((s) => ({
      activeCookingSteps: s.activeCookingSteps.filter(st => st.dishId !== waitStep.dishId),
      cookingWaitSteps: [
        ...s.cookingWaitSteps.filter(w => w.dishId !== waitStep.dishId),
        waitStep,
      ],
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
      dishes: {
        ...s.dishes,
        [dishId]: {
          ...s.dishes[dishId],
          phase: s.dishes[dishId].phase === 'waiting' ? 'prep' : s.dishes[dishId].phase,
        },
      },
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
            activeCookingSteps: s.activeCookingSteps.filter(st => st.dishId !== dishId),
            cookingWaitSteps: s.cookingWaitSteps.filter(w => w.dishId !== dishId),
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
  resetBlock: () => set((s) => ({
    currentRoom: 'kitchen',
    previousRoom: null,
    avatarMoving: false,
    pans: [...initialPans],
    kitchenScore: 0,
    dishes: createInitialDishes(s.cookingDefinitions),
    activeStation: null,
    activeCookingSteps: [],
    missedStepFlashes: [],
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
  })),
}))
