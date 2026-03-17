import { useCallback, useEffect, useState } from 'react'

const API = import.meta.env.VITE_API_URL || '/api'

function JsonEditor({ label, value, onChange, rows = 12 }) {
  const [text, setText] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    setText(JSON.stringify(value, null, 2))
    setError(null)
  }, [value])

  const handleChange = (e) => {
    const raw = e.target.value
    setText(raw)
    try {
      const parsed = JSON.parse(raw)
      setError(null)
      onChange(parsed)
    } catch {
      setError('Invalid JSON')
    }
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <textarea
        className={`w-full font-mono text-xs p-3 border rounded-xl ${error ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white'}`}
        rows={rows}
        value={text}
        onChange={handleChange}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

function Tab({ active, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 ${
        active ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
    </button>
  )
}

const TABS = [
  { key: 'timeline', label: 'Timeline' },
  { key: 'experiment', label: 'Experiment' },
  { key: 'rooms', label: 'Rooms' },
  { key: 'pm_tasks', label: 'PM Tasks' },
  { key: 'audio', label: 'Audio' },
]

export default function ConfigPage() {
  const [config, setConfig] = useState(null)
  const [tab, setTab] = useState('timeline')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API}/config`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setConfig(await res.json())
      setStatus(null)
    } catch (err) {
      setStatus({ type: 'error', text: `Failed to load config: ${err.message}` })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const saveConfig = async () => {
    if (!config) return
    try {
      setSaving(true)
      const res = await fetch(`${API}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setStatus({ type: 'success', text: 'Config saved' })
      setTimeout(() => setStatus(null), 2500)
    } catch (err) {
      setStatus({ type: 'error', text: `Save failed: ${err.message}` })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="h-screen flex items-center justify-center text-gray-500">Loading config…</div>
  if (!config) return <div className="h-screen flex items-center justify-center text-red-600">Unable to load config.</div>

  const setSection = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Config Editor (PRD v2.0)</h1>
          <p className="text-sm text-gray-500">Edits `SaturdayAtHome/game_config.yaml` directly.</p>
        </div>

        <div className="flex items-center gap-2">
          {status && (
            <span className={`text-sm ${status.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
              {status.text}
            </span>
          )}
          <button onClick={fetchConfig} className="px-3 py-2 text-sm rounded bg-slate-200 hover:bg-slate-300">Reload</button>
          <button
            onClick={saveConfig}
            disabled={saving}
            className={`px-3 py-2 text-sm rounded text-white ${saving ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="bg-white border-b px-6 flex gap-1">
        {TABS.map((t) => (
          <Tab key={t.key} label={t.label} active={tab === t.key} onClick={() => setTab(t.key)} />
        ))}
      </div>

      <div className="max-w-5xl mx-auto p-6">
        {tab === 'timeline' && (
          <JsonEditor label="timeline" value={config.timeline || {}} onChange={(v) => setSection('timeline', v)} rows={20} />
        )}
        {tab === 'experiment' && (
          <JsonEditor label="experiment" value={config.experiment || {}} onChange={(v) => setSection('experiment', v)} rows={20} />
        )}
        {tab === 'rooms' && (
          <JsonEditor label="rooms" value={config.rooms || {}} onChange={(v) => setSection('rooms', v)} rows={20} />
        )}
        {tab === 'pm_tasks' && (
          <JsonEditor label="pm_tasks (admin-only full schema)" value={config.pm_tasks || {}} onChange={(v) => setSection('pm_tasks', v)} rows={26} />
        )}
        {tab === 'audio' && (
          <JsonEditor label="audio" value={config.audio || {}} onChange={(v) => setSection('audio', v)} rows={10} />
        )}
      </div>
    </div>
  )
}
