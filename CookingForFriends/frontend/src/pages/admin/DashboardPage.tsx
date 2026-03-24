/** Minimal admin dashboard — participant list, create, live status. */

import { useState, useEffect, useCallback } from 'react'
import { createParticipant, listParticipants, getExperimentOverview } from '../../services/api'

interface ParticipantRow {
  session_id: string
  participant_id: string
  group: string
  condition_order: string[]
  status: string
  current_block: number | null
  token: string
  is_online: boolean
  created_at: string | null
}

export default function AdminDashboard() {
  const [participants, setParticipants] = useState<ParticipantRow[]>([])
  const [overview, setOverview] = useState<{ total_participants: number; completed: number; in_progress: number } | null>(null)
  const [creating, setCreating] = useState(false)
  const [lastCreated, setLastCreated] = useState<{ participant_id: string; token: string } | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [p, o] = await Promise.all([listParticipants(), getExperimentOverview()])
      setParticipants(p)
      setOverview(o)
    } catch (err) {
      console.error('Failed to load admin data:', err)
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [refresh])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const result = await createParticipant()
      setLastCreated({ participant_id: result.participant_id, token: result.token })
      refresh()
    } catch (err) {
      console.error('Failed to create participant:', err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">🍳 Cooking for Friends — Admin</h1>
            <p className="text-sm text-slate-500">Experiment Management Dashboard</p>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-6 py-2 bg-cooking-500 hover:bg-cooking-600 disabled:bg-cooking-200
                       text-white font-medium rounded-xl transition-colors"
          >
            {creating ? 'Creating...' : '+ New Participant'}
          </button>
        </div>

        {/* Token display */}
        {lastCreated && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div>
              <p className="text-green-800 font-medium">
                Created: {lastCreated.participant_id}
              </p>
              <p className="text-green-600 text-sm">
                Give this token to the participant
              </p>
            </div>
            <div className="text-3xl font-mono font-bold text-green-700 tracking-widest">
              {lastCreated.token}
            </div>
          </div>
        )}

        {/* Overview cards */}
        {overview && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <StatCard label="Total" value={overview.total_participants} />
            <StatCard label="In Progress" value={overview.in_progress} color="text-blue-600" />
            <StatCard label="Completed" value={overview.completed} color="text-green-600" />
          </div>
        )}

        {/* Participant table */}
        <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-medium text-slate-600">ID</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Token</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Group</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Conditions</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Block</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Online</th>
              </tr>
            </thead>
            <tbody>
              {participants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    No participants yet. Click "+ New Participant" to create one.
                  </td>
                </tr>
              ) : (
                participants.map((p) => (
                  <tr key={p.session_id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{p.participant_id}</td>
                    <td className="px-4 py-3 font-mono tracking-wider text-cooking-600">{p.token}</td>
                    <td className="px-4 py-3">{p.group}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {p.condition_order.map((c, i) => (
                          <span
                            key={i}
                            className={`text-xs px-1.5 py-0.5 rounded ${
                              c === 'CONTROL' ? 'bg-slate-100 text-slate-600' :
                              c === 'AF' ? 'bg-blue-100 text-blue-700' :
                              'bg-purple-100 text-purple-700'
                            }`}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        p.status === 'completed' ? 'bg-green-100 text-green-700' :
                        p.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                        p.status === 'dropped' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{p.current_block || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`w-2.5 h-2.5 rounded-full inline-block ${
                        p.is_online ? 'bg-green-400' : 'bg-slate-300'
                      }`} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color = 'text-slate-800' }: {
  label: string; value: number; color?: string
}) {
  return (
    <div className="bg-white rounded-xl shadow border border-slate-200 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
