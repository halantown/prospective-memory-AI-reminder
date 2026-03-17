import { create } from 'zustand'

export const TRIGGER_STATE = { INACTIVE: 'inactive', AMBIENT: 'ambient', FIRED: 'fired' }

const INITIAL_TRIGGERS = [
  { id: 'dinner_table', emoji: '🍽️', label: 'Dinner ready', state: 'inactive', taskId: null },
  { id: 'phone_notification', emoji: '📱', label: 'Friend arriving', state: 'inactive', taskId: null },
  { id: 'washing_machine', emoji: '🫧', label: 'Laundry done', state: 'inactive', taskId: null },
  { id: 'doorbell', emoji: '🔔', label: 'Doorbell', state: 'inactive', taskId: null },
  { id: 'kitchen_timer', emoji: '⏲️', label: 'Timer done', state: 'inactive', taskId: null },
  { id: 'tv_weather', emoji: '📺', label: 'Weather alert', state: 'inactive', taskId: null },
  { id: 'clock_3pm', emoji: '🕐', label: '3:00 PM', state: 'inactive', taskId: null },
  { id: 'friend_leaving', emoji: '💬', label: 'Friend leaving', state: 'inactive', taskId: null },
]

export const useGameStore = create((set, get) => ({
  // Session state
  sessionId: null,
  participantId: null,
  group: null,
  conditionOrder: [],

  // Phase: welcome | onboarding | encoding | playing | questionnaire | block_end | complete
  phase: 'welcome',
  blockNumber: 0,

  // Game state
  currentGameType: null,
  currentSkin: null,
  gameItems: [],
  itemIndex: 0,
  gameActive: false,
  gameDimmed: false,

  // Ongoing task stats
  ongoingStats: { correct: 0, wrong: 0, missed: 0, total: 0 },
  responseBuffer: [],

  // Sidebar state
  simulatedTime: '10:00 AM',
  currentRoom: 'study',
  activityLabel: 'Getting ready',
  triggers: [...INITIAL_TRIGGERS],
  activeExecutionWindow: null,

  // Robot state
  robotStatus: 'idle',
  robotText: null,
  utteranceQueue: [],

  // MCQ state
  mcqVisible: false,
  mcqData: null,
  mcqStartTime: null,

  // WebSocket
  wsConnected: false,
  wsSend: null,

  // ── Actions ──

  setSession: (data) => set({
    sessionId: data.session_id,
    participantId: data.participant_id,
    group: data.group,
    conditionOrder: data.condition_order,
  }),
  setPhase: (phase) => set({ phase }),
  setBlockNumber: (n) => set({ blockNumber: n }),

  setWsConnected: (connected) => set({ wsConnected: connected }),
  setWsSend: (fn) => set({ wsSend: fn }),

  handleGameStart: (data) => {
    const room = data.room || {}
    set({
      currentGameType: data.game_type,
      currentSkin: data.skin,
      gameItems: data.items || [],
      itemIndex: 0,
      gameActive: true,
      gameDimmed: false,
      ongoingStats: { correct: 0, wrong: 0, missed: 0, total: 0 },
      currentRoom: room.room || get().currentRoom,
      simulatedTime: room.time || get().simulatedTime,
      activityLabel: room.activity || get().activityLabel,
    })
  },

  handleGameEnd: () => set({
    gameActive: false,
    currentGameType: null,
  }),

  handleRoomTransition: (data) => set({
    currentRoom: data.to || data.room,
    simulatedTime: data.time || get().simulatedTime,
    activityLabel: data.narrative || data.activity || '',
    gameActive: false,
  }),

  handleRobotSpeak: (data) => {
    const queue = [...get().utteranceQueue, { text: data.text, type: data.type || 'neutral' }]
    set({ utteranceQueue: queue })
    if (get().robotStatus === 'idle') {
      get().playNextUtterance()
    }
  },

  playNextUtterance: () => {
    const queue = get().utteranceQueue
    if (queue.length === 0) {
      set({ robotStatus: 'idle', robotText: null })
      return
    }
    const next = queue[0]
    set({
      utteranceQueue: queue.slice(1),
      robotStatus: 'speaking',
      robotText: next.text,
    })
  },

  finishSpeaking: () => {
    set({ robotStatus: 'idle', robotText: null })
    setTimeout(() => get().playNextUtterance(), 500)
  },

  handleTriggerFire: (data) => {
    const triggers = get().triggers.map(t =>
      t.id === data.sidebar_icon
        ? { ...t, state: 'fired', taskId: data.task_id }
        : t
    )
    set({
      triggers,
      activeExecutionWindow: {
        taskId: data.task_id,
        sidebarIcon: data.sidebar_icon,
        expiresAt: Date.now() + 30000,
      },
    })
  },

  handleAmbientPulse: (data) => {
    const triggers = get().triggers.map(t =>
      t.id === data.icon ? { ...t, state: 'ambient' } : t
    )
    set({ triggers })
    setTimeout(() => {
      const triggers2 = get().triggers.map(t =>
        t.id === data.icon && t.state === 'ambient' ? { ...t, state: 'inactive' } : t
      )
      set({ triggers: triggers2 })
    }, 10000)
  },

  handleWindowClose: (data) => {
    const triggers = get().triggers.map(t =>
      t.taskId === data.task_id ? { ...t, state: 'inactive', taskId: null } : t
    )
    set({ triggers, activeExecutionWindow: null })
  },

  clickTrigger: (triggerId) => {
    const trigger = get().triggers.find(t => t.id === triggerId)
    if (!trigger || trigger.state !== 'fired') return

    const send = get().wsSend
    if (send) {
      send({ type: 'trigger_click', data: { task_id: trigger.taskId } })
    }
  },

  showMCQ: (data) => set({
    mcqVisible: true,
    mcqData: data,
    mcqStartTime: Date.now(),
    gameDimmed: true,
  }),

  submitMCQ: (selected) => {
    const { mcqData, mcqStartTime, wsSend } = get()
    if (!mcqData || !wsSend) return

    wsSend({
      type: 'mcq_answer',
      data: {
        task_id: mcqData.task_id,
        selected,
        mcq_response_time_ms: Date.now() - mcqStartTime,
        client_ts: Date.now(),
      },
    })

    const triggers = get().triggers.map(t =>
      t.taskId === mcqData.task_id ? { ...t, state: 'inactive', taskId: null } : t
    )
    set({
      mcqVisible: false,
      mcqData: null,
      mcqStartTime: null,
      gameDimmed: false,
      triggers,
      activeExecutionWindow: null,
    })
  },

  recordResponse: (response) => {
    const stats = { ...get().ongoingStats }
    stats.total++
    if (response.correct) stats.correct++
    else if (response.skipped) stats.missed++
    else stats.wrong++

    const buffer = [...get().responseBuffer, response]
    set({ ongoingStats: stats, responseBuffer: buffer, itemIndex: get().itemIndex + 1 })
  },

  flushResponseBuffer: () => {
    const { responseBuffer, wsSend, currentGameType, currentSkin, blockNumber } = get()
    if (responseBuffer.length === 0 || !wsSend) return

    wsSend({
      type: 'ongoing_batch',
      data: {
        game_type: currentGameType,
        skin: currentSkin,
        block_number: blockNumber,
        responses: responseBuffer,
      },
    })
    set({ responseBuffer: [] })
  },

  handleBlockEnd: () => set({
    phase: 'questionnaire',
    gameActive: false,
    currentGameType: null,
  }),

  submitQuestionnaire: (data) => {
    const send = get().wsSend
    if (send) {
      send({ type: 'questionnaire', data: { ...data, block: get().blockNumber } })
    }
    set({ phase: 'block_end' })
  },

  submitEncoding: (taskId, attempts) => {
    const send = get().wsSend
    if (send) {
      send({ type: 'encoding_result', data: { task_id: taskId, quiz_attempts: attempts } })
    }
  },

  resetBlock: () => set({
    currentGameType: null,
    currentSkin: null,
    gameItems: [],
    itemIndex: 0,
    gameActive: false,
    gameDimmed: false,
    ongoingStats: { correct: 0, wrong: 0, missed: 0, total: 0 },
    responseBuffer: [],
    triggers: [...INITIAL_TRIGGERS],
    activeExecutionWindow: null,
    mcqVisible: false,
    mcqData: null,
    robotText: null,
    utteranceQueue: [],
    robotStatus: 'idle',
  }),
}))
