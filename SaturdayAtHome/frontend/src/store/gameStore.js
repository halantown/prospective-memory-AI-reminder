import { create } from 'zustand'
import { reportSteakAction } from '../utils/api'

// ── Hob states ────────────────────────────────────────────
const HOB_STATUS = {
  EMPTY: 'empty',
  COOKING: 'cooking',
  READY: 'ready',
  BURNING: 'burning',
}

const DIFFICULTY = {
  slow:   { cookingMs: 25000, readyMs: 15000, maxSteaks: 2 },
  medium: { cookingMs: 18000, readyMs: 6000,  maxSteaks: 3 },
  fast:   { cookingMs: 12000, readyMs: 6000,  maxSteaks: 3 },
}

const makeHob = (id) => ({
  id, status: HOB_STATUS.EMPTY, startedAt: null,
  cookingMs: 18000, readyMs: 6000,
})

const initialHobs = [makeHob(0), makeHob(1), makeHob(2)]

export { HOB_STATUS, DIFFICULTY }

export const useGameStore = create((set, get) => ({
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

  // Spawn a steak on a hob (called by SSE steak_spawn or demo scheduler)
  spawnSteak: (hobId, duration) => set((state) => {
    const diff = DIFFICULTY[state.difficulty]
    const cookingMs = duration?.cooking ?? diff.cookingMs
    const readyMs = duration?.ready ?? diff.readyMs
    return {
      hobs: state.hobs.map(h =>
        h.id === hobId && h.status === HOB_STATUS.EMPTY
          ? { ...h, status: HOB_STATUS.COOKING, startedAt: Date.now(), cookingMs, readyMs }
          : h
      ),
    }
  }),

  // Called by GameShell timer when cooking/ready duration expires
  transitionHob: (hobId, newStatus) => set((state) => {
    const msgs = []
    const newHobs = state.hobs.map(h => {
      if (h.id !== hobId) return h
      if (newStatus === HOB_STATUS.READY && h.status === HOB_STATUS.COOKING) {
        msgs.push({ text: `⚠️ Hob ${h.id + 1}: steak is ready!`, type: 'warning' })
        return { ...h, status: HOB_STATUS.READY, startedAt: Date.now() }
      }
      if (newStatus === HOB_STATUS.BURNING && h.status === HOB_STATUS.READY) {
        msgs.push({ text: `🔥 Hob ${h.id + 1}: steak burnt!`, type: 'error' })
        return { ...h, status: HOB_STATUS.BURNING, startedAt: null }
      }
      return h
    })
    return {
      hobs: newHobs,
      messages: [
        ...state.messages,
        ...msgs.map(m => ({ ...m, time: new Date().toLocaleTimeString() })),
      ].slice(-50),
    }
  }),

  // Player actions on hobs — update local state + POST to backend
  flipSteak: (hobId) => {
    const { sessionId, blockNumber } = get()
    console.log('[Steak] flip', { hobId, sessionId })
    set((state) => ({
      hobs: state.hobs.map(h =>
        h.id === hobId && h.status === HOB_STATUS.READY
          ? { ...h, status: HOB_STATUS.COOKING, startedAt: Date.now() }
          : h
      ),
      score: state.score + 5,
      messages: [...state.messages, {
        text: `🥩 Flipped steak on hob ${hobId + 1}! +5`, type: 'success',
        time: new Date().toLocaleTimeString(),
      }].slice(-50),
    }))
    if (sessionId) {
      reportSteakAction(sessionId, blockNumber, hobId, 'flip').catch(err =>
        console.error('[Steak] flip report failed:', err)
      )
    }
  },

  serveSteak: (hobId) => {
    const { sessionId, blockNumber, sseConnected } = get()
    console.log('[Steak] serve', { hobId, sessionId })
    set((state) => ({
      hobs: state.hobs.map(h =>
        h.id === hobId && h.status === HOB_STATUS.READY
          ? { ...h, status: HOB_STATUS.EMPTY, startedAt: null }
          : h
      ),
      score: state.score + 5,
      messages: [...state.messages, {
        text: `🍽️ Served steak from hob ${hobId + 1}! +5`, type: 'success',
        time: new Date().toLocaleTimeString(),
      }].slice(-50),
    }))
    if (sessionId) {
      // Backend handles respawn via SSE after 15-25s
      reportSteakAction(sessionId, blockNumber, hobId, 'serve').catch(err =>
        console.error('[Steak] serve report failed:', err)
      )
    } else if (!sseConnected) {
      // Demo mode fallback — local respawn
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
    console.log('[Steak] clean', { hobId, sessionId })
    set((state) => ({
      hobs: state.hobs.map(h =>
        h.id === hobId && h.status === HOB_STATUS.BURNING
          ? { ...h, status: HOB_STATUS.EMPTY, startedAt: null }
          : h
      ),
      score: state.score - 10,
      messages: [...state.messages, {
        text: `🧽 Cleaned burnt steak on hob ${hobId + 1}. −10`, type: 'error',
        time: new Date().toLocaleTimeString(),
      }].slice(-50),
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

  // Force a hob into READY state regardless of current state
  forceYellowSteak: (hobId) => set((state) => ({
    hobs: state.hobs.map(h =>
      h.id === hobId
        ? { ...h, status: HOB_STATUS.READY, startedAt: Date.now() }
        : h
    ),
    messages: [...state.messages, {
      text: `⚠️ Hob ${hobId + 1}: steak forced ready!`, type: 'warning',
      time: new Date().toLocaleTimeString(),
    }].slice(-50),
  })),

  // ── Washing Machine ────────────────────────────────────
  machine: { status: 'empty', progress: 0 },
  washTime: 60,

  tickMachine: () => set((state) => {
    if (state.machine.status !== 'washing') return {}
    const next = state.machine.progress + 1
    if (next >= state.washTime) {
      return {
        machine: { status: 'done', progress: 0 },
        messages: [...state.messages, {
          text: '🧺 Washing machine is done!', type: 'info',
          time: new Date().toLocaleTimeString(),
        }].slice(-50),
      }
    }
    return { machine: { ...state.machine, progress: next } }
  }),

  handleMachineAction: () => set((state) => {
    if (state.machine.status === 'empty') {
      return {
        machine: { status: 'washing', progress: 0 },
        messages: [...state.messages, {
          text: '💦 Started the washing machine.', type: 'info',
          time: new Date().toLocaleTimeString(),
        }].slice(-50),
      }
    }
    if (state.machine.status === 'done') {
      return {
        machine: { status: 'empty', progress: 0 },
        messages: [...state.messages, {
          text: '👕 Collected clean laundry!', type: 'success',
          time: new Date().toLocaleTimeString(),
        }].slice(-50),
      }
    }
    return {}
  }),

  // ── Messages ───────────────────────────────────────────
  messages: [
    { text: 'Welcome home! Click rooms to explore.', type: 'info', time: new Date().toLocaleTimeString() },
  ],
  messageBubbles: [],
  unreadCount: 0,

  addMessage: (text, type = 'info') => set((state) => ({
    messages: [...state.messages, { text, type, time: new Date().toLocaleTimeString() }].slice(-50),
  })),

  addMessageBubble: (bubble) => {
    if (get().pmExecution.active) return // T13-5: pause new bubbles during PM execution
    set((state) => ({
      messageBubbles: [...state.messageBubbles, { ...bubble, id: Date.now(), replied: false }],
      unreadCount: state.unreadCount + 1,
    }))
  },

  replyToBubble: (bubbleId, choice) => set((state) => ({
    messageBubbles: state.messageBubbles.map((b) =>
      b.id === bubbleId ? { ...b, replied: true, replyChoice: choice } : b
    ),
    score: state.score + 2,
    unreadCount: Math.max(0, state.unreadCount - 1),
    messages: [...state.messages, {
      text: '💬 Replied to message! +2', type: 'success',
      time: new Date().toLocaleTimeString(),
    }].slice(-50),
  })),

  // ── PM Execution ───────────────────────────────────────
  pmExecution: {
    active: false,
    taskId: null,
    windowOpenAt: null,
    timeLimit: 30000,
    submitted: false,
  },
  reportTaskVisible: false,

  // SSE: trigger_appear → Report Task button appears
  triggerAppear: (taskId) => {
    console.log('[PM] trigger_appear', { taskId })
    set((s) => ({
      reportTaskVisible: true,
      pmExecution: { ...s.pmExecution, taskId, submitted: false, active: false, windowOpenAt: null },
    }))
  },

  // SSE: window_close → button disappears, miss if not submitted
  windowClose: (taskId) => {
    const { pmExecution } = get()
    if (pmExecution.taskId !== taskId) return
    console.log('[PM] window_close', { taskId, submitted: pmExecution.submitted })
    if (pmExecution.submitted) {
      set({ reportTaskVisible: false })
    } else {
      set({
        reportTaskVisible: false,
        pmExecution: { active: false, taskId: null, windowOpenAt: null, timeLimit: 30000, submitted: false },
        messages: [...get().messages, {
          text: `⏰ Missed task window!`, type: 'error',
          time: new Date().toLocaleTimeString(),
        }].slice(-50),
      })
    }
  },

  // User clicks Report Task button → overlay opens with 30s countdown
  openPmOverlay: () => {
    console.log('[PM] overlay_open', { taskId: get().pmExecution.taskId })
    set((s) => ({
      pmExecution: { ...s.pmExecution, active: true, windowOpenAt: Date.now(), submitted: false },
    }))
  },

  // User confirms PM action
  submitPmAction: (actionData = {}) => {
    console.log('[PM] submit', { taskId: get().pmExecution.taskId, ...actionData })
    set((s) => ({
      pmExecution: { ...s.pmExecution, submitted: true, active: false },
      reportTaskVisible: false,
    }))
  },

  // Close overlay without submitting (not sure)
  closePmOverlay: () => {
    console.log('[PM] overlay_close_unsure', { taskId: get().pmExecution.taskId })
    set((s) => ({
      pmExecution: { ...s.pmExecution, active: false },
    }))
  },

  // Timeout auto-close — called from GameShell when 30s expires
  pmTimeout: () => {
    console.log('[PM] timeout', { taskId: get().pmExecution.taskId })
    set((s) => ({
      pmExecution: { ...s.pmExecution, active: false },
      reportTaskVisible: false,
      messages: [...s.messages, {
        text: `⏰ Task execution timed out!`, type: 'error',
        time: new Date().toLocaleTimeString(),
      }].slice(-50),
    }))
  },

  // ── Robot ──────────────────────────────────────────────
  robotSpeaking: false,
  robotText: '',

  triggerRobot: (text) => {
    if (get().pmExecution.active) return // T13-5: pause robot during PM execution
    set({ robotSpeaking: true, robotText: text })
    const words = text.split(' ').length
    const duration = Math.max(3000, words * 300 + 2000)
    setTimeout(() => set({ robotSpeaking: false, robotText: '' }), duration)
  },

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
    reportTaskVisible: false,
    pmExecution: { active: false, taskId: null, windowOpenAt: null, timeLimit: 30000, submitted: false },
    encodingConfirmed: false,
    encodingQuizAttempts: 0,
    messages: [{ text: 'New round starting — read your tasks carefully.', type: 'info', time: new Date().toLocaleTimeString() }],
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
    reportTaskVisible: false,
    pmExecution: { active: false, taskId: null, windowOpenAt: null, timeLimit: 30000, submitted: false },
  }),

  endBlock: () => set({
    blockRunning: false,
    phase: 'block_questionnaire',
  }),

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
    if (hobs.some(h => h.status === HOB_STATUS.READY)) return 'yellow'
    return 'green'
  },

  getBalconyStatus: () => {
    const m = get().machine
    if (m.status === 'done') return 'blue'
    return 'grey'
  },
}))
