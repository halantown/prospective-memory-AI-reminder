/**
 * Shared API helper for backend communication.
 * All game HTTP requests go through this module.
 */

const BASE = '/api'

export async function apiPost(path, body = {}) {
  const url = `${BASE}${path}`
  console.log(`[API] POST ${url}`, body)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    console.error(`[API] ${res.status} ${url}: ${text}`)
    throw new Error(`API ${res.status}: ${text}`)
  }
  const data = await res.json()
  console.log(`[API] ← ${url}`, data)
  return data
}

export async function apiGet(path) {
  const url = `${BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json()
}

/**
 * Create a new experiment session.
 * Returns { session_id, participant_id, group, condition_order }
 */
export async function createSession(participantId) {
  return apiPost('/session/start', { participant_id: participantId })
}

/**
 * Report a steak action (flip/serve/clean) to the backend.
 * Returns { status, score, hob_status }
 */
export async function reportSteakAction(sessionId, blockNum, hobId, action) {
  return apiPost(`/session/${sessionId}/block/${blockNum}/steak-action`, {
    hob_id: hobId,
    action,
  })
}

/**
 * Report a PM task action.
 * Returns { status, score }
 */
export async function reportPmAction(sessionId, blockNum, taskId, actionData) {
  return apiPost(`/session/${sessionId}/block/${blockNum}/action`, {
    task_id: taskId,
    ...actionData,
  })
}
