import { useState, useEffect, useCallback } from 'react'

const API = import.meta.env.VITE_API_URL || '/api'

/* ── Editable JSON textarea ─────────────────────────────── */
function JsonEditor({ label, value, onChange, rows = 8 }) {
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
    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      <textarea
        className={`w-full font-mono text-xs p-2 border rounded ${error ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
        rows={rows}
        value={text}
        onChange={handleChange}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

/* ── Number/text inline editor ──────────────────────────── */
function Field({ label, value, onChange, type = 'number' }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <label className="text-sm text-gray-700 w-48 shrink-0">{label}</label>
      <input
        type={type}
        className="border rounded px-2 py-1 text-sm w-32"
        value={value ?? ''}
        onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
      />
    </div>
  )
}

/* ── Tab button ─────────────────────────────────────────── */
function Tab({ active, label, onClick }) {
  return (
    <button
      className={`px-4 py-2 text-sm font-medium rounded-t border-b-2 transition ${
        active ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

/* ── Section renderers ──────────────────────────────────── */

function DifficultySection({ config, setConfig }) {
  const diff = config.difficulty || {}
  const update = (preset, key, val) => {
    setConfig({
      ...config,
      difficulty: { ...diff, [preset]: { ...diff[preset], [key]: val } },
    })
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 mb-2">
        Default preset: <strong>{diff.default || 'medium'}</strong>
        <button className="ml-2 text-blue-600 text-xs" onClick={() => setConfig({
          ...config, difficulty: { ...diff, default: diff.default === 'medium' ? 'fast' : diff.default === 'fast' ? 'slow' : 'medium' },
        })}>[cycle]</button>
      </p>
      {['slow', 'medium', 'fast'].map((preset) => (
        <div key={preset} className="bg-gray-50 p-3 rounded border">
          <h4 className="font-semibold text-sm mb-2 capitalize">{preset}</h4>
          <Field label="Cooking (ms)" value={diff[preset]?.cooking_ms} onChange={(v) => update(preset, 'cooking_ms', v)} />
          <Field label="Ready (ms)" value={diff[preset]?.ready_ms} onChange={(v) => update(preset, 'ready_ms', v)} />
          <Field label="Max Steaks" value={diff[preset]?.max_steaks} onChange={(v) => update(preset, 'max_steaks', v)} />
        </div>
      ))}
    </div>
  )
}

function ScoringSection({ config, setConfig }) {
  const sc = config.scoring || {}
  const update = (key, val) => setConfig({ ...config, scoring: { ...sc, [key]: val } })
  return (
    <div className="space-y-2">
      <Field label="Steak Flip / Serve" value={sc.steak_flip} onChange={(v) => update('steak_flip', v)} />
      <Field label="Steak Serve" value={sc.steak_serve} onChange={(v) => update('steak_serve', v)} />
      <Field label="Steak Burn Penalty" value={sc.steak_burn} onChange={(v) => update('steak_burn', v)} />
      <Field label="Message Correct" value={sc.message_correct} onChange={(v) => update('message_correct', v)} />
      <Field label="Message Wrong" value={sc.message_wrong} onChange={(v) => update('message_wrong', v)} />
      <Field label="Message Expire" value={sc.message_expire} onChange={(v) => update('message_expire', v)} />
      <Field label="Plant Water (fresh)" value={sc.plant_water_fresh} onChange={(v) => update('plant_water_fresh', v)} />
      <Field label="Plant Water (wilted)" value={sc.plant_water_wilted} onChange={(v) => update('plant_water_wilted', v)} />
    </div>
  )
}

function TimersSection({ config, setConfig }) {
  const tm = config.timers || {}
  const update = (key, val) => setConfig({ ...config, timers: { ...tm, [key]: val } })
  return (
    <div className="space-y-2">
      <Field label="Block Duration (ms)" value={tm.block_duration_ms} onChange={(v) => update('block_duration_ms', v)} />
      <Field label="Message Timeout (ms)" value={tm.message_timeout_ms} onChange={(v) => update('message_timeout_ms', v)} />
      <Field label="PM Window (ms)" value={tm.pm_window_ms} onChange={(v) => update('pm_window_ms', v)} />
      <Field label="Plant Wilt Delay (ms)" value={tm.plant_wilt_delay_ms} onChange={(v) => update('plant_wilt_delay_ms', v)} />
      <Field label="Respawn Min (ms)" value={tm.steak_respawn_min_ms} onChange={(v) => update('steak_respawn_min_ms', v)} />
      <Field label="Respawn Max (ms)" value={tm.steak_respawn_max_ms} onChange={(v) => update('steak_respawn_max_ms', v)} />
    </div>
  )
}

function TimelineSection({ config, setConfig }) {
  return (
    <JsonEditor
      label="Timeline (events, steak_spawn, messages, plant_water, neutral_comments)"
      value={config.timeline || {}}
      onChange={(val) => setConfig({ ...config, timeline: val })}
      rows={20}
    />
  )
}

function ExperimentSection({ config, setConfig }) {
  return (
    <div className="space-y-4">
      <JsonEditor
        label="Latin Square"
        value={config.experiment?.latin_square || {}}
        onChange={(val) => setConfig({
          ...config,
          experiment: { ...config.experiment, latin_square: val },
        })}
        rows={8}
      />
      <JsonEditor
        label="Task Pairs"
        value={config.experiment?.task_pairs || {}}
        onChange={(val) => setConfig({
          ...config,
          experiment: { ...config.experiment, task_pairs: val },
        })}
        rows={8}
      />
      <JsonEditor
        label="Reminder Texts"
        value={config.experiment?.reminder_texts || {}}
        onChange={(val) => setConfig({
          ...config,
          experiment: { ...config.experiment, reminder_texts: val },
        })}
        rows={8}
      />
    </div>
  )
}

function PmTasksSection({ config, setConfig }) {
  return (
    <JsonEditor
      label="PM Tasks (including correct answers — admin only)"
      value={config.pm_tasks || {}}
      onChange={(val) => setConfig({ ...config, pm_tasks: val })}
      rows={24}
    />
  )
}

function TriggerIconsSection({ config, setConfig }) {
  return (
    <JsonEditor
      label="Trigger Icons"
      value={config.trigger_icons || {}}
      onChange={(val) => setConfig({ ...config, trigger_icons: val })}
      rows={12}
    />
  )
}

function AudioSection({ config, setConfig }) {
  const au = config.audio || {}
  const update = (key, val) => setConfig({ ...config, audio: { ...au, [key]: val } })
  return (
    <div className="space-y-2">
      <Field label="BGM Normal Volume" value={au.bgm_normal} onChange={(v) => update('bgm_normal', v)} type="number" />
      <Field label="BGM Ducked Volume" value={au.bgm_ducked} onChange={(v) => update('bgm_ducked', v)} type="number" />
      <Field label="BGM Fade In (ms)" value={au.bgm_fade_in_ms} onChange={(v) => update('bgm_fade_in_ms', v)} />
      <Field label="Duck Fade Down (ms)" value={au.duck_fade_down_ms} onChange={(v) => update('duck_fade_down_ms', v)} />
      <Field label="Duck Fade Up (ms)" value={au.duck_fade_up_ms} onChange={(v) => update('duck_fade_up_ms', v)} />
      <Field label="TTS Language" value={au.tts_lang} onChange={(v) => update('tts_lang', v)} type="text" />
      <Field label="TTS Rate" value={au.tts_rate} onChange={(v) => update('tts_rate', v)} type="number" />
    </div>
  )
}

/* ── Main ConfigPage ────────────────────────────────────── */
const TABS = [
  { key: 'difficulty', label: 'Difficulty', Component: DifficultySection },
  { key: 'scoring', label: 'Scoring', Component: ScoringSection },
  { key: 'timers', label: 'Timers', Component: TimersSection },
  { key: 'timeline', label: 'Timeline', Component: TimelineSection },
  { key: 'experiment', label: 'Experiment', Component: ExperimentSection },
  { key: 'pm_tasks', label: 'PM Tasks', Component: PmTasksSection },
  { key: 'triggers', label: 'Triggers', Component: TriggerIconsSection },
  { key: 'audio', label: 'Audio', Component: AudioSection },
]

export default function ConfigPage() {
  const [config, setConfig] = useState(null)
  const [tab, setTab] = useState('difficulty')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API}/config`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setConfig(data)
      setStatus(null)
    } catch (err) {
      setStatus({ type: 'error', text: `Failed to load config: ${err.message}` })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  const saveConfig = async () => {
    try {
      setSaving(true)
      const res = await fetch(`${API}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setStatus({ type: 'success', text: 'Config saved ✓' })
      setTimeout(() => setStatus(null), 3000)
    } catch (err) {
      setStatus({ type: 'error', text: `Save failed: ${err.message}` })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">Loading config…</div>
  if (!config) return <div className="flex items-center justify-center h-screen text-red-500">Failed to load config</div>

  const ActiveTab = TABS.find((t) => t.key === tab)

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">⚙️ Game Configuration</h1>
          <p className="text-sm text-gray-500">Edit game_config.yaml via web UI</p>
        </div>
        <div className="flex items-center gap-3">
          {status && (
            <span className={`text-sm ${status.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
              {status.text}
            </span>
          )}
          <button
            className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded"
            onClick={fetchConfig}
          >
            Reload
          </button>
          <button
            className={`px-4 py-2 text-sm text-white rounded ${saving ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
            onClick={saveConfig}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Config'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-6 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <Tab key={t.key} label={t.label} active={tab === t.key} onClick={() => setTab(t.key)} />
        ))}
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6">
        {ActiveTab && <ActiveTab.Component config={config} setConfig={setConfig} />}
      </div>
    </div>
  )
}
