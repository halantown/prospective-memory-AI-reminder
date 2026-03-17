const BASE = '/api'

export async function apiPost(path, body = {}) {
  const url = `${BASE}${path}`
  const payload = { ...body, client_ts: Date.now() }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json()
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

export async function createSession(token) {
  return apiPost('/session/start', { token })
}

export async function sendHeartbeat(sessionId) {
  return apiPost(`/session/${sessionId}/heartbeat`, {})
}

export async function resumeSession(sessionId) {
  return apiGet(`/session/${sessionId}/resume`)
}

export async function fetchBlockConfig(sessionId, blockNumber) {
  return apiGet(`/session/${sessionId}/block/${blockNumber}`)
}

export async function reportEncoding(sessionId, blockNum, quizAttempts) {
  return apiPost(`/session/${sessionId}/block/${blockNum}/encoding`, {
    quiz_attempts: quizAttempts,
  })
}

export async function reportPmAction(sessionId, blockNum, payload) {
  return apiPost(`/session/${sessionId}/block/${blockNum}/action`, payload)
}

export async function reportQuestionnaire(sessionId, payload) {
  return apiPost(`/session/${sessionId}/questionnaire`, payload)
}

export async function reportOngoing(sessionId, blockNum, deltaPayload) {
  return apiPost(`/session/${sessionId}/block/${blockNum}/ongoing`, deltaPayload)
}

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
