import { create } from 'zustand'
import { fetchGameConfig } from '../utils/api'

const DEFAULT_BLOCK_DURATION_S = 510
const SIM_DAY_START_SEC = 10 * 3600
const SIM_DAY_END_SEC = 23 * 3600
const SIM_DAY_RANGE_SEC = SIM_DAY_END_SEC - SIM_DAY_START_SEC

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function formatClock(secondsOfDay) {
  const total = ((Math.floor(secondsOfDay) % 86400) + 86400) % 86400
  const hh = String(Math.floor(total / 3600)).padStart(2, '0')
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  return `${hh}:${mm}`
}

function deriveTimeContext(blockTimer, blockDurationS = DEFAULT_BLOCK_DURATION_S) {
  const safeDuration = Math.max(1, blockDurationS)
  const progress = clamp(blockTimer / safeDuration, 0, 1)
  const simulatedSec = SIM_DAY_START_SEC + progress * SIM_DAY_RANGE_SEC
  const dayPhase = simulatedSec >= 20 * 3600 ? 'moon' : simulatedSec >= 18 * 3600 ? 'sunset' : 'sun'
  return {
    dayPhase,
    worldClockLabel: formatClock(simulatedSec),
  }
}

function getBlockDurationS(remoteConfig) {
  const sec = Number(remoteConfig?.timeline?.block_duration_s)
  if (!Number.isFinite(sec) || sec <= 0) return DEFAULT_BLOCK_DURATION_S
  return Math.round(sec)
}

function initialOngoingState() {
  return {
    kitchen: { completed: 0, latestChoice: null },
    living_room: { completed: 0, latestChoice: null },
    balcony: { completed: 0, latestChoice: null },
    entrance: { completed: 0, latestChoice: null },
  }
}

export const useGameStore = create((set, get) => ({
  remoteConfig: null,
  configLoaded: false,

  sessionId: null,
  participantId: null,
  group: null,
  conditionOrder: null,

  phase: 'welcome',
  blockNumber: 0,
  totalBlocks: 4,
  condition: null,
  currentBlockConfig: null,
  taskSlots: {},

  blockRunning: false,
  blockTimer: 0,
  dayPhase: 'sun',
  worldClockLabel: '10:00',

  currentRoom: 'kitchen',
  currentActivity: 'recipe_following',
  transitionNarrative: '',
  roomTransitioning: false,

  ongoingState: initialOngoingState(),

  trigger: {
    visible: false,
    taskId: null,
    slot: null,
    windowMs: 30000,
    room: null,
    activity: null,
  },

  pmPanelOpen: false,
  pmDraft: {
    targetId: null,
    stepsDone: [],
  },

  questionnaire: {
    intrusiveness: 4,
    helpfulness: 4,
    comment: '',
    ongoingInteractionCount: 0,
  },

  encodingQuizAttempts: 0,

  robotSpeaking: false,
  robotText: '',

  sseConnected: false,

  loadRemoteConfig: async () => {
    const cfg = await fetchGameConfig()
    if (!cfg) return
    const durationS = getBlockDurationS(cfg)
    const timeCtx = deriveTimeContext(0, durationS)
    set({
      remoteConfig: cfg,
      configLoaded: true,
      dayPhase: timeCtx.dayPhase,
      worldClockLabel: timeCtx.worldClockLabel,
    })
  },

  setSession: (data) => set({
    sessionId: data.sessionId,
    participantId: data.participantId,
    group: data.group,
    conditionOrder: data.conditionOrder || null,
  }),

  setPhase: (phase) => set({ phase }),

  setSseConnected: (val) => set({ sseConnected: val }),

  startBlockEncoding: (blockConfig) => {
    const durationS = getBlockDurationS(get().remoteConfig)
    const timeCtx = deriveTimeContext(0, durationS)

    set({
      phase: 'block_encoding',
      blockNumber: blockConfig.block_number,
      condition: blockConfig.condition,
      currentBlockConfig: blockConfig,
      taskSlots: blockConfig.task_slots || {},
      blockRunning: false,
      blockTimer: 0,
      dayPhase: timeCtx.dayPhase,
      worldClockLabel: timeCtx.worldClockLabel,
      currentRoom: 'kitchen',
      currentActivity: 'recipe_following',
      transitionNarrative: '',
      roomTransitioning: false,
      ongoingState: initialOngoingState(),
      trigger: {
        visible: false,
        taskId: null,
        slot: null,
        windowMs: blockConfig.execution_window_ms || 30000,
        room: null,
        activity: null,
      },
      pmPanelOpen: false,
      pmDraft: { targetId: null, stepsDone: [] },
      questionnaire: {
        intrusiveness: 4,
        helpfulness: 4,
        comment: '',
        ongoingInteractionCount: 0,
      },
      encodingQuizAttempts: 0,
      robotSpeaking: false,
      robotText: '',
    })
  },

  confirmEncoding: (quizAttempts = 1) => {
    const durationS = getBlockDurationS(get().remoteConfig)
    const timeCtx = deriveTimeContext(0, durationS)
    set({
      phase: 'block_running',
      blockRunning: true,
      blockTimer: 0,
      dayPhase: timeCtx.dayPhase,
      worldClockLabel: timeCtx.worldClockLabel,
      encodingQuizAttempts: quizAttempts,
    })
  },

  applyRoomTransition: (room, activity, narrative = '') => {
    set({
      roomTransitioning: true,
      currentRoom: room,
      currentActivity: activity,
      transitionNarrative: narrative || '',
    })
    setTimeout(() => {
      if (get().currentRoom === room && get().currentActivity === activity) {
        set({ roomTransitioning: false, transitionNarrative: '' })
      }
    }, 450)
  },

  tickBlockTimer: () => set((state) => {
    const nextTimer = state.blockTimer + 1
    const durationS = getBlockDurationS(state.remoteConfig)
    const timeCtx = deriveTimeContext(nextTimer, durationS)
    return {
      blockTimer: nextTimer,
      dayPhase: timeCtx.dayPhase,
      worldClockLabel: timeCtx.worldClockLabel,
    }
  }),

  triggerRobot: (text) => {
    const clean = String(text || '').trim()
    if (!clean) return
    set({ robotSpeaking: true, robotText: clean })
    const words = clean.split(/\s+/).length
    const fallback = Math.max(4000, words * 350 + 1500)
    setTimeout(() => {
      if (get().robotText === clean) set({ robotSpeaking: false })
    }, fallback)
  },

  setRobotSpeaking: (v) => set({ robotSpeaking: v }),
  clearRobotText: () => set({ robotText: '', robotSpeaking: false }),

  triggerAppear: (payload) => set((state) => ({
    trigger: {
      visible: true,
      taskId: payload.task_id,
      slot: payload.slot,
      windowMs: payload.window_ms || state.trigger.windowMs || 30000,
      room: payload.room || null,
      activity: payload.activity || null,
    },
    pmPanelOpen: false,
    pmDraft: { targetId: null, stepsDone: [] },
  })),

  windowClose: (taskId) => set((state) => {
    if (state.trigger.taskId !== taskId) return {}
    return {
      trigger: { ...state.trigger, visible: false },
      pmPanelOpen: false,
      pmDraft: { targetId: null, stepsDone: [] },
    }
  }),

  openPmPanel: () => set({ pmPanelOpen: true }),
  closePmPanel: () => set({ pmPanelOpen: false }),

  setPmTarget: (targetId) => set((state) => ({
    pmDraft: { ...state.pmDraft, targetId },
  })),

  togglePmStep: (stepId) => set((state) => {
    const has = state.pmDraft.stepsDone.includes(stepId)
    return {
      pmDraft: {
        ...state.pmDraft,
        stepsDone: has
          ? state.pmDraft.stepsDone.filter((s) => s !== stepId)
          : [...state.pmDraft.stepsDone, stepId],
      },
    }
  }),

  resetPmDraft: () => set({ pmDraft: { targetId: null, stepsDone: [] } }),

  markOngoingInteraction: (room, choice) => set((state) => {
    const current = state.ongoingState[room] || { completed: 0, latestChoice: null }
    return {
      ongoingState: {
        ...state.ongoingState,
        [room]: {
          completed: current.completed + 1,
          latestChoice: choice,
        },
      },
      questionnaire: {
        ...state.questionnaire,
        ongoingInteractionCount: state.questionnaire.ongoingInteractionCount + 1,
      },
    }
  }),

  setQuestionnaireField: (key, value) => set((state) => ({
    questionnaire: {
      ...state.questionnaire,
      [key]: value,
    },
  })),

  endBlock: () => set({
    blockRunning: false,
    phase: 'block_end',
    trigger: {
      visible: false,
      taskId: null,
      slot: null,
      windowMs: 30000,
      room: null,
      activity: null,
    },
    pmPanelOpen: false,
    pmDraft: { targetId: null, stepsDone: [] },
  }),

  getCurrentTask: () => {
    const { trigger, taskSlots } = get()
    if (!trigger.taskId || !trigger.slot) return null
    const slot = taskSlots[trigger.slot]
    if (!slot || !slot.task) return null
    return slot.task
  },
}))
