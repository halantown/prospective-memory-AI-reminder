import { create } from 'zustand'
import { reportSteakAction, fetchGameConfig } from '../utils/api'

// ── Hob states ────────────────────────────────────────────
const HOB_STATUS = {
  EMPTY: 'empty',
  COOKING: 'cooking',
  READY: 'ready',
  BURNING: 'burning',
}

// Defaults (overwritten when remote config loads)
let DIFFICULTY = {
  slow:   { cookingMs: 20000, readyMs: 5000, maxSteaks: 2 },
  medium: { cookingMs: 13000, readyMs: 4000, maxSteaks: 3 },
  fast:   { cookingMs: 9000,  readyMs: 3000, maxSteaks: 3 },
}

let MESSAGE_TIMEOUT_MS = 15000

const makeHob = (id) => ({
  id, status: HOB_STATUS.EMPTY, startedAt: null,
  cookingMs: 18000, readyMs: 6000,
})

const initialHobs = [makeHob(0), makeHob(1), makeHob(2)]

const ts = () => Date.now()

export { HOB_STATUS, DIFFICULTY }

export const useGameStore = create((set, get) => ({
  // ── Remote Config (loaded from backend) ──────────────────
  remoteConfig: null,
  configLoaded: false,

  loadRemoteConfig: async () => {
    const cfg = await fetchGameConfig()
    if (!cfg) return
    // Update module-level defaults from remote config
    if (cfg.difficulty) {
      for (const [k, v] of Object.entries(cfg.difficulty)) {
        if (k === 'default') continue
        DIFFICULTY[k] = {
          cookingMs: v.cooking_ms ?? DIFFICULTY[k]?.cookingMs ?? 13000,
          readyMs: v.ready_ms ?? DIFFICULTY[k]?.readyMs ?? 4000,
          maxSteaks: v.max_steaks ?? DIFFICULTY[k]?.maxSteaks ?? 3,
        }
      }
    }
    if (cfg.timers?.message_timeout_ms) {
      MESSAGE_TIMEOUT_MS = cfg.timers.message_timeout_ms
    }
    set({ remoteConfig: cfg, configLoaded: true })
    console.log('[Config] Remote config loaded:', Object.keys(cfg))
  },
  // ── Session ─────────────────────────────────────────────
  sessionId: null,
  participantId: null,
  group: null,
  conditionOrder: null,

  // ── Game Phase ──────────────────────────────────────────
  phase: 'welcome',
  blockNumber: 0,
  totalBlocks: 4,
  condition: null,
  taskPairId: null,

  // ── Room Navigation ─────────────────────────────────────
  activeRoom: 'overview',
  previousRoom: null,
  isTransitioning: false,

  setActiveRoom: (room) => {
    const state = get()
    if (state.isTransitioning) return
    set({
      activeRoom: room,
      previousRoom: state.activeRoom,
      isTransitioning: true,
    })
    setTimeout(() => set({ isTransitioning: false }), 280)
  },

  // ── Score ───────────────────────────────────────────────
  score: 0,
  addScore: (pts) => set((s) => ({ score: s.score + pts })),
  resetScore: () => set({ score: 0 }),

  // ── Steak / Kitchen ────────────────────────────────────
  difficulty: 'medium',
  hobs: initialHobs.map(h => ({ ...h })),

  getDifficultyParams: () => DIFFICULTY[get().difficulty],

  spawnSteak: (hobId, duration) => set((state) => {
    const diff = DIFFICULTY[state.difficulty]
    const cookingMs = duration?.cooking ?? diff.cookingMs
    const readyMs = duration?.ready ?? diff.readyMs
    return {
      hobs: state.hobs.map(h =>
        h.id === hobId && h.status === HOB_STATUS.EMPTY
          ? { ...h, status: HOB_STATUS.COOKING, startedAt: ts(), cookingMs, readyMs }
          : h
      ),
    }
  }),

  transitionHob: (hobId, newStatus) => set((state) => {
    const newHobs = state.hobs.map(h => {
      if (h.id !== hobId) return h
      if (newStatus === HOB_STATUS.READY && h.status === HOB_STATUS.COOKING) {
        return { ...h, status: HOB_STATUS.READY, startedAt: ts() }
      }
      if (newStatus === HOB_STATUS.BURNING && h.status === HOB_STATUS.READY) {
        return { ...h, status: HOB_STATUS.BURNING, startedAt: null }
      }
      return h
    })
    return { hobs: newHobs }
  }),

  // Player actions on hobs — update local state + POST to backend
  flipSteak: (hobId) => {
    const { sessionId, blockNumber } = get()
    set((state) => ({
      hobs: state.hobs.map(h =>
        h.id === hobId && h.status === HOB_STATUS.READY
          ? { ...h, status: HOB_STATUS.COOKING, startedAt: ts() }
          : h
      ),
      score: state.score + 5,
    }))
    if (sessionId) {
      reportSteakAction(sessionId, blockNumber, hobId, 'flip').catch(err =>
        console.error('[Steak] flip report failed:', err)
      )
    }
  },

  serveSteak: (hobId) => {
    const { sessionId, blockNumber, sseConnected } = get()
    set((state) => ({
      hobs: state.hobs.map(h =>
        h.id === hobId && h.status === HOB_STATUS.READY
          ? { ...h, status: HOB_STATUS.EMPTY, startedAt: null }
          : h
      ),
      score: state.score + 5,
    }))
    if (sessionId) {
      reportSteakAction(sessionId, blockNumber, hobId, 'serve').catch(err =>
        console.error('[Steak] serve report failed:', err)
      )
    } else if (!sseConnected) {
      const delay = 15000 + Math.random() * 10000
      setTimeout(() => {
        const s = get()
        if (s.blockRunning && !s.sseConnected && s.hobs.find(h => h.id === hobId)?.status === HOB_STATUS.EMPTY) {
          s.spawnSteak(hobId)
        }
      }, delay)
    }
  },

  cleanSteak: (hobId) => {
    const { sessionId, blockNumber, sseConnected } = get()
    set((state) => ({
      hobs: state.hobs.map(h =>
        h.id === hobId && h.status === HOB_STATUS.BURNING
          ? { ...h, status: HOB_STATUS.EMPTY, startedAt: null }
          : h
      ),
      score: state.score - 10,
    }))
    if (sessionId) {
      reportSteakAction(sessionId, blockNumber, hobId, 'clean').catch(err =>
        console.error('[Steak] clean report failed:', err)
      )
    } else if (!sseConnected) {
      const delay = 15000 + Math.random() * 10000
      setTimeout(() => {
        const s = get()
        if (s.blockRunning && !s.sseConnected && s.hobs.find(h => h.id === hobId)?.status === HOB_STATUS.EMPTY) {
          s.spawnSteak(hobId)
        }
      }, delay)
    }
  },

  forceYellowSteak: (hobId) => set((state) => ({
    hobs: state.hobs.map(h =>
      h.id === hobId
        ? { ...h, status: HOB_STATUS.READY, startedAt: ts() }
        : h
    ),
  })),

  // ── Washing Machine ────────────────────────────────────
  machine: { status: 'empty', progress: 0 },
  washTime: 60,

  tickMachine: () => set((state) => {
    if (state.machine.status !== 'washing') return {}
    const next = state.machine.progress + 1
    if (next >= state.washTime) {
      return { machine: { status: 'done', progress: 0 } }
    }
    return { machine: { ...state.machine, progress: next } }
  }),

  handleMachineAction: () => set((state) => {
    if (state.machine.status === 'empty') {
      return { machine: { status: 'washing', progress: 0 } }
    }
    if (state.machine.status === 'done') {
      return { machine: { status: 'empty', progress: 0 } }
    }
    return {}
  }),

  // ── Messages (Email Inbox) ──────────────────────────────
  messageBubbles: [],
  unreadCount: 0,
  selectedEmailId: null,

  addMessageBubble: (bubble) => {
    set((state) => ({
      messageBubbles: [...state.messageBubbles, {
        ...bubble,
        id: ts(),
        replied: false,
        expired: false,
        read: false,
        receivedAt: ts(),
        from: bubble.from || 'Unknown',
        subject: bubble.subject || bubble.text?.slice(0, 40) || 'New message',
        body: bubble.body || bubble.text || '',
        avatar: bubble.avatar || (bubble.from ? bubble.from[0].toUpperCase() : '?'),
        option_a: bubble.option_a || 'OK',
        option_b: bubble.option_b || 'Skip',
        correct: bubble.correct || null,  // "option_a" or "option_b" for scoring
        timeoutMs: MESSAGE_TIMEOUT_MS,
      }],
      unreadCount: state.unreadCount + 1,
    }))
  },

  selectEmail: (emailId) => set((state) => ({
    selectedEmailId: emailId,
    messageBubbles: state.messageBubbles.map((b) =>
      b.id === emailId && !b.read ? { ...b, read: true } : b
    ),
    unreadCount: state.messageBubbles.reduce((count, b) => {
      if (b.id === emailId && !b.read) return count
      if (!b.read) return count + 1
      return count
    }, 0),
  })),

  replyToBubble: (bubbleId, choice) => {
    const bubble = get().messageBubbles.find(b => b.id === bubbleId)
    if (!bubble || bubble.replied || bubble.expired) return
    // Score: +2 for correct reply, +1 for wrong reply (still engaged)
    const isCorrect = bubble.correct && choice === bubble.correct
    const pts = isCorrect ? 2 : 1
    set((state) => ({
      messageBubbles: state.messageBubbles.map((b) =>
        b.id === bubbleId ? { ...b, replied: true, replyChoice: choice, repliedAt: ts(), replyCorrect: isCorrect } : b
      ),
      score: state.score + pts,
    }))
  },

  expireMessage: (bubbleId) => {
    const bubble = get().messageBubbles.find(b => b.id === bubbleId)
    if (!bubble || bubble.replied || bubble.expired) return
    set((state) => ({
      messageBubbles: state.messageBubbles.map((b) =>
        b.id === bubbleId ? { ...b, expired: true, expiredAt: ts() } : b
      ),
      score: state.score - 2,
    }))
  },

  // ── Plant Watering (Living Room) ─────────────────────────
  plantNeedsWater: false,
  plantWilted: false,
  plantLastWatered: null,
  plantNeedsWaterSince: null,

  showPlantNeedsWater: () => set({ plantNeedsWater: true, plantWilted: false, plantNeedsWaterSince: ts() }),
  waterPlant: () => {
    const { plantNeedsWater, plantWilted } = get()
    if (!plantNeedsWater) return
    set({
      plantNeedsWater: false,
      plantWilted: false,
      plantLastWatered: ts(),
      plantNeedsWaterSince: null,
      score: get().score + (plantWilted ? 1 : 3),  // reduced points if wilted
    })
  },
  wiltPlant: () => set({ plantWilted: true }),

  // ── PM Task Interactability (GDD A1) ────────────────────
  // Per-task interactable state: trigger_appear adds, window_close removes.
  // Participant never sees a timer or "Report Task" button.
  interactableTasks: [],    // task IDs currently in their execution window
  openCabinetTask: null,    // task ID whose cabinet is currently open (inline, not overlay)

  triggerAppear: (taskId) => {
    set((s) => ({
      interactableTasks: [...s.interactableTasks.filter(t => t !== taskId), taskId],
    }))
  },

  windowClose: (taskId) => {
    set((s) => ({
      interactableTasks: s.interactableTasks.filter(t => t !== taskId),
      openCabinetTask: s.openCabinetTask === taskId ? null : s.openCabinetTask,
    }))
  },

  openCabinet: (taskId) => set({ openCabinetTask: taskId }),
  closeCabinet: () => set({ openCabinetTask: null }),

  submitCabinetAction: () => {
    // Close the cabinet after submission — no score feedback to participant
    set({ openCabinetTask: null })
  },

  // ── Robot ──────────────────────────────────────────────
  robotSpeaking: false,
  robotText: '',

  triggerRobot: (text) => {
    set({ robotSpeaking: true, robotText: text })
    // TTS onEnd callback will clear robotSpeaking via setRobotSpeaking.
    // Fallback timeout clears state if TTS unavailable or fails.
    const words = text.split(' ').length
    const fallback = Math.max(5000, words * 400 + 3000)
    setTimeout(() => {
      if (get().robotText === text) set({ robotSpeaking: false })
    }, fallback)
  },

  setRobotSpeaking: (v) => set({ robotSpeaking: v }),
  clearRobotText: () => set({ robotText: '', robotSpeaking: false }),

  // ── Fake Trigger ───────────────────────────────────────
  fakeTriggered: false,
  fakeType: null,

  triggerFake: (type) => set({ fakeTriggered: true, fakeType: type }),
  clearFake: () => set({ fakeTriggered: false, fakeType: null }),

  // ── SSE ────────────────────────────────────────────────
  sseConnected: false,
  setSseConnected: (val) => set({ sseConnected: val }),

  // ── Encoding ───────────────────────────────────────────
  encodingConfirmed: false,
  encodingQuizAttempts: 0,

  startBlockEncoding: (blockData) => set({
    phase: 'block_encoding',
    blockNumber: blockData.blockNumber,
    condition: blockData.condition,
    taskPairId: blockData.taskPairId,
    blockRunning: false,
    blockTimer: 0,
    score: 0,
    hobs: initialHobs.map(h => ({ ...h })),
    messageBubbles: [],
    unreadCount: 0,
    selectedEmailId: null,
    interactableTasks: [],
    openCabinetTask: null,
    encodingConfirmed: false,
    encodingQuizAttempts: 0,
    machine: { status: 'empty', progress: 0 },
    fakeTriggered: false,
    fakeType: null,
    robotSpeaking: false,
    robotText: '',
    activeRoom: 'overview',
    plantNeedsWater: false,
    plantWilted: false,
    plantLastWatered: null,
    plantNeedsWaterSince: null,
  }),

  confirmEncoding: (quizAttempts = 1) => set({
    phase: 'block_running',
    blockRunning: true,
    blockTimer: 0,
    encodingConfirmed: true,
    encodingQuizAttempts: quizAttempts,
  }),

  // ── Block Control ──────────────────────────────────────
  blockTimer: 0,
  blockRunning: false,

  startBlock: (blockData) => set({
    phase: 'block_running',
    blockNumber: blockData.blockNumber,
    condition: blockData.condition,
    taskPairId: blockData.taskPairId,
    blockRunning: true,
    blockTimer: 0,
    score: 0,
    hobs: initialHobs.map(h => ({ ...h })),
    messageBubbles: [],
    unreadCount: 0,
    selectedEmailId: null,
    interactableTasks: [],
    openCabinetTask: null,
    machine: { status: 'empty', progress: 0 },
    fakeTriggered: false,
    fakeType: null,
    robotSpeaking: false,
    robotText: '',
    activeRoom: 'overview',
    plantNeedsWater: false,
    plantWilted: false,
    plantLastWatered: null,
    plantNeedsWaterSince: null,
  }),

  endBlock: () => set((s) => ({
    blockRunning: false,
    phase: 'block_end',
  })),

  tickBlockTimer: () => set((s) => ({ blockTimer: s.blockTimer + 1 })),

  // ── Session Setup ──────────────────────────────────────
  setSession: (data) => set({
    sessionId: data.sessionId,
    participantId: data.participantId,
    group: data.group,
    conditionOrder: data.conditionOrder || null,
  }),

  setPhase: (phase) => set({ phase }),
  setDifficulty: (d) => set({ difficulty: d }),

  // ── Sidebar Status ─────────────────────────────────────
  getKitchenStatus: () => {
    const hobs = get().hobs
    if (hobs.some(h => h.status === HOB_STATUS.BURNING)) return 'red'
    if (hobs.some(h => h.status === HOB_STATUS.READY)) return 'orange'
    return null
  },

  getBalconyStatus: () => {
    const m = get().machine
    if (m.status === 'done') return 'blue'
    return null
  },

  getLivingStatus: () => {
    const { plantNeedsWater, plantWilted } = get()
    if (plantWilted) return 'red'
    if (plantNeedsWater) return 'orange'
    return null
  },

  getInboxStatus: () => {
    const { messageBubbles } = get()
    const now = ts()
    const hasUrgent = messageBubbles.some(b => !b.replied && !b.expired && (now - b.receivedAt) > MESSAGE_TIMEOUT_MS * 0.7)
    const hasUnreplied = messageBubbles.some(b => !b.replied && !b.expired)
    if (hasUrgent) return 'red'
    if (hasUnreplied) return 'orange'
    return null
  },
}))
