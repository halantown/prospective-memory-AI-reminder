import type { Phase } from '../types'

type RenderPhase =
  | 'welcome'
  | 'consent'
  | 'demographics'
  | 'mse_pre'
  | 'story_intro'
  | 'encoding_flow'
  | 'tutorial_flow'
  | 'evening_transition'
  | 'playing'
  | 'post_test'
  | 'debrief'
  | 'complete'

const CANONICAL_TO_RENDER: Record<string, RenderPhase> = {
  TOKEN_INPUT: 'welcome',
  WELCOME: 'welcome',
  CONSENT: 'consent',
  DEMOGRAPHICS: 'demographics',
  MSE_PRE: 'mse_pre',
  STORY_INTRO: 'story_intro',
  ENCODING_VIDEO_1: 'encoding_flow',
  MANIP_CHECK_1: 'encoding_flow',
  ASSIGN_1: 'encoding_flow',
  ENCODING_VIDEO_2: 'encoding_flow',
  MANIP_CHECK_2: 'encoding_flow',
  ASSIGN_2: 'encoding_flow',
  ENCODING_VIDEO_3: 'encoding_flow',
  MANIP_CHECK_3: 'encoding_flow',
  ASSIGN_3: 'encoding_flow',
  ENCODING_VIDEO_4: 'encoding_flow',
  MANIP_CHECK_4: 'encoding_flow',
  ASSIGN_4: 'encoding_flow',
  RECAP: 'encoding_flow',
  TUTORIAL_PHONE: 'tutorial_flow',
  TUTORIAL_COOKING: 'tutorial_flow',
  TUTORIAL_TRIGGER: 'tutorial_flow',
  EVENING_TRANSITION: 'evening_transition',
  MAIN_EXPERIMENT: 'playing',
  POST_MANIP_CHECK: 'post_test',
  POST_SUBJECTIVE_DV: 'post_test',
  POST_NASA_TLX: 'post_test',
  POST_MSE: 'post_test',
  POST_RETRO_CHECK: 'post_test',
  DEBRIEF: 'debrief',
  COMPLETED: 'complete',
}

const UI_TO_RENDER: Record<string, RenderPhase> = {
  welcome: 'welcome',
  complete: 'complete',
}

export function renderPhaseFor(phase: string | null | undefined): RenderPhase {
  if (!phase) return 'welcome'
  const renderPhase = CANONICAL_TO_RENDER[phase] ?? UI_TO_RENDER[phase]
  if (!renderPhase) {
    throw new Error(`Unknown frontend phase: ${phase}`)
  }
  return renderPhase
}

export function frontendPhaseForBackend(phase: string | null | undefined): Phase {
  if (!phase) return 'WELCOME'
  if (CANONICAL_TO_RENDER[phase]) return phase as Phase

  const upper = phase.toUpperCase()
  if (CANONICAL_TO_RENDER[upper]) return upper as Phase

  const uiPhase: Record<string, Phase> = {
    welcome: 'WELCOME',
    complete: 'COMPLETED',
  }

  const mapped = uiPhase[phase]
  if (!mapped) {
    throw new Error(`Unknown backend phase: ${phase}`)
  }
  return mapped
}

export function isMainExperimentPhase(phase: string | null | undefined): boolean {
  return phase === 'MAIN_EXPERIMENT'
}
