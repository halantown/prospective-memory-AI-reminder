/**
 * Shared API helper for backend communication.
 */

const BASE = '/api'

export async function apiPost(path, body = {}) {
  const url = `${BASE}${path}`
  const payload = { ...body, client_ts: Date.now() }
  console.log(`[API] POST ${url}`, payload)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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
 * Start an experiment session by presenting the 6-char token.
 * Returns { session_id, participant_id, group, condition_order }
 */
export async function createSession(token) {
  return apiPost('/session/start', { token })
}

/**
 * Send a heartbeat to keep the session alive.
 * Should be called every 10s while in the block phase.
 */
export async function sendHeartbeat(sessionId) {
  return apiPost(`/session/${sessionId}/heartbeat`, {})
}

/**
 * Fetch session state for recovery after page refresh.
 */
export async function resumeSession(sessionId) {
  return apiGet(`/session/${sessionId}/resume`)
}

/**
 * Report a steak action (flip/serve/clean) to the backend.
 */
export async function reportSteakAction(sessionId, blockNum, hobId, action) {
  return apiPost(`/session/${sessionId}/block/${blockNum}/steak-action`, {
    hob_id: hobId,
    action,
  })
}

/**
 * Report encoding quiz confirmation.
 */
export async function reportEncoding(sessionId, blockNum, quizAttempts) {
  return apiPost(`/session/${sessionId}/block/${blockNum}/encoding`, {
    quiz_attempts: quizAttempts,
  })
}

/**
 * Report a PM task action.
 */
export async function reportPmAction(sessionId, blockNum, taskId, actionData) {
  return apiPost(`/session/${sessionId}/block/${blockNum}/action`, {
    task_id: taskId,
    ...actionData,
  })
}

/**
 * Fetch game config (stripped of correct answers) from backend.
 */
export async function fetchGameConfig() {
  try {
    const res = await fetch(`${BASE}/config/game`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.warn('[API] Failed to fetch game config:', err.message)
    return null
  }
}
