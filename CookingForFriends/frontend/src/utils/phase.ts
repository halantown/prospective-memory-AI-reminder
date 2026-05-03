import type { Phase } from '../types'

type RenderPhase =
  | 'welcome'
  | 'consent'
  | 'introduction'
  | 'playing'
  | 'post_questionnaire'
  | 'debrief'
  | 'complete'

const CANONICAL_TO_RENDER: Record<string, RenderPhase> = {
  TOKEN_INPUT: 'welcome',
  WELCOME: 'welcome',
  CONSENT: 'consent',
  DEMOGRAPHICS: 'introduction',
  MSE_PRE: 'introduction',
  STORY_INTRO: 'introduction',
  ENCODING_VIDEO_1: 'introduction',
  MANIP_CHECK_1: 'introduction',
  ASSIGN_1: 'introduction',
  ENCODING_VIDEO_2: 'introduction',
  MANIP_CHECK_2: 'introduction',
  ASSIGN_2: 'introduction',
  ENCODING_VIDEO_3: 'introduction',
  MANIP_CHECK_3: 'introduction',
  ASSIGN_3: 'introduction',
  ENCODING_VIDEO_4: 'introduction',
  MANIP_CHECK_4: 'introduction',
  ASSIGN_4: 'introduction',
  RECAP: 'introduction',
  TUTORIAL_PHONE: 'introduction',
  TUTORIAL_COOKING: 'introduction',
  TUTORIAL_TRIGGER: 'introduction',
  EVENING_TRANSITION: 'introduction',
  MAIN_EXPERIMENT: 'playing',
  POST_MANIP_CHECK: 'post_questionnaire',
  POST_SUBJECTIVE_DV: 'post_questionnaire',
  POST_NASA_TLX: 'post_questionnaire',
  POST_MSE: 'post_questionnaire',
  POST_RETRO_CHECK: 'post_questionnaire',
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

