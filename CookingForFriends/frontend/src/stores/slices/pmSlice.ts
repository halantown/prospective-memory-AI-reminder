import type { StateCreator } from 'zustand'
import type { GameState, PMSlice } from './types'

export const createPMSlice: StateCreator<GameState, [], [], PMSlice> = (set, get) => ({
  robot: { room: 'kitchen', speaking: false, text: '', visible: true },
  activePMTrials: [],
  completedPMTrialIds: new Set(),
  pmTargetSelected: null,
  pmActionPhase: 'idle',
  taskOrder: null,
  isTest: false,
  currentPhase: 'welcome',
  pmPipelineState: null,
  gameTimeFrozen: false,
  cutsceneTaskIndex: 0,
  cutsceneSegmentIndex: 0,

  setRobotSpeaking: (text) => set((s) => ({
    robot: { ...s.robot, speaking: true, text },
  })),

  clearRobotSpeech: () => set((s) => ({
    robot: { ...s.robot, speaking: false, text: '' },
  })),

  setRobotRoom: (room) => set((s) => ({
    robot: { ...s.robot, room },
  })),

  addPMTrial: (trial) => set((s) => {
    if (s.completedPMTrialIds.has(trial.triggerId)) return s
    if (s.activePMTrials.some(t => t.triggerId === trial.triggerId)) return s
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
      pmActionPhase: 'idle' as const,
      visitors: newVisitors,
    }
  }),

  setPMTargetSelected: (target) => set({ pmTargetSelected: target }),
  setPMActionPhase: (phase) => set({ pmActionPhase: phase }),
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

  getActivePMForRoom: (room) => {
    return get().activePMTrials.find(
      t => t.taskConfig.target_room.toLowerCase() === room.toLowerCase()
    )
  },

  hasActivePMTrigger: () => get().activePMTrials.length > 0,
})
