const API_BASE = '/api'

export async function startSession(token) {
  const res = await fetch(`${API_BASE}/session/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  if (!res.ok) throw new Error((await res.json()).detail || 'Failed to start session')
  return res.json()
}

export async function getBlockConfig(sessionId, blockNum) {
  const res = await fetch(`${API_BASE}/session/${sessionId}/block/${blockNum}`)
  if (!res.ok) throw new Error('Failed to get block config')
  return res.json()
}

export async function getGameItems(skin) {
  const res = await fetch(`${API_BASE}/game-items/${skin}`)
  if (!res.ok) throw new Error('Failed to get game items')
  return res.json()
}

export async function resumeSession(sessionId) {
  const res = await fetch(`${API_BASE}/session/${sessionId}/resume`)
  if (!res.ok) throw new Error('Failed to resume session')
  return res.json()
}
