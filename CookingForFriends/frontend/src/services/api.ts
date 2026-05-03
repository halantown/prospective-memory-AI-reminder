/** API service — all HTTP calls to backend. */

import type { BlockEncoding, CookingDefinitions, ExperimentConfig, ExperimentResponseInput } from '../types'

const API_BASE = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

// ── Participant (game) endpoints ──

export async function startSession(token: string) {
  return request<{
    session_id: string
    participant_id: string
    condition: string
    task_order?: string
    is_test?: boolean
    current_phase?: string
    cooking_definitions?: CookingDefinitions
  }>('/session/start', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export async function getCookingDefinitions(sessionId: string) {
  return request<CookingDefinitions>(`/session/${sessionId}/cooking-definitions`)
}

export async function getExperimentConfig(sessionId: string, phase?: string) {
  const query = phase ? `?phase=${encodeURIComponent(phase)}` : ''
  return request<ExperimentConfig>(`/session/${sessionId}/experiment-config${query}`)
}

export async function getPublicExperimentConfig(phase = 'WELCOME') {
  return request<ExperimentConfig>(`/experiment-config?phase=${encodeURIComponent(phase)}`)
}

export async function getSessionStatus(sessionId: string) {
  return request<{
    status: string
    phase: string | null
  }>(`/session/${sessionId}/status`)
}

export async function postMouseTrackingBatch(
  sessionId: string,
  records: Array<Record<string, unknown>>,
  options?: { keepalive?: boolean },
) {
  return fetch(`${API_BASE}/mouse-tracking`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, records }),
    keepalive: options?.keepalive,
  })
}

export async function getBlockEncoding(sessionId: string) {
  return request<BlockEncoding>(`/session/${sessionId}/encoding`)
}

export async function submitEncodingQuiz(
  sessionId: string,
  data: {
    trial_number: number
    question_type: string
    attempt_number: number
    selected_answer: string
    correct_answer: string
    is_correct: boolean
    response_time_ms: number
  },
) {
  return request<{ status: string }>(
    `/session/${sessionId}/encoding/quiz`,
    { method: 'POST', body: JSON.stringify(data) },
  )
}

export async function submitDebrief(sessionId: string, data: {
  demographic: Record<string, unknown>
  preference: Record<string, unknown>
  open_responses: Record<string, unknown>
  manipulation_check?: Record<string, unknown>
}) {
  return request<{ status: string }>(`/session/${sessionId}/debrief`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ── Phase tracking ──

export async function updatePhase(sessionId: string, phaseName: string, eventType: 'start' | 'end') {
  return request<{ status: string }>(`/session/${sessionId}/phase`, {
    method: 'POST',
    body: JSON.stringify({ phase_name: phaseName, event_type: eventType }),
  })
}

export async function advancePhase(sessionId: string, nextPhase?: string) {
  return request<{ previous_phase: string; current_phase: string }>(`/session/${sessionId}/phase/advance`, {
    method: 'POST',
    body: JSON.stringify({ next_phase: nextPhase ?? null }),
  })
}

export async function submitExperimentResponses(sessionId: string, responses: ExperimentResponseInput[]) {
  return request<{ status: string; count: number }>(`/session/${sessionId}/responses`, {
    method: 'POST',
    body: JSON.stringify({ responses }),
  })
}

export async function submitManipulationCheck(
  sessionId: string,
  data: {
    phase: string
    task_id: string
    selected_option_id: string
    response_time_ms?: number
  },
) {
  return request<{
    status: string
    task_id: string
    selected_option_id: string
    correct: boolean
    exclusion_flag: boolean
  }>(`/session/${sessionId}/responses/manip-check`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ── Encoding events ──

export interface CutsceneEventData {
  task_id: string
  segment_index: number
  placeholder?: string
  viewed_at?: number
  duration_ms?: number
  detail_check_selected?: number
  detail_check_correct?: boolean
  detail_check_correct_index?: number
}

export async function logCutsceneEvent(sessionId: string, data: CutsceneEventData) {
  return request<{ status: string }>(`/session/${sessionId}/cutscene-event`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export interface IntentionCheckData {
  task_id: string
  selected_index: number
  correct_index: number
  is_correct: boolean
  response_time_ms: number
  task_position: number
}

export async function logIntentionCheck(sessionId: string, data: IntentionCheckData) {
  return request<{ status: string }>(`/session/${sessionId}/intention-check`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ── Session state (for reconnect restore) ──

export async function getSessionState(sessionId: string) {
  return request<Record<string, unknown>>(`/session/${sessionId}/state`)
}

// ── Quiz endpoints ──

export async function submitQuiz(sessionId: string, answers: Array<{
  trial_number: number
  question_type: string
  selected_answer: string
  response_time_ms?: number
}>) {
  return request<{
    results: Array<{
      trial_number: number
      question_type: string
      is_correct: boolean
      correct_answer: string
      attempt_number: number
    }>
    all_correct: boolean
    failed_trials: number[]
  }>(`/session/${sessionId}/quiz`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  })
}

// ── Admin endpoints ──

export async function createParticipant(data?: { condition?: string; order?: string }) {
  return request<{
    participant_id: string
    group: string
    token: string
    session_id: string
    task_order?: string
    entry_url?: string
  }>('/admin/participant/create', {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  })
}

export async function listParticipants() {
  return request<Array<{
    session_id: string
    participant_id: string
    condition: string
    status: string
    token: string
    is_online: boolean
    created_at: string | null
  }>>('/admin/participants')
}

export async function getExperimentOverview() {
  return request<{
    total_participants: number
    completed: number
    in_progress: number
  }>('/admin/experiment/overview')
}

export async function getAssignmentCounts() {
  return request<Record<string, Record<string, number>>>('/admin/assignment-counts')
}

export async function getLiveSessions() {
  return request<Array<{
    session_id: string
    participant_id: string
    condition: string
    task_order: string
    current_phase: string
    elapsed_s: number
    disconnected_at: number | null
  }>>('/admin/live-sessions')
}

export async function exportPerParticipant(includeTest = false): Promise<Blob> {
  const res = await fetch(`${API_BASE}/admin/export/per-participant?include_test=${includeTest}`)
  if (!res.ok) throw new Error(`Export failed: ${res.status}`)
  return res.blob()
}

export async function exportAggregated(includeTest = false): Promise<Blob> {
  const res = await fetch(`${API_BASE}/admin/export/aggregated?include_test=${includeTest}`)
  if (!res.ok) throw new Error(`Export failed: ${res.status}`)
  return res.blob()
}

export async function exportFull(includeTest = false): Promise<Blob> {
  const res = await fetch(`${API_BASE}/admin/export/full?include_test=${includeTest}`)
  if (!res.ok) throw new Error(`Export failed: ${res.status}`)
  return res.blob()
}

export async function createTestSession(data: { condition: string; order: string; start_phase: string }) {
  return request<{
    session_id: string
    participant_id: string
    token: string
    entry_url: string
  }>('/admin/test-session', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
