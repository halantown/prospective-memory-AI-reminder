import { create } from 'zustand'
import { reportSteakAction, fetchGameConfig } from '../utils/api'

// ── Hob states (multi-step steak) ─────────────────────────
const HOB_STATUS = {
  EMPTY: 'empty',
  COOKING_SIDE1: 'cooking_side1',
  READY_SIDE1: 'ready_side1',
  COOKING_SIDE2: 'cooking_side2',
  READY_SIDE2: 'ready_side2',
  BURNING: 'burning',
  ASH: 'ash',
}

// ── Laundry rules (exported for Sidebar display) ──────────
const LAUNDRY_RULES = {
  warm:  { detergent: 'Warm Detergent',  temp: '40°', colors: 'Red, Orange, Yellow' },
  cold:  { detergent: 'Cold Detergent',  temp: '30°', colors: 'Blue, Green, Purple' },
  white: { detergent: 'White Detergent', temp: '60°', colors: 'White, Gray' },
}

const makeHob = (id) => ({
  id,
  status: HOB_STATUS.EMPTY,
  startedAt: null,
  cookingMs: 13000,
  readyMs: 4000,
  ashMs: 9000,
  peppered: false,
})

const initialHobs = [makeHob(0), makeHob(1), makeHob(2)]

const DEFAULT_GARMENT_POOL = [
  { color: 'red',    category: 'warm',  label: 'Red T-Shirt' },
  { color: 'orange', category: 'warm',  label: 'Orange Scarf' },
  { color: 'yellow', category: 'warm',  label: 'Yellow Hoodie' },
  { color: 'blue',   category: 'cold',  label: 'Blue Jeans' },
  { color: 'green',  category: 'cold',  label: 'Green Jacket' },
  { color: 'purple', category: 'cold',  label: 'Purple Socks' },
  { color: 'white',  category: 'white', label: 'White Shirt' },
  { color: 'gray',   category: 'white', label: 'Gray Towel' },
]

const LAUNDRY_PILE_MIN_INTERVAL_S = 40
const LAUNDRY_PILE_MAX_INTERVAL_S = 50
const LAUNDRY_WASH_MIN_S = 25
const LAUNDRY_WASH_MAX_S = 45
const LAUNDRY_OVERFLOW_THRESHOLD = 5
const LAUNDRY_OVERFLOW_PENALTY = -1
const LAUNDRY_OVERFLOW_PENALTY_EVERY_S = 10

const randomLaundryDropDelayS = (remoteConfig = null) => {
  const min = Number(remoteConfig?.laundry?.pile_drop_min_s ?? LAUNDRY_PILE_MIN_INTERVAL_S)
  const max = Number(remoteConfig?.laundry?.pile_drop_max_s ?? LAUNDRY_PILE_MAX_INTERVAL_S)
  const low = Math.max(1, Math.min(min, max))
  const high = Math.max(low, Math.max(min, max))
  return low + Math.floor(Math.random() * (high - low + 1))
}

const randomLaundryWashDurationS = (remoteConfig = null) => {
  const minMs = Number(remoteConfig?.timers?.laundry_wash_min_ms)
  const maxMs = Number(remoteConfig?.timers?.laundry_wash_max_ms)
  const minS = Number.isFinite(minMs) && minMs > 0 ? Math.round(minMs / 1000) : LAUNDRY_WASH_MIN_S
  const maxS = Number.isFinite(maxMs) && maxMs > 0 ? Math.round(maxMs / 1000) : LAUNDRY_WASH_MAX_S
  const low = Math.max(5, Math.min(minS, maxS))
  const high = Math.max(low, Math.max(minS, maxS))
  return low + Math.floor(Math.random() * (high - low + 1))
}

const pickRandomGarment = (pool) => {
  const source = Array.isArray(pool) && pool.length > 0 ? pool : DEFAULT_GARMENT_POOL
  const idx = Math.floor(Math.random() * source.length)
  return { ...source[idx] }
}

const initialLaundry = () => ({
  pile: [],
  currentGarment: null,
  selectedDetergent: null,
  selectedTemp: null,
  washStatus: 'idle',
  washProgress: 0,
  washDuration: 0,
  jamFixDeadline: null,
  jamTriggered: false,
  lastCorrect: null,
  completedCount: 0,
  correctCount: 0,
  nextPileDropAt: randomLaundryDropDelayS(),
  nextOverflowPenaltyAt: null,
  overflowThreshold: LAUNDRY_OVERFLOW_THRESHOLD,
  familyDropCount: 0,
  lastFamilyDropAt: null,
})

const ts = () => Date.now()
const DEFAULT_BLOCK_DURATION_S = 510
const SIM_DAY_START_SEC = 10 * 3600
const SIM_DAY_END_SEC = 23 * 3600
const SIM_DAY_RANGE_SEC = SIM_DAY_END_SEC - SIM_DAY_START_SEC
const HALF_HOUR_S = 30 * 60
const SKY_PHASE_SPECS = [
  { phase: 'sun', clockSec: 10 * 3600, label: 'Sunrise' },
  { phase: 'sunset', clockSec: 18 * 3600, label: 'Sunset' },
  { phase: 'moon', clockSec: 20 * 3600, label: 'Moonrise' },
]

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function formatClock(secondsOfDay) {
  const total = ((Math.floor(secondsOfDay) % 86400) + 86400) % 86400
  const hh = String(Math.floor(total / 3600)).padStart(2, '0')
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  return `${hh}:${mm}`
}

function formatBlockTimer(totalSec) {
  const safe = Math.max(0, Math.floor(totalSec))
  const mm = String(Math.floor(safe / 60)).padStart(2, '0')
  const ss = String(safe % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

function getBlockDurationS(remoteConfig) {
  const ms = Number(remoteConfig?.timers?.block_duration_ms)
  if (!Number.isFinite(ms) || ms <= 0) return DEFAULT_BLOCK_DURATION_S
  return Math.max(1, Math.round(ms / 1000))
}

function quantizeHalfHour(secondsOfDay) {
  const snapped = Math.floor(secondsOfDay / HALF_HOUR_S) * HALF_HOUR_S
  return clamp(snapped, SIM_DAY_START_SEC, SIM_DAY_END_SEC)
}

function getSkyPhase(clockSec) {
  if (clockSec >= 20 * 3600) return 'moon'
  if (clockSec >= 18 * 3600) return 'sunset'
  return 'sun'
}

function buildWorldClockSchedule(blockDurationS = DEFAULT_BLOCK_DURATION_S) {
  const safeDuration = Math.max(1, blockDurationS)
  return SKY_PHASE_SPECS.map((spec) => {
    const ratio = (spec.clockSec - SIM_DAY_START_SEC) / SIM_DAY_RANGE_SEC
    const atSec = Math.round(safeDuration * clamp(ratio, 0, 1))
    return {
      atSec,
      worldClockLabel: formatClock(spec.clockSec),
      phase: spec.phase,
      label: spec.label,
    }
  })
}

function deriveTimeContext(blockTimer, blockDurationS = DEFAULT_BLOCK_DURATION_S) {
  const safeDuration = Math.max(1, blockDurationS)
  const progress = clamp(blockTimer / safeDuration, 0, 1)
  const simulatedSec = SIM_DAY_START_SEC + progress * SIM_DAY_RANGE_SEC
  const quantizedSec = quantizeHalfHour(simulatedSec)
  return {
    dayPhase: getSkyPhase(quantizedSec),
    worldClockLabel: formatClock(quantizedSec),
  }
}

export { HOB_STATUS, LAUNDRY_RULES }

export const useGameStore = create((set, get) => ({
  // ── Remote Config (loaded from backend) ──────────────────
  remoteConfig: null,
  configLoaded: false,

  loadRemoteConfig: async () => {
    const cfg = await fetchGameConfig()
    if (!cfg) return
    const durationS = getBlockDurationS(cfg)
    const timeContext = deriveTimeContext(get().blockTimer, durationS)
    set({
      remoteConfig: cfg,
      configLoaded: true,
      worldClockSchedule: buildWorldClockSchedule(durationS),
      dayPhase: timeContext.dayPhase,
      worldClockLabel: timeContext.worldClockLabel,
    })
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
  dayPhase: 'sun',
  worldClockLabel: '10:00',
  worldClockSchedule: buildWorldClockSchedule(DEFAULT_BLOCK_DURATION_S),

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
  servedCount: 0,

  // ── Steak / Kitchen (multi-step) ────────────────────────
  hobs: initialHobs.map(h => ({ ...h })),

  spawnSteak: (hobId, duration) => set((state) => {
    const cfg = state.remoteConfig?.steak || {}
    const baseTimes = cfg.hob_base_cooking_ms || [11000, 13000, 15000]
    const jitter = cfg.cooking_jitter_ms || 1000
    const baseCooking = baseTimes[hobId] || 13000
    const cookingMs = duration?.cooking ?? (baseCooking + (Math.random() * 2 - 1) * jitter)
    const readyMs = duration?.ready ?? (cfg.ready_ms || 4000)
    const ashMs = cfg.ash_countdown_ms || 9000
    return {
      hobs: state.hobs.map(h =>
        h.id === hobId && h.status === HOB_STATUS.EMPTY
          ? { ...h, status: HOB_STATUS.COOKING_SIDE1, startedAt: ts(), cookingMs, readyMs, ashMs, peppered: false }
          : h
      ),
    }
  }),

  transitionHob: (hobId, newStatus) => set((state) => {
    const scoring = state.remoteConfig?.scoring || {}
    let scoreDelta = 0
    const newHobs = state.hobs.map(h => {
      if (h.id !== hobId) return h
      // COOKING_SIDE1 → READY_SIDE1
      if (newStatus === HOB_STATUS.READY_SIDE1 && h.status === HOB_STATUS.COOKING_SIDE1) {
        return { ...h, status: HOB_STATUS.READY_SIDE1, startedAt: ts(), peppered: false }
      }
      // READY_SIDE1 → BURNING (timed out)
      if (newStatus === HOB_STATUS.BURNING && h.status === HOB_STATUS.READY_SIDE1) {
        return { ...h, status: HOB_STATUS.BURNING, startedAt: ts() }
      }
      // COOKING_SIDE2 → READY_SIDE2
      if (newStatus === HOB_STATUS.READY_SIDE2 && h.status === HOB_STATUS.COOKING_SIDE2) {
        return { ...h, status: HOB_STATUS.READY_SIDE2, startedAt: ts(), peppered: false }
      }
      // READY_SIDE2 → BURNING (timed out)
      if (newStatus === HOB_STATUS.BURNING && h.status === HOB_STATUS.READY_SIDE2) {
        return { ...h, status: HOB_STATUS.BURNING, startedAt: ts() }
      }
      // BURNING → ASH (ash countdown expired)
      if (newStatus === HOB_STATUS.ASH && h.status === HOB_STATUS.BURNING) {
        return { ...h, status: HOB_STATUS.ASH, startedAt: ts() }
      }
      // ASH → EMPTY (auto-clear after 2s)
      if (newStatus === HOB_STATUS.EMPTY && h.status === HOB_STATUS.ASH) {
        scoreDelta += (scoring.steak_ash_penalty ?? -20)
        return { ...h, status: HOB_STATUS.EMPTY, startedAt: null, peppered: false }
      }
      return h
    })
    return { hobs: newHobs, score: state.score + scoreDelta }
  }),

  // Add pepper to the current ready side
  pepperSteak: (hobId) => {
    const state = get()
    const hob = state.hobs.find(h => h.id === hobId)
    if (!hob) return
    const isReady = hob.status === HOB_STATUS.READY_SIDE1 || hob.status === HOB_STATUS.READY_SIDE2
    if (!isReady || hob.peppered) return
    const scoring = state.remoteConfig?.scoring || {}
    set((s) => ({
      hobs: s.hobs.map(h =>
        h.id === hobId ? { ...h, peppered: true } : h
      ),
      score: s.score + (scoring.steak_pepper ?? 2),
    }))
    if (state.sessionId) {
      reportSteakAction(state.sessionId, state.blockNumber, hobId, 'pepper').catch(err =>
        console.error('[Steak] pepper report failed:', err)
      )
    }
  },

  // Flip from READY_SIDE1 (peppered) → COOKING_SIDE2
  flipSteak: (hobId) => {
    const state = get()
    const hob = state.hobs.find(h => h.id === hobId)
    if (!hob || hob.status !== HOB_STATUS.READY_SIDE1 || !hob.peppered) return
    const { sessionId, blockNumber } = state
    set((s) => ({
      hobs: s.hobs.map(h =>
        h.id === hobId
          ? { ...h, status: HOB_STATUS.COOKING_SIDE2, startedAt: ts(), peppered: false }
          : h
      ),
    }))
    if (sessionId) {
      reportSteakAction(sessionId, blockNumber, hobId, 'flip').catch(err =>
        console.error('[Steak] flip report failed:', err)
      )
    }
  },

  // Serve from READY_SIDE2 (peppered) → EMPTY
  serveSteak: (hobId) => {
    const state = get()
    const hob = state.hobs.find(h => h.id === hobId)
    if (!hob || hob.status !== HOB_STATUS.READY_SIDE2 || !hob.peppered) return
    const { sessionId, blockNumber, sseConnected } = state
    const scoring = state.remoteConfig?.scoring || {}
    set((s) => ({
      hobs: s.hobs.map(h =>
        h.id === hobId
          ? { ...h, status: HOB_STATUS.EMPTY, startedAt: null, peppered: false }
          : h
      ),
      score: s.score + (scoring.steak_serve ?? 5),
      servedCount: s.servedCount + 1,
    }))
    if (sessionId) {
      reportSteakAction(sessionId, blockNumber, hobId, 'serve').catch(err =>
        console.error('[Steak] serve report failed:', err)
      )
    } else if (!sseConnected) {
      const cfg = state.remoteConfig?.steak || {}
      const minMs = cfg.respawn_min_ms || 8000
      const maxMs = cfg.respawn_max_ms || 15000
      const delay = minMs + Math.random() * (maxMs - minMs)
      setTimeout(() => {
        const s = get()
        if (s.blockRunning && !s.sseConnected && s.hobs.find(h => h.id === hobId)?.status === HOB_STATUS.EMPTY) {
          s.spawnSteak(hobId)
        }
      }, delay)
    }
  },

  // Clean a BURNING hob → EMPTY
  cleanSteak: (hobId) => {
    const state = get()
    const hob = state.hobs.find(h => h.id === hobId)
    if (!hob || hob.status !== HOB_STATUS.BURNING) return
    const { sessionId, blockNumber, sseConnected } = state
    const scoring = state.remoteConfig?.scoring || {}
    set((s) => ({
      hobs: s.hobs.map(h =>
        h.id === hobId
          ? { ...h, status: HOB_STATUS.EMPTY, startedAt: null, peppered: false }
          : h
      ),
      score: s.score + (scoring.steak_burn_penalty ?? -10),
    }))
    if (sessionId) {
      reportSteakAction(sessionId, blockNumber, hobId, 'clean').catch(err =>
        console.error('[Steak] clean report failed:', err)
      )
    } else if (!sseConnected) {
      const cfg = state.remoteConfig?.steak || {}
      const minMs = cfg.respawn_min_ms || 8000
      const maxMs = cfg.respawn_max_ms || 15000
      const delay = minMs + Math.random() * (maxMs - minMs)
      setTimeout(() => {
        const s = get()
        if (s.blockRunning && !s.sseConnected && s.hobs.find(h => h.id === hobId)?.status === HOB_STATUS.EMPTY) {
          s.spawnSteak(hobId)
        }
      }, delay)
    }
  },

  forceYellowSteak: (hobId) => set((state) => ({
    hobs: state.hobs.map(h => {
      if (h.id !== hobId) return h
      if (h.status === HOB_STATUS.COOKING_SIDE2 || h.status === HOB_STATUS.READY_SIDE2) {
        return { ...h, status: HOB_STATUS.READY_SIDE2, startedAt: ts(), peppered: false }
      }
      return { ...h, status: HOB_STATUS.READY_SIDE1, startedAt: ts(), peppered: false }
    }),
  })),

  // ── Laundry (Washing Machine) ──────────────────────────
  laundry: initialLaundry(),

  initLaundryPile: () => set((state) => {
    const pool = state.remoteConfig?.laundry?.garment_pool || DEFAULT_GARMENT_POOL
    // Fisher-Yates shuffle then take 3-5 starter garments
    const shuffled = [...pool]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    const count = Math.min(shuffled.length, 3 + Math.floor(Math.random() * 3))
    const overflowThreshold = Number(
      state.remoteConfig?.laundry?.pile_overflow_threshold
      ?? LAUNDRY_OVERFLOW_THRESHOLD
    )
    return {
      laundry: {
        ...initialLaundry(),
        pile: shuffled.slice(0, count),
        overflowThreshold,
        nextPileDropAt: randomLaundryDropDelayS(state.remoteConfig),
      },
    }
  }),

  pickGarment: () => set((state) => {
    if (state.laundry.pile.length === 0) return {}
    const [first, ...rest] = state.laundry.pile
    return {
      laundry: {
        ...state.laundry,
        pile: rest,
        currentGarment: first,
        selectedDetergent: null,
        selectedTemp: null,
        washStatus: 'selecting',
      },
    }
  }),

  selectDetergent: (det) => set((state) => ({
    laundry: { ...state.laundry, selectedDetergent: det },
  })),

  selectTemp: (temp) => set((state) => ({
    laundry: { ...state.laundry, selectedTemp: temp },
  })),

  startWash: () => set((state) => {
    const { laundry } = state
    if (laundry.washStatus !== 'selecting' || !laundry.currentGarment) return {}
    if (!laundry.selectedDetergent || !laundry.selectedTemp) return {}

    const garment = laundry.currentGarment
    const rules = state.remoteConfig?.laundry?.rules || LAUNDRY_RULES
    const rule = rules[garment.category]
    const normalizeDetergent = (value) => {
      const s = String(value || '').toLowerCase()
      if (s.includes('warm')) return 'warm'
      if (s.includes('cold')) return 'cold'
      if (s.includes('white')) return 'white'
      return s.trim()
    }
    const normalizeTemp = (value) => {
      const n = parseInt(String(value || '').replace(/[^\d]/g, ''), 10)
      return Number.isNaN(n) ? null : n
    }
    const expectedDetergent = normalizeDetergent(rule?.detergent)
    const expectedTemp = normalizeTemp(rule?.temp)
    const isCorrect = expectedDetergent !== ''
      ? (laundry.selectedDetergent === expectedDetergent && laundry.selectedTemp === expectedTemp)
      : false

    const washDuration = randomLaundryWashDurationS(state.remoteConfig)
    return {
      laundry: {
        ...laundry,
        washStatus: 'washing',
        washProgress: 0,
        washDuration,
        isCorrect,
        jamTriggered: false,
        lastCorrect: isCorrect,
      },
    }
  }),
  startWashing: () => get().startWash(),

  tickLaundry: () => set((state) => {
    const { laundry } = state
    if (laundry.washStatus === 'washing') {
      const next = laundry.washProgress + 1

      // One-time jam check after halfway point.
      if (!laundry.jamTriggered && next >= Math.floor(laundry.washDuration * 0.5)) {
        const jamProb = Number(state.remoteConfig?.laundry?.jam_probability ?? 0.4)
        if (Math.random() < jamProb) {
          const jamFixMs = Number(state.remoteConfig?.timers?.laundry_jam_fix_ms ?? 15000)
          return {
            laundry: {
              ...laundry,
              washStatus: 'jammed',
              jamFixDeadline: ts() + jamFixMs,
              jamTriggered: true,
            },
          }
        }
        return { laundry: { ...laundry, washProgress: next, jamTriggered: true } }
      }

      if (next >= laundry.washDuration) {
        return { laundry: { ...laundry, washStatus: 'done', washProgress: laundry.washDuration } }
      }
      return { laundry: { ...laundry, washProgress: next } }
    }
    if (laundry.washStatus === 'jammed' && laundry.jamFixDeadline && ts() >= laundry.jamFixDeadline) {
      const scoring = state.remoteConfig?.scoring || {}
      return {
        laundry: {
          ...laundry,
          washStatus: 'idle',
          currentGarment: null,
          selectedDetergent: null,
          selectedTemp: null,
          washProgress: 0,
          washDuration: 0,
          jamFixDeadline: null,
          jamTriggered: false,
        },
        score: state.score + (scoring.laundry_jam_miss ?? scoring.laundry_jam_fail ?? -5),
      }
    }
    return {}
  }),

  tickLaundryPile: () => set((state) => {
    const { laundry, blockTimer } = state
    let nextLaundry = laundry
    let scoreDelta = 0

    const pool = state.remoteConfig?.laundry?.garment_pool || DEFAULT_GARMENT_POOL
    const overflowThreshold = Number(
      state.remoteConfig?.laundry?.pile_overflow_threshold
      ?? laundry.overflowThreshold
      ?? LAUNDRY_OVERFLOW_THRESHOLD
    )
    const overflowPenaltyEveryS = Number(
      state.remoteConfig?.laundry?.pile_overflow_penalty_every_s
      ?? LAUNDRY_OVERFLOW_PENALTY_EVERY_S
    )
    const scoring = state.remoteConfig?.scoring || {}
    const overflowPenalty = Number(
      scoring.laundry_pile_overflow_penalty
      ?? LAUNDRY_OVERFLOW_PENALTY
    )

    if (typeof laundry.nextPileDropAt === 'number' && blockTimer >= laundry.nextPileDropAt) {
      nextLaundry = {
        ...nextLaundry,
        pile: [...nextLaundry.pile, pickRandomGarment(pool)],
        nextPileDropAt: blockTimer + randomLaundryDropDelayS(state.remoteConfig),
        familyDropCount: (nextLaundry.familyDropCount || 0) + 1,
        lastFamilyDropAt: ts(),
      }
    }

    const isOverflowing = nextLaundry.pile.length > overflowThreshold
    if (isOverflowing) {
      const dueAt = nextLaundry.nextOverflowPenaltyAt ?? blockTimer
      if (blockTimer >= dueAt) {
        scoreDelta += overflowPenalty
        nextLaundry = {
          ...nextLaundry,
          nextOverflowPenaltyAt: blockTimer + Math.max(1, overflowPenaltyEveryS),
        }
      }
    } else if (nextLaundry.nextOverflowPenaltyAt != null) {
      nextLaundry = {
        ...nextLaundry,
        nextOverflowPenaltyAt: null,
      }
    }

    if (nextLaundry === laundry && scoreDelta === 0) return {}
    return {
      laundry: nextLaundry,
      score: state.score + scoreDelta,
    }
  }),

  collectGarment: () => set((state) => {
    const { laundry } = state
    if (laundry.washStatus !== 'done') return {}
    const scoring = state.remoteConfig?.scoring || {}
    const pts = laundry.isCorrect
      ? (scoring.laundry_correct ?? 3)
      : (scoring.laundry_wrong ?? -2)
    return {
      laundry: {
        ...laundry,
        washStatus: 'idle',
        currentGarment: null,
        selectedDetergent: null,
        selectedTemp: null,
        washProgress: 0,
        washDuration: 0,
        isCorrect: undefined,
        jamTriggered: false,
        lastCorrect: laundry.isCorrect,
        completedCount: laundry.completedCount + 1,
        correctCount: laundry.correctCount + (laundry.isCorrect ? 1 : 0),
      },
      score: state.score + pts,
    }
  }),

  triggerJam: () => set((state) => {
    if (state.laundry.washStatus !== 'washing') return {}
    return {
      laundry: { ...state.laundry, washStatus: 'jammed', jamFixDeadline: ts() + 15000 },
    }
  }),

  fixJam: () => set((state) => {
    if (state.laundry.washStatus !== 'jammed') return {}
    return {
      laundry: { ...state.laundry, washStatus: 'washing', jamFixDeadline: null },
    }
  }),

  // ── Messages (Email Inbox – 3-option) ───────────────────
  messageBubbles: [],
  unreadCount: 0,
  selectedEmailId: null,
  mailToast: null,

  addMessageBubble: (bubble) => {
    const timeoutMs = get().remoteConfig?.timers?.message_timeout_ms || 30000
    const now = ts()
    const normalized = {
      ...bubble,
      id: now,
      replied: false,
      expired: false,
      read: false,
      receivedAt: now,
      from: bubble.from || 'Unknown',
      subject: bubble.subject || 'New message',
      body: bubble.body || '',
      avatar: bubble.avatar || '?',
      options: bubble.options || ['OK', 'Skip', 'Later'],
      correct: bubble.correct ?? 0,
      timeoutMs,
    }
    const preview = (normalized.body || normalized.subject || '').replace(/\s+/g, ' ').trim().slice(0, 76)
    set((state) => ({
      messageBubbles: [...state.messageBubbles, normalized],
      unreadCount: state.unreadCount + 1,
      mailToast: {
        id: normalized.id,
        from: normalized.from,
        avatar: normalized.avatar,
        preview,
      },
    }))
  },

  dismissMailToast: () => set({ mailToast: null }),

  openInboxFromToast: () => {
    const state = get()
    state.dismissMailToast()
    state.setActiveRoom('overview')
    setTimeout(() => {
      get().setActiveRoom('messages')
    }, 340)
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

  replyToBubble: (bubbleId, choiceIndex) => {
    const bubble = get().messageBubbles.find(b => b.id === bubbleId)
    if (!bubble || bubble.replied || bubble.expired) return
    const scoring = get().remoteConfig?.scoring || {}
    const isCorrect = choiceIndex === bubble.correct
    const pts = isCorrect ? (scoring.message_correct || 3) : (scoring.message_wrong || -2)
    set((state) => ({
      messageBubbles: state.messageBubbles.map((b) =>
        b.id === bubbleId ? { ...b, replied: true, replyChoice: choiceIndex, repliedAt: ts(), replyCorrect: isCorrect } : b
      ),
      score: state.score + pts,
    }))
  },

  expireMessage: (bubbleId) => {
    const bubble = get().messageBubbles.find(b => b.id === bubbleId)
    if (!bubble || bubble.replied || bubble.expired) return
    const scoring = get().remoteConfig?.scoring || {}
    set((state) => ({
      messageBubbles: state.messageBubbles.map((b) =>
        b.id === bubbleId ? { ...b, expired: true, expiredAt: ts() } : b
      ),
      score: state.score + (scoring.message_expire_penalty || -2),
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

  // ── WS ─────────────────────────────────────────────────
  sseConnected: false,
  setSseConnected: (val) => set({ sseConnected: val }),

  // ── Encoding ───────────────────────────────────────────
  encodingConfirmed: false,
  encodingQuizAttempts: 0,

  startBlockEncoding: (blockData) => {
    const durationS = getBlockDurationS(get().remoteConfig)
    const timeContext = deriveTimeContext(0, durationS)
    set({
      phase: 'block_encoding',
      blockNumber: blockData.blockNumber,
      condition: blockData.condition,
      taskPairId: blockData.taskPairId,
      blockRunning: false,
      blockTimer: 0,
      dayPhase: timeContext.dayPhase,
      worldClockLabel: timeContext.worldClockLabel,
      worldClockSchedule: buildWorldClockSchedule(durationS),
      score: 0,
      servedCount: 0,
      hobs: initialHobs.map(h => ({ ...h })),
      messageBubbles: [],
      unreadCount: 0,
      selectedEmailId: null,
      mailToast: null,
      interactableTasks: [],
      openCabinetTask: null,
      encodingConfirmed: false,
      encodingQuizAttempts: 0,
      laundry: initialLaundry(),
      fakeTriggered: false,
      fakeType: null,
      robotSpeaking: false,
      robotText: '',
      activeRoom: 'overview',
      plantNeedsWater: false,
      plantWilted: false,
      plantLastWatered: null,
      plantNeedsWaterSince: null,
    })
    get().initLaundryPile()
  },

  confirmEncoding: (quizAttempts = 1) => {
    const durationS = getBlockDurationS(get().remoteConfig)
    const timeContext = deriveTimeContext(0, durationS)
    set({
      phase: 'block_running',
      blockRunning: true,
      blockTimer: 0,
      dayPhase: timeContext.dayPhase,
      worldClockLabel: timeContext.worldClockLabel,
      worldClockSchedule: buildWorldClockSchedule(durationS),
      encodingConfirmed: true,
      encodingQuizAttempts: quizAttempts,
    })
  },

  // ── Block Control ──────────────────────────────────────
  blockTimer: 0,
  blockRunning: false,

  startBlock: (blockData) => {
    const durationS = getBlockDurationS(get().remoteConfig)
    const timeContext = deriveTimeContext(0, durationS)
    set({
      phase: 'block_running',
      blockNumber: blockData.blockNumber,
      condition: blockData.condition,
      taskPairId: blockData.taskPairId,
      blockRunning: true,
      blockTimer: 0,
      dayPhase: timeContext.dayPhase,
      worldClockLabel: timeContext.worldClockLabel,
      worldClockSchedule: buildWorldClockSchedule(durationS),
      score: 0,
      servedCount: 0,
      hobs: initialHobs.map(h => ({ ...h })),
      messageBubbles: [],
      unreadCount: 0,
      selectedEmailId: null,
      mailToast: null,
      interactableTasks: [],
      openCabinetTask: null,
      laundry: initialLaundry(),
      fakeTriggered: false,
      fakeType: null,
      robotSpeaking: false,
      robotText: '',
      activeRoom: 'overview',
      plantNeedsWater: false,
      plantWilted: false,
      plantLastWatered: null,
      plantNeedsWaterSince: null,
    })
    get().initLaundryPile()
  },

  endBlock: () => set((s) => ({
    blockRunning: false,
    phase: 'block_end',
    mailToast: null,
  })),

  tickBlockTimer: () => set((s) => {
    const nextTimer = s.blockTimer + 1
    const { dayPhase, worldClockLabel } = deriveTimeContext(nextTimer, getBlockDurationS(s.remoteConfig))
    return {
      blockTimer: nextTimer,
      dayPhase,
      worldClockLabel,
    }
  }),

  // ── Session Setup ──────────────────────────────────────
  setSession: (data) => set({
    sessionId: data.sessionId,
    participantId: data.participantId,
    group: data.group,
    conditionOrder: data.conditionOrder || null,
  }),

  setPhase: (phase) => set({ phase }),

  // ── Sidebar Status ─────────────────────────────────────
  getKitchenStatus: () => {
    const hobs = get().hobs
    if (hobs.some(h => h.status === HOB_STATUS.BURNING || h.status === HOB_STATUS.ASH)) return 'red'
    if (hobs.some(h => h.status === HOB_STATUS.READY_SIDE1 || h.status === HOB_STATUS.READY_SIDE2)) return 'orange'
    return null
  },

  getBalconyStatus: () => {
    const { laundry } = get()
    if (laundry.washStatus === 'jammed') return 'red'
    if (laundry.pile.length > (laundry.overflowThreshold ?? LAUNDRY_OVERFLOW_THRESHOLD)) return 'red'
    if (laundry.washStatus === 'done') return 'orange'
    if (laundry.washStatus === 'washing') return 'blue'
    return null
  },

  getLivingStatus: () => {
    const { plantNeedsWater, plantWilted } = get()
    if (plantWilted) return 'red'
    if (plantNeedsWater) return 'orange'
    return null
  },

  getInboxStatus: () => {
    const { messageBubbles, remoteConfig } = get()
    const now = ts()
    const timeoutMs = remoteConfig?.timers?.message_timeout_ms || 30000
    const hasUrgent = messageBubbles.some(b => !b.replied && !b.expired && (now - b.receivedAt) > timeoutMs * 0.7)
    const hasUnreplied = messageBubbles.some(b => !b.replied && !b.expired)
    if (hasUrgent) return 'red'
    if (hasUnreplied) return 'orange'
    return null
  },
}))
