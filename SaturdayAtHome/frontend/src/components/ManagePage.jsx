import { useState, useEffect, useCallback } from 'react'

const btn = 'px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-40'
const btnPrimary = `${btn} bg-cyan-600 hover:bg-cyan-700 text-white`
const btnSecondary = `${btn} bg-gray-700 hover:bg-gray-600 text-gray-200`
const btnRed = `${btn} bg-red-600 hover:bg-red-700 text-white`

function Panel({ title, children, className = '' }) {
  return (
    <div className={`bg-gray-800 rounded-lg p-4 border border-gray-700 ${className}`}>
      <h3 className="text-sm font-bold text-gray-300 mb-3">{title}</h3>
      {children}
    </div>
  )
}

export default function ManagePage() {
  const [sessions, setSessions] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [logs, setLogs] = useState([])
  const [exportData, setExportData] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }, [])

  const api = useCallback(async (path, opts = {}) => {
    try {
      const res = await fetch(`/api${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
      })
      if (!res.ok) {
        showToast(`Error ${res.status}`, 'error')
        return null
      }
      return await res.json()
    } catch {
      showToast('Network error', 'error')
      return null
    }
  }, [showToast])

  const refresh = useCallback(async () => {
    const d = await api('/admin/sessions')
    if (d) setSessions(d)
  }, [api])

  useEffect(() => { refresh() }, [refresh])

  const selectSession = async (sid) => {
    setSelectedId(sid)
    setExportData(null)
    const d = await api(`/admin/logs/${sid}`)
    if (d) setLogs(d)
  }

  const deleteSession = async (sid) => {
    if (!window.confirm(`Delete session ${sid}? This cannot be undone.`)) return
    const r = await api(`/admin/session/${sid}`, { method: 'DELETE' })
    if (r) {
      showToast(`Deleted ${sid}`, 'ok')
      if (selectedId === sid) { setSelectedId(null); setLogs([]) }
      refresh()
    }
  }

  const exportSession = async (sid) => {
    const d = await api(`/admin/export/${sid}`)
    if (d) {
      setExportData(d)
      showToast('Export ready', 'ok')
    }
  }

  const downloadJSON = () => {
    if (!exportData) return
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `session_${selectedId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const selected = sessions.find(s => s.session_id === selectedId)

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-mono text-sm">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded border text-xs ${
          toast.type === 'ok' ? 'bg-emerald-900 text-emerald-200 border-emerald-700' :
          toast.type === 'error' ? 'bg-red-900 text-red-200 border-red-700' :
          'bg-cyan-900 text-cyan-200 border-cyan-700'
        }`}>{toast.msg}</div>
      )}

      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center gap-4">
        <h1 className="text-lg font-bold text-cyan-400">🗄️ Data Management</h1>
        <span className="text-xs text-gray-500">{sessions.length} sessions</span>
        <div className="ml-auto flex gap-2">
          <a href="/" className="text-xs text-gray-500 hover:text-gray-300">Game</a>
          <a href="/dashboard" className="text-xs text-gray-500 hover:text-gray-300">Dashboard</a>
        </div>
      </div>

      <div className="p-4 grid grid-cols-12 gap-4">
        {/* Session list */}
        <div className="col-span-4">
          <Panel title="📋 Sessions">
            <button onClick={refresh} className={`${btnSecondary} mb-3`}>↻ Refresh</button>
            <div className="space-y-2 max-h-[75vh] overflow-y-auto">
              {sessions.map(s => (
                <div key={s.session_id}
                  onClick={() => selectSession(s.session_id)}
                  className={`p-3 rounded cursor-pointer border transition-colors ${
                    selectedId === s.session_id
                      ? 'bg-cyan-900/40 border-cyan-600'
                      : 'bg-gray-900/50 border-gray-700 hover:border-gray-600'
                  }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-cyan-300 text-xs">{s.session_id}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession(s.session_id) }}
                      className="text-red-500 hover:text-red-400 text-[10px]">✕ Delete</button>
                  </div>
                  <div className="text-xs text-gray-400">
                    <span>{s.participant_id}</span>
                    <span className="mx-1">·</span>
                    <span>Group {s.latin_square_group || s.group}</span>
                  </div>
                  <div className="text-[10px] text-gray-600 mt-0.5">
                    {s.created_at ? new Date(s.created_at).toLocaleString() : ''}
                  </div>
                </div>
              ))}
              {sessions.length === 0 && (
                <p className="text-gray-600 text-xs text-center py-4">No sessions found</p>
              )}
            </div>
          </Panel>
        </div>

        {/* Detail */}
        <div className="col-span-8">
          {selected ? (
            <div className="space-y-4">
              {/* Info + Export */}
              <Panel title={`📄 Session: ${selected.session_id}`}>
                <div className="grid grid-cols-3 gap-4 text-xs mb-3">
                  <div>
                    <div className="text-gray-500">Participant</div>
                    <div className="text-gray-200 font-bold">{selected.participant_id}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Group</div>
                    <div className="text-gray-200 font-bold">{selected.latin_square_group || selected.group}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Created</div>
                    <div className="text-gray-200">{selected.created_at ? new Date(selected.created_at).toLocaleString() : '-'}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => exportSession(selected.session_id)} className={btnPrimary}>📥 Export JSON</button>
                  {exportData && (
                    <button onClick={downloadJSON} className={btnSecondary}>💾 Download</button>
                  )}
                  <button onClick={() => deleteSession(selected.session_id)} className={btnRed}>🗑 Delete</button>
                </div>
                {exportData && (
                  <div className="mt-2 text-[10px] text-gray-500">
                    {exportData.actions?.length || 0} actions, {exportData.pm_trials?.length || 0} PM trials
                  </div>
                )}
              </Panel>

              {/* Action Logs */}
              <Panel title={`📊 Action Logs (${logs.length})`} className="max-h-[55vh] overflow-y-auto">
                {logs.length === 0 ? (
                  <p className="text-gray-600 text-xs">No logs</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-700">
                        <th className="text-left py-1 pr-2">Time</th>
                        <th className="text-left py-1 pr-2">Block</th>
                        <th className="text-left py-1 pr-2">Action</th>
                        <th className="text-left py-1">Payload</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((l, i) => (
                        <tr key={i} className="border-b border-gray-800/30 hover:bg-gray-800/50">
                          <td className="py-1 pr-2 text-gray-500">{new Date(l.ts * 1000).toLocaleTimeString()}</td>
                          <td className="py-1 pr-2 text-gray-400">{l.block_num || '-'}</td>
                          <td className="py-1 pr-2 text-cyan-400 font-bold">{l.action_type}</td>
                          <td className="py-1 text-gray-500 break-all">{l.payload ? l.payload.slice(0, 120) : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Panel>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[60vh] text-gray-600">
              <div className="text-center">
                <p className="text-lg mb-1">Select a session</p>
                <p className="text-xs">Click a session from the left to view its data</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
