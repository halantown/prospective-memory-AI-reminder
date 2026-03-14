import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { Droplets } from 'lucide-react'

const GARMENT_COLORS = {
  red: '#ef4444', orange: '#f97316', yellow: '#eab308', blue: '#3b82f6',
  green: '#22c55e', purple: '#a855f7', white: '#f8fafc', gray: '#9ca3af',
}

const DETERGENTS = ['warm', 'cold', 'white']
const TEMPS = [30, 40, 60]

const STATUS_ICON = { washing: '🫧', jammed: '⚠️', done: '✅', idle: '📦', selecting: '👕' }
const LIGHT_THEME = {
  morning: {
    icon: 'text-sky-400',
    title: 'text-sky-800',
    collapsedText: 'text-slate-600',
    overlay: 'bg-gradient-to-b from-sky-100/90 via-white/20 to-transparent',
  },
  afternoon: {
    icon: 'text-amber-500',
    title: 'text-amber-900',
    collapsedText: 'text-slate-700',
    overlay: 'bg-gradient-to-b from-amber-200/80 via-orange-50/30 to-transparent',
  },
  evening: {
    icon: 'text-indigo-300',
    title: 'text-indigo-900',
    collapsedText: 'text-slate-700',
    overlay: 'bg-gradient-to-b from-indigo-200/75 via-purple-100/40 to-transparent',
  },
}

function JamCountdown({ deadline }) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (!deadline) return
    const interval = setInterval(() => {
      setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    }, 200)
    return () => clearInterval(interval)
  }, [deadline])
  return <span className="font-mono">{seconds}s to fix</span>
}

export default function BalconyCard({ isExpanded }) {
  const laundry = useGameStore((s) => s.laundry)
  const dayPhase = useGameStore((s) => s.dayPhase)
  const pickGarment = useGameStore((s) => s.pickGarment)
  const selectDetergent = useGameStore((s) => s.selectDetergent)
  const selectTemp = useGameStore((s) => s.selectTemp)
  const startWashing = useGameStore((s) => s.startWashing)
  const fixJam = useGameStore((s) => s.fixJam)
  const collectGarment = useGameStore((s) => s.collectGarment)

  const { pile, currentGarment, selectedDetergent, selectedTemp,
          washStatus, washProgress, washDuration, jamFixDeadline,
          completedCount, correctCount } = laundry || {}

  const remaining = washDuration > 0
    ? Math.max(0, Math.ceil((washDuration - washProgress) / 1000))
    : 0
  const progressPct = washDuration > 0 ? (washProgress / washDuration) * 100 : 0
  const lightTheme = LIGHT_THEME[dayPhase] || LIGHT_THEME.morning

  /* ── Collapsed (overview) mode ── */
  if (!isExpanded) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full p-4 gap-2 transition-colors duration-700">
        <Droplets size={28} className={lightTheme.icon} />
        <h3 className={`text-lg font-black tracking-wider ${lightTheme.title}`}>Balcony</h3>
        <div className={`flex items-center gap-2 text-sm font-medium ${lightTheme.collapsedText}`}>
          <span>📦 {pile?.length ?? 0}</span>
          <span>{STATUS_ICON[washStatus] || STATUS_ICON.idle}</span>
          <span className="text-xs text-slate-400">
            {completedCount ?? 0} done
          </span>
        </div>
      </div>
    )
  }

  /* ── Expanded mode ── */
  return (
    <div className="flex flex-col w-full h-full p-6 relative overflow-auto transition-colors duration-700">
      <div className={`absolute inset-0 pointer-events-none ${lightTheme.overlay}`} />

      {/* Header */}
      <div className={`relative z-10 flex items-center gap-3 mb-4 ${lightTheme.title}`}>
        <Droplets size={28} />
        <h2 className="text-2xl font-black tracking-wider">Balcony — Laundry Station</h2>
        <span className="ml-auto text-sm text-slate-500 font-medium">
          {correctCount ?? 0}/{completedCount ?? 0} correct
        </span>
      </div>

      {/* Top row: garment pile + washing machine status */}
      <div className="relative z-10 flex gap-6 mb-6">
        {/* Garment pile */}
        <div className="flex-1 bg-slate-50 rounded-2xl border border-slate-200 p-4 flex flex-col items-center gap-2">
          <span className="text-sm font-bold text-slate-600 uppercase tracking-wide">Garment Pile</span>
          <div className="flex flex-wrap gap-1.5 justify-center my-2">
            {(pile || []).slice(0, 12).map((g, i) => (
              <div key={i} className="w-5 h-5 rounded shadow-sm border border-slate-200"
                style={{ backgroundColor: GARMENT_COLORS[g.color] || '#94a3b8' }} />
            ))}
            {(pile?.length || 0) > 12 && (
              <span className="text-xs text-slate-400 self-center">+{pile.length - 12}</span>
            )}
          </div>
          <span className="text-base font-semibold text-slate-700">📦 {pile?.length ?? 0} items remaining</span>
          {washStatus === 'idle' && (
            <motion.button whileTap={{ scale: 0.95 }}
              onClick={(e) => { e.stopPropagation(); pickGarment() }}
              className="mt-1 px-5 py-2 rounded-xl font-bold text-sm text-white bg-blue-500 hover:bg-blue-600 shadow-lg">
              Pick Next
            </motion.button>
          )}
        </div>

        {/* Washing machine box */}
        <div className={`flex-1 rounded-2xl border-2 p-4 flex flex-col items-center gap-2 transition-colors ${
          washStatus === 'jammed' ? 'bg-red-50 border-red-300'
          : washStatus === 'done' ? 'bg-green-50 border-green-300'
          : 'bg-sky-50 border-sky-200'
        }`}>
          <span className="text-sm font-bold text-slate-600 uppercase tracking-wide">Washing Machine</span>

          {/* Machine icon */}
          <div className="w-20 h-20 rounded-full bg-white border-4 border-slate-300 flex items-center justify-center shadow-inner my-1">
            {washStatus === 'washing' && (
              <motion.span className="text-3xl"
                animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                🫧
              </motion.span>
            )}
            {washStatus === 'jammed' && (
              <motion.span className="text-3xl"
                animate={{ x: [-3, 3, -3, 3, 0] }} transition={{ repeat: Infinity, duration: 0.4 }}>
                ⚠️
              </motion.span>
            )}
            {washStatus === 'done' && <span className="text-3xl">✅</span>}
            {(washStatus === 'idle' || washStatus === 'selecting') && <span className="text-3xl">🧺</span>}
          </div>

          {/* Progress bar (washing) */}
          {washStatus === 'washing' && (
            <>
              <div className="w-full h-2.5 bg-sky-200 rounded-full overflow-hidden shadow-inner">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%`, background: 'linear-gradient(to right, #3b82f6, #60a5fa)' }} />
              </div>
              <span className="text-sm text-slate-600 font-medium">{remaining}s remaining</span>
            </>
          )}

          {/* Jammed state */}
          {washStatus === 'jammed' && (
            <>
              <motion.button whileTap={{ scale: 0.95 }}
                onClick={(e) => { e.stopPropagation(); fixJam() }}
                className="px-5 py-2 rounded-xl font-bold text-sm text-white bg-red-600 hover:bg-red-700 shadow-lg animate-pulse">
                ⚠️ JAMMED! Fix now!
              </motion.button>
              <span className="text-sm text-red-600 font-semibold">
                <JamCountdown deadline={jamFixDeadline} />
              </span>
            </>
          )}

          {/* Done state */}
          {washStatus === 'done' && (
            <>
              <motion.button whileTap={{ scale: 0.95 }}
                onClick={(e) => { e.stopPropagation(); collectGarment() }}
                className="px-5 py-2 rounded-xl font-bold text-sm text-white bg-green-500 hover:bg-green-600 shadow-lg">
                ✅ Done! Collect garment
              </motion.button>
              <span className={`text-sm font-semibold ${laundry.lastCorrect ? 'text-green-600' : 'text-red-500'}`}>
                {laundry.lastCorrect ? '✓ Correct wash!' : '✗ Wrong settings'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Current garment selection area */}
      {washStatus === 'selecting' && currentGarment && (
        <div className="relative z-10 bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wide">Current Garment</span>
          </div>

          {/* Color swatch + label */}
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-xl shadow-md border border-slate-200"
              style={{ backgroundColor: GARMENT_COLORS[currentGarment.color] || '#94a3b8' }} />
            <span className="text-lg font-bold text-slate-800">{currentGarment.label}</span>
          </div>

          {/* Detergent selector */}
          <div className="mb-4">
            <span className="text-xs font-bold text-slate-500 uppercase mb-2 block">Detergent</span>
            <div className="flex gap-2">
              {DETERGENTS.map((det) => (
                <button key={det}
                  onClick={(e) => { e.stopPropagation(); selectDetergent(det) }}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors border-2 ${
                    selectedDetergent === det
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}>
                  {det.charAt(0).toUpperCase() + det.slice(1)} Det.
                </button>
              ))}
            </div>
          </div>

          {/* Temperature selector */}
          <div className="mb-5">
            <span className="text-xs font-bold text-slate-500 uppercase mb-2 block">Temperature</span>
            <div className="flex gap-2">
              {TEMPS.map((temp) => (
                <button key={temp}
                  onClick={(e) => { e.stopPropagation(); selectTemp(temp) }}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors border-2 ${
                    selectedTemp === temp
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}>
                  {temp}°
                </button>
              ))}
            </div>
          </div>

          {/* Start washing */}
          <motion.button whileTap={{ scale: 0.95 }}
            onClick={(e) => { e.stopPropagation(); startWashing() }}
            disabled={!selectedDetergent || !selectedTemp}
            className={`w-full py-3 rounded-xl font-bold text-base text-white shadow-lg transition-colors ${
              selectedDetergent && selectedTemp
                ? 'bg-blue-500 hover:bg-blue-600'
                : 'bg-slate-300 cursor-not-allowed'
            }`}>
            Start Washing
          </motion.button>
        </div>
      )}
    </div>
  )
}
