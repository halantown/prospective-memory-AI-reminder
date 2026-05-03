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
  | 'introduction'
  | 'playing'
  | 'post_test'
  | 'post_questionnaire'
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

const LEGACY_TO_RENDER: Record<string, RenderPhase> = {
  welcome: 'welcome',
  onboarding: 'welcome',
  consent: 'consent',
  introduction: 'introduction',
  encoding: 'introduction',
  playing: 'playing',
  pending: 'playing',
  completed: 'debrief',
  post_questionnaire: 'post_questionnaire',
  debrief: 'debrief',
  complete: 'complete',
}

export function renderPhaseFor(phase: string | null | undefined): RenderPhase {
  if (!phase) return 'welcome'
  return CANONICAL_TO_RENDER[phase] ?? LEGACY_TO_RENDER[phase] ?? CANONICAL_TO_RENDER[phase.toUpperCase()] ?? 'welcome'
}

export function frontendPhaseForBackend(phase: string | null | undefined): Phase {
  return renderPhaseFor(phase) as Phase
}

export function isMainExperimentPhase(phase: string | null | undefined): boolean {
  return phase === 'MAIN_EXPERIMENT' || phase === 'playing'
}
