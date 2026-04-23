/** API service — all HTTP calls to backend. */

import type { BlockEncoding } from '../types'

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
  }>('/session/start', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export async function getSessionStatus(sessionId: string) {
  return request<{
    status: string
    phase: string | null
  }>(`/session/${sessionId}/status`)
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

export async function createParticipant() {
  return request<{
    participant_id: string
    group: string
    token: string
    session_id: string
  }>('/admin/participant/create', { method: 'POST' })
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
