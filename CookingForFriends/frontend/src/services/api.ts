/** API service — all HTTP calls to backend. */

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
    group: string
    condition_order: string[]
    current_block: number
  }>('/session/start', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export async function getSessionStatus(sessionId: string) {
  return request<{
    status: string
    current_block: number | null
    phase: string | null
  }>(`/session/${sessionId}/status`)
}

export async function getBlockEncoding(sessionId: string, blockNum: number) {
  return request<{
    block_number: number
    condition: string
    day_story: string
    pm_tasks: Array<{
      trial_number: number
      trigger_description: string
      target_room: string
      target_description: string
      target_image: string
      action_description: string
      visual_cues: Record<string, string | number>
    }>
  }>(`/session/${sessionId}/block/${blockNum}/encoding`)
}

export async function submitNasaTLX(sessionId: string, blockNum: number, data: {
  mental_demand: number
  effort: number
  frustration: number
}) {
  return request<{ status: string; next_block: number | null }>(
    `/session/${sessionId}/block/${blockNum}/nasa-tlx`,
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

export async function submitQuiz(sessionId: string, blockNum: number, answers: Array<{
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
  }>(`/session/${sessionId}/block/${blockNum}/quiz`, {
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
    group: string
    condition_order: string[]
    status: string
    current_block: number | null
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
    latin_square: Record<string, string[]>
  }>('/admin/experiment/overview')
}
