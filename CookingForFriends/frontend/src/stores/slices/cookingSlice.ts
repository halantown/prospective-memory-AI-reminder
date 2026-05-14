import type { StateCreator } from 'zustand'
import type { GameState, CookingSlice } from './types'
import type {
  Pan, DishId, DishState, KitchenStationId, SeatState,
  ActiveCookingStep, CookingStepResult, CookingStepOption, CookingWaitStep,
  CookingDefinitions, CookingFinishedWaitStep,
} from '../../types'

export const FALLBACK_DISH_ORDER: DishId[] = ['spaghetti', 'steak', 'tomato_soup', 'roasted_vegetables']

const FALLBACK_DISH_META: Record<DishId, { label: string; emoji: string }> = {
  spaghetti: { label: 'Spaghetti', emoji: '🍝' },
  steak: { label: 'Steak', emoji: '🥩' },
  tomato_soup: { label: 'Tomato Soup', emoji: '🍅' },
  roasted_vegetables: { label: 'Roasted Vegetables', emoji: '🥕' },
}

export const EMPTY_SEAT: SeatState = { plate: false, knife: false, fork: false, glass: false }

export const initialPans: Pan[] = [
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

export function createInitialDishes(definitions?: CookingDefinitions | null): Record<DishId, DishState> {
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

export const createCookingSlice: StateCreator<GameState, [], [], CookingSlice> = (set, get) => ({
  pans: [...initialPans],
  kitchenScore: 0,
  cookingDefinitions: null,
  cookingDishOrder: FALLBACK_DISH_ORDER,
  dishes: createInitialDishes(),
  activeStation: null,
  activeCookingSteps: [],
  missedStepFlashes: [],
  cookingStepFeedback: null,
  cookingWaitSteps: [],
  cookingFinishedWaitSteps: [],
  cookingScore: { correct: 0, wrong: 0, missed: 0 },
  diningPhase: 'idle',
  diningSeats: [{ ...EMPTY_SEAT }, { ...EMPTY_SEAT }, { ...EMPTY_SEAT }, { ...EMPTY_SEAT }],
  diningSelectedUtensil: null,
  diningRound: 0,
  diningScore: 0,

  setPans: (pans) => set({ pans }),
  updatePan: (panId, update) => set((s) => ({
    pans: s.pans.map((p) => p.id === panId ? { ...p, ...update } : p),
  })),
  addKitchenScore: (points) => set((s) => ({ kitchenScore: s.kitchenScore + points })),

  initializeCookingDefinitions: (definitions) => set({
    cookingDefinitions: definitions,
    cookingDishOrder: definitions.dish_order,
    dishes: createInitialDishes(definitions),
    activeCookingSteps: [],
    missedStepFlashes: [],
    cookingStepFeedback: null,
    cookingWaitSteps: [],
    cookingFinishedWaitSteps: [],
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
          stepReady: false,
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
      recipeTabBounce: true,
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
      const completedStep = s.activeCookingSteps.find(
        st => st.dishId === dishId && st.stepIndex === stepIndex
      )
      if (!alreadyRecorded) {
        if (result === 'correct') score.correct++
        else score.wrong++
      }

      return {
        activeCookingSteps: s.activeCookingSteps.filter(
          st => !(st.dishId === dishId && st.stepIndex === stepIndex)
        ),
        cookingFinishedWaitSteps: s.cookingFinishedWaitSteps.filter(w => w.dishId !== dishId),
        cookingStepFeedback: completedStep
          ? { dishId, stepIndex, result, station: completedStep.station, timestamp: Date.now() }
          : s.cookingStepFeedback,
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

    const stepResult: CookingStepResult = { dishId, stepIndex, result: 'missed' }

    set((s) => {
      const dish = s.dishes[dishId]
      const score = { ...s.cookingScore }
      const alreadyRecorded = dish.stepResults.some(r => r.stepIndex === stepIndex)
      if (!alreadyRecorded) score.missed++

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

      if (flash) {
        setTimeout(() => {
          set((s2) => ({
            missedStepFlashes: s2.missedStepFlashes.filter(
              f => !(f.dishId === dishId && f.stepIndex === stepIndex)
            ),
          }))
        }, 2000)
      }

      return {
        activeCookingSteps: s.activeCookingSteps.filter(
          st => !(st.dishId === dishId && st.stepIndex === stepIndex)
        ),
        cookingFinishedWaitSteps: s.cookingFinishedWaitSteps.filter(w => w.dishId !== dishId),
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
      cookingFinishedWaitSteps: s.cookingFinishedWaitSteps.filter(w => w.dishId !== waitStep.dishId),
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
      cookingFinishedWaitSteps: (() => {
        const waitStep = s.cookingWaitSteps.find(w => w.dishId === dishId && w.stepIndex === stepIndex)
        if (!waitStep) return s.cookingFinishedWaitSteps
        const finished: CookingFinishedWaitStep = {
          dishId,
          stepIndex,
          stepLabel: waitStep.stepLabel,
          stepDescription: waitStep.stepDescription,
          station: waitStep.station,
          finishedAt: Date.now(),
        }
        return [
          ...s.cookingFinishedWaitSteps.filter(w => w.dishId !== dishId),
          finished,
        ]
      })(),
      dishes: {
        ...s.dishes,
        [dishId]: {
          ...s.dishes[dishId],
          phase: s.dishes[dishId].phase === 'waiting' ? 'prep' : s.dishes[dishId].phase,
        },
      },
    }))
  },

  confirmCookingWaitFinished: (dishId, stepIndex) => set((s) => ({
    cookingFinishedWaitSteps: s.cookingFinishedWaitSteps.filter(
      w => !(w.dishId === dishId && w.stepIndex === stepIndex)
    ),
  })),

  clearCookingStepFeedback: () => set({ cookingStepFeedback: null }),

  getActiveStepForStation: (station) => {
    return get().activeCookingSteps.find(s => s.station === station)
  },

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

  handleOngoingTaskEvent: (data) => {
    const task = data.task as string
    const event = data.event as string

    if (task === 'steak') {
      return
    } else if (task === 'dining') {
      if (event === 'table_ready') {
        set({ diningPhase: 'active' as const })
      }
    } else if (task === 'cooking') {
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
            cookingFinishedWaitSteps: s.cookingFinishedWaitSteps.filter(w => w.dishId !== dishId),
            dishes: {
              ...s.dishes,
              [dishId]: { ...s.dishes[dishId], phase: 'served', completedAt: Date.now() },
            },
          }))
        }
      }
    }
  },
})
