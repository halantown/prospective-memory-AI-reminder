/** Kitchen room — multi-dish cooking with enhanced ecological validity.
 *
 * Enhancements over plain text MC:
 * ① Station-specific active icons (contextual, animated per station type)
 * ② SVG progress ring on wait-step hotspots
 * ③ Wait-step peek popup (click wait station to see progress + colour morph)
 * ④ Popup top scene animation strip per station type
 * ⑤ Option text emoji enrichment
 * ⑥ Fridge ingredient icon grid
 * ⑦ Temperature dial selector for pure-°C options
 * ⑧ Visual plate selector for plating_area
 * ⑨ Cutting board two-phase (kinesthetic prep → MC choose)
 * ⑩ Spice rack herb cards
 * ⑪ Wait-station colour state animation (raw→cooked interpolation)
 * ⑫ Correct-answer celebration burst (800 ms before popup closes)
 */

import { useCallback, useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../../stores/gameStore'
import { useCharacterStore } from '../../../stores/characterStore'
import PMTargetItems from '../PMTargetItems'
import type { KitchenStationId, ActiveCookingStep, CookingStepOption, CookingWaitStep } from '../../../types'

// ── Station metadata ──────────────────────────────────────────────────────────

type StationMeta = {
  label: string
  emoji: string
  activeEmoji: string
  waitEmoji: string
  activeAnimation: 'pulse' | 'shake' | 'bounce'
}

const STATION_INFO: Record<KitchenStationId, StationMeta> = {
  fridge:        { label: 'Fridge',        emoji: '🧊', activeEmoji: '❄️', waitEmoji: '🧊', activeAnimation: 'pulse'  },
  cutting_board: { label: 'Cutting Board', emoji: '🔪', activeEmoji: '🔪', waitEmoji: '🔪', activeAnimation: 'shake'  },
  spice_rack:    { label: 'Spice Rack',    emoji: '🧂', activeEmoji: '🧂', waitEmoji: '🧂', activeAnimation: 'bounce' },
  burner1:       { label: 'Stove',         emoji: '🍳', activeEmoji: '🔥', waitEmoji: '♨️', activeAnimation: 'pulse'  },
  burner2:       { label: 'Burner 2',      emoji: '🔥', activeEmoji: '🔥', waitEmoji: '♨️', activeAnimation: 'pulse'  },
  burner3:       { label: 'Burner 3',      emoji: '🔥', activeEmoji: '🔥', waitEmoji: '♨️', activeAnimation: 'pulse'  },
  oven:          { label: 'Oven',          emoji: '♨️', activeEmoji: '🌡️', waitEmoji: '♨️', activeAnimation: 'pulse'  },
  plating_area:  { label: 'Plating Area',  emoji: '🍽️', activeEmoji: '✨', waitEmoji: '🍽️', activeAnimation: 'bounce' },
}

const HIDDEN_STATIONS = new Set<KitchenStationId>(['burner2', 'burner3'])

function stationMatches(clicked: KitchenStationId, active: KitchenStationId) {
  if (clicked === 'burner1') return active === 'burner1' || active === 'burner2' || active === 'burner3'
  return clicked === active
}

function cookingStepKey(step: ActiveCookingStep) {
  return `${step.dishId}:${step.stepIndex}`
}

const STATION_POSITIONS: Record<KitchenStationId, { left: string; top: string; width: string; height: string }> = {
  burner1:       { left: '29.1%', top: '12.25%', width: '12%',   height: '16.5%' },
  burner2:       { left: '31%',   top: '15%',    width: '0%',    height: '0%'    },
  burner3:       { left: '31%',   top: '15%',    width: '0%',    height: '0%'    },
  cutting_board: { left: '54.2%', top: '15.5%',  width: '15.1%', height: '9%'    },
  spice_rack:    { left: '77.3%', top: '13%',    width: '8%',    height: '12%'   },
  fridge:        { left: '84.4%', top: '5%',     width: '9%',    height: '28%'   },
  oven:          { left: '13.1%', top: '24%',    width: '12%',   height: '12%'   },
  plating_area:  { left: '51.5%', top: '51%',    width: '14.2%', height: '19%'   },
}

type FeedbackType = 'correct' | 'wrong' | 'missed' | null

const DEBUG_COORDS = false

// ── Utility functions ─────────────────────────────────────────────────────────

/** True only when every option is a bare temperature like "200°C". */
function isTemperatureOptions(options: CookingStepOption[]): boolean {
  return options.length > 0 && options.every(o => /^\d{2,3}°C$/.test(o.text.trim()))
}

/** Prepend the first matching context emoji to option text (⑤). */
const KEYWORD_EMOJI: [RegExp, string][] = [
  [/bell pepper/i, '🫑'], [/zucchini/i, '🥒'],   [/\btomato/i, '🍅'],
  [/\bonion/i, '🧅'],     [/garlic/i, '🧄'],      [/mushroom/i, '🍄'],
  [/carrot/i, '🥕'],      [/broccoli/i, '🥦'],    [/\bpotato/i, '🥔'],
  [/asparagus/i, '🌱'],   [/\bcorn\b/i, '🌽'],    [/eggplant/i, '🍆'],
  [/celery/i, '🥬'],      [/\bleek\b/i, '🌿'],    [/shallot/i, '🧅'],
  [/ginger/i, '🫚'],      [/ribeye/i, '🥩'],      [/sirloin/i, '🥩'],
  [/tenderloin/i, '🥩'],  [/\bsteak\b/i, '🥩'],  [/spaghetti/i, '🍝'],
  [/\bpasta\b/i, '🍝'],   [/pesto/i, '🌿'],       [/tomato sauce/i, '🍅'],
  [/cream sauce/i, '🥛'], [/vegetable stock/i, '🥗'], [/chicken stock/i, '🍗'],
  [/beef stock/i, '🍖'],  [/\bwater\b/i, '💧'],   [/olive oil/i, '🫒'],
  [/\bbutter\b/i, '🧈'],  [/sesame oil/i, '🌰'],  [/\bsalt\b/i, '🧂'],
  [/\bbasil\b/i, '🌿'],   [/oregano/i, '🌿'],     [/\bthyme\b/i, '🌿'],
  [/rosemary/i, '🌿'],    [/\bpepper\b/i, '🌶️'], [/paprika/i, '🌶️'],
  [/low.*heat/i, '🟡'],   [/medium.*heat/i, '🟠'],[/high.*heat/i, '🔴'],
  [/\bdice\b/i, '🎲'],    [/\bslice\b/i, '📏'],   [/\bchop\b/i, '🔪'],
  [/\bcut\b/i, '✂️'],     [/\bstir\b/i, '🥄'],    [/\bflip\b/i, '↩️'],
  [/\bdrain\b/i, '🚿'],   [/\btoss\b/i, '🥄'],    [/cast iron/i, '⬛'],
  [/non-stick/i, '⭕'],   [/stainless/i, '🔘'],   [/large pot/i, '🫕'],
  [/medium pot/i, '🫕'],
]

function enrichText(text: string): string {
  for (const [re, emoji] of KEYWORD_EMOJI) {
    if (re.test(text)) return `${emoji} ${text}`
  }
  return text
}

/** Extract up to 3 ingredient emojis from fridge option text (⑥). */
function extractFridgeEmoji(text: string): string {
  const checks: [RegExp, string][] = [
    [/bell pepper/i,'🫑'], [/zucchini/i,'🥒'],  [/\btomato/i,'🍅'],
    [/\bonion/i,'🧅'],     [/garlic/i,'🧄'],     [/mushroom/i,'🍄'],
    [/carrot/i,'🥕'],      [/broccoli/i,'🥦'],   [/\bpotato/i,'🥔'],
    [/asparagus/i,'🌱'],   [/\bcorn\b/i,'🌽'],   [/eggplant/i,'🍆'],
    [/celery/i,'🥬'],      [/\bleek\b/i,'🌿'],   [/shallot/i,'🧅'],
    [/ginger/i,'🫚'],      [/ribeye/i,'🥩'],     [/sirloin/i,'🥩'],
    [/tenderloin/i,'🥩'],  [/rump/i,'🥩'],
  ]
  const seen = new Set<string>()
  const out: string[] = []
  for (const [re, e] of checks) {
    if (re.test(text) && !seen.has(e)) { seen.add(e); out.push(e) }
    if (out.length >= 3) break
  }
  return out.join('') || '📦'
}

/** Single dominant spice/herb emoji for spice card (⑩). */
function getSpiceEmoji(text: string): string {
  if (/\bbasil\b/i.test(text))   return '🌿'
  if (/oregano/i.test(text))     return '🌿'
  if (/\bthyme\b/i.test(text))   return '🌿'
  if (/rosemary/i.test(text))    return '🌿'
  if (/pesto/i.test(text))       return '🌿'
  if (/\bpepper\b/i.test(text))  return '🌶️'
  if (/paprika/i.test(text))     return '🌶️'
  if (/\bsalt\b/i.test(text))    return '🧂'
  if (/olive oil/i.test(text))   return '🫒'
  if (/\bbutter\b/i.test(text))  return '🧈'
  if (/garlic/i.test(text))      return '🧄'
  if (/cream/i.test(text))       return '🥛'
  if (/sesame/i.test(text))      return '🌰'
  return '🫙'
}

/** Derive plate visual style from option text (⑧). */
function getPlateStyle(text: string): { bg: string; border: string; shape: string; textColor: string } {
  const low = text.toLowerCase()
  let bg = '#e2e8f0', border = '#94a3b8', textColor = '#1e293b'
  if (low.includes('red'))                              { bg = '#fecaca'; border = '#ef4444' }
  if (low.includes('yellow'))                           { bg = '#fef08a'; border = '#eab308' }
  if (low.includes('blue'))                             { bg = '#bfdbfe'; border = '#3b82f6' }
  if (low.includes('black'))                            { bg = '#1e293b'; border = '#475569'; textColor = '#f1f5f9' }
  if (low.includes('wooden') || low.includes('wood'))   { bg = '#d97706'; border = '#92400e'; textColor = '#fef3c7' }
  if (low.includes('grey') || low.includes('gray'))     { bg = '#cbd5e1'; border = '#94a3b8' }
  const shape = low.includes('oval')   ? 'rounded-[50%] px-6 py-2'
              : low.includes('square') ? 'rounded-none'
              : 'rounded-full'
  return { bg, border, shape, textColor }
}

/** Linear-interpolate between two RGBA colours (⑪). */
function lerpRGBA(a: [number, number, number, number], b: [number, number, number, number], t: number): string {
  const c = Math.max(0, Math.min(1, t))
  const r = Math.round(a[0] + (b[0] - a[0]) * c)
  const g = Math.round(a[1] + (b[1] - a[1]) * c)
  const bv = Math.round(a[2] + (b[2] - a[2]) * c)
  const av = +(a[3] + (b[3] - a[3]) * c).toFixed(2)
  return `rgba(${r},${g},${bv},${av})`
}

/** Background colour that transitions as food cooks during wait steps (⑪). */
function waitBgColor(station: KitchenStationId, progress: number): string {
  const isBurner = station === 'burner1' || station === 'burner2' || station === 'burner3'
  const isOven   = station === 'oven'
  if (isBurner) return lerpRGBA([251, 191, 36, 0.12], [239, 68, 68, 0.35], progress)
  if (isOven)   return lerpRGBA([251, 191, 36, 0.12], [154, 52, 18, 0.35], progress)
  return          lerpRGBA([251, 191, 36, 0.10], [251, 146, 60, 0.25], progress)
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** ② SVG circular progress ring rendered in the corner of a wait-step hotspot. */
function WaitProgressRing({ progress }: { progress: number }) {
  const r = 11
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.max(0, Math.min(1, progress)))
  return (
    <svg
      width={28} height={28}
      className="absolute top-0.5 right-0.5 -rotate-90 pointer-events-none z-10"
      aria-hidden
    >
      <circle cx={14} cy={14} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={3} />
      <circle
        cx={14} cy={14} r={r} fill="none"
        stroke="rgba(251,191,36,0.90)" strokeWidth={3}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
      />
    </svg>
  )
}


/** ⑥ Fridge: 2-column icon grid instead of text buttons. */
function FridgeGrid({ options, onSelect, pending }: {
  options: CookingStepOption[]
  onSelect: (o: CookingStepOption) => void
  pending: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-2 mt-2">
      {options.map(option => (
        <button
          key={option.id}
          disabled={pending}
          onClick={() => onSelect(option)}
          className="flex flex-col items-center gap-1 rounded-xl border border-slate-600/60
            bg-slate-700/50 hover:bg-slate-600/60 hover:border-amber-400/60
            active:scale-95 disabled:opacity-50 disabled:cursor-wait
            transition-all p-3 text-center"
        >
          <span className="text-2xl leading-none">{extractFridgeEmoji(option.text)}</span>
          <span className="text-xs text-slate-200 leading-snug">{option.text}</span>
        </button>
      ))}
    </div>
  )
}

/** ⑦ Temperature dial — only for options that are pure "XXX°C" strings. */
function TemperatureSelector({ options, onSelect, pending }: {
  options: CookingStepOption[]
  onSelect: (o: CookingStepOption) => void
  pending: boolean
}) {
  const temps = options.map(o => parseInt(o.text))
  const minT = Math.min(...temps)
  const maxT = Math.max(...temps)
  const tempColor = (t: number) => {
    const ratio = (t - minT) / Math.max(1, maxT - minT)
    return ratio < 0.5
      ? `hsl(${60 - ratio * 120}, 80%, 60%)`
      : `hsl(${60 - (ratio - 0.5) * 2 * 60}, 85%, 50%)`
  }
  return (
    <div className="mt-2">
      <p className="text-xs text-slate-400 mb-2 text-center">Select temperature</p>
      <div className="flex gap-2 justify-center flex-wrap">
        {options.map((option, i) => (
          <button
            key={option.id}
            disabled={pending}
            onClick={() => onSelect(option)}
            className="flex flex-col items-center rounded-xl border-2 border-slate-600 p-3 min-w-[60px]
              hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-wait transition-all"
            style={{ borderColor: tempColor(temps[i]) }}
          >
            <span className="text-xl font-black" style={{ color: tempColor(temps[i]) }}>
              {temps[i]}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">°C</span>
          </button>
        ))}
      </div>
      <div
        className="mt-3 h-2 rounded-full mx-2"
        style={{ background: 'linear-gradient(to right, #3b82f6, #fbbf24, #ef4444)' }}
      />
      <div className="flex justify-between text-[9px] text-slate-500 mx-2 mt-0.5">
        <span>cooler</span><span>hotter</span>
      </div>
    </div>
  )
}

/** ⑧ Visual plate/bowl selector for plating_area. */
function PlateSelector({ options, onSelect, pending }: {
  options: CookingStepOption[]
  onSelect: (o: CookingStepOption) => void
  pending: boolean
}) {
  return (
    <div className="flex flex-col gap-2 mt-2">
      {options.map(option => {
        const s = getPlateStyle(option.text)
        return (
          <button
            key={option.id}
            disabled={pending}
            onClick={() => onSelect(option)}
            className="flex items-center gap-3 p-3 rounded-xl border-2 transition-all
              hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-wait"
            style={{ borderColor: s.border, backgroundColor: s.bg + '22' }}
          >
            <div
              className={`w-9 h-9 flex-shrink-0 ${s.shape} border-2 flex items-center justify-center text-lg`}
              style={{ backgroundColor: s.bg, borderColor: s.border, color: s.textColor }}
            >
              🍽
            </div>
            <span className="text-sm text-slate-200 text-left">{option.text}</span>
          </button>
        )
      })}
    </div>
  )
}

/** ⑩ Spice rack: horizontal cards with dominant herb/spice emoji. */
function SpiceCards({ options, onSelect, pending }: {
  options: CookingStepOption[]
  onSelect: (o: CookingStepOption) => void
  pending: boolean
}) {
  return (
    <div className="flex flex-col gap-2 mt-2">
      {options.map(option => (
        <button
          key={option.id}
          disabled={pending}
          onClick={() => onSelect(option)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-600/60
            bg-slate-700/40 hover:bg-slate-600/50 hover:border-amber-400/50
            active:scale-95 disabled:opacity-50 disabled:cursor-wait transition-all text-left"
        >
          <span className="text-xl leading-none flex-shrink-0">{getSpiceEmoji(option.text)}</span>
          <span className="text-sm text-slate-200">{option.text}</span>
        </button>
      ))}
    </div>
  )
}

/** ③ Wait-step peek popup: shown when participant clicks a wait-station. */
function WaitPeekPopup({ waitStep, anchor, onClose }: {
  waitStep: CookingWaitStep
  anchor: { x: number; y: number } | null
  onClose: () => void
}) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const elapsed   = (now - waitStep.startedAt) / 1000
  const remaining = Math.max(0, waitStep.durationS - elapsed)
  const progress  = Math.min(1, elapsed / waitStep.durationS)
  const mins = Math.floor(remaining / 60)
  const secs = Math.floor(remaining % 60)
  const remainingLabel = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  const info = STATION_INFO[waitStep.station]
  const x = anchor?.x ?? 24
  const y = anchor?.y ?? 24

  return (
    <motion.div
      className="absolute inset-0 z-kitchen-fx pointer-events-none"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        className="absolute pointer-events-auto border-2 rounded-xl shadow-2xl p-4 min-w-[220px] max-w-[280px]"
        style={{
          left: `clamp(12px, ${x + 14}px, calc(100% - 296px))`,
          top:  `clamp(12px, ${y - 24}px, calc(100% - 260px))`,
          borderColor: 'rgba(251,191,36,0.7)',
          background:  'rgba(15,23,42,0.95)',
        }}
        initial={{ scale: 0.94, opacity: 0, y: 6 }}
        animate={{ scale: 1,    opacity: 1, y: 0 }}
        exit={{   scale: 0.94, opacity: 0, y: 6 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-700">
          <motion.span
            className="text-xl"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            {info.waitEmoji}
          </motion.span>
          <span className="text-sm font-semibold text-amber-300">{info.label}</span>
        </div>

        <p className="text-xs text-slate-400 mb-3">{waitStep.stepLabel}</p>

        {/* Colour-morphing progress bar */}
        <div className="rounded-full bg-slate-700 overflow-hidden h-2 mb-2">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${progress * 100}%`,
              backgroundColor: progress < 0.5 ? '#fbbf24' : progress < 0.8 ? '#f97316' : '#ef4444',
            }}
          />
        </div>

        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-500">{Math.round(progress * 100)}% done</span>
          {remaining > 0
            ? <span className="text-sm font-bold text-amber-300 tabular-nums">~{remainingLabel} left</span>
            : <span className="text-sm font-bold text-emerald-400">Almost done!</span>
          }
        </div>

        <button
          className="absolute top-2 right-2 text-slate-500 hover:text-slate-300 text-sm"
          onClick={onClose}
        >✕</button>
      </motion.div>
    </motion.div>
  )
}

/** ⑫ Correct-answer burst animation (shown inside popup for 800 ms). */
function CorrectCelebration({ dishEmoji }: { dishEmoji: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      {[0, 1, 2, 3, 4].map(i => (
        <motion.div
          key={i}
          className="absolute text-2xl"
          initial={{ opacity: 1, scale: 0.5, x: 0, y: 0 }}
          animate={{
            opacity: 0, scale: 1.5,
            x: Math.cos((i * 72 * Math.PI) / 180) * 50,
            y: Math.sin((i * 72 * Math.PI) / 180) * 50,
          }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: i * 0.04 }}
        >
          {i % 2 === 0 ? dishEmoji : '✨'}
        </motion.div>
      ))}
      <motion.div
        className="text-4xl"
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.4, 1] }}
        transition={{ duration: 0.4, times: [0, 0.6, 1] }}
      >
        ✅
      </motion.div>
    </div>
  )
}

// ── StationPopup ──────────────────────────────────────────────────────────────

function StationPopup({
  station, anchor, activeStep, pending, feedback, onOptionClick, onClose,
}: {
  station: KitchenStationId
  anchor: { x: number; y: number } | null
  activeStep: ActiveCookingStep | undefined
  pending: boolean
  feedback: 'correct' | 'wrong' | null
  onOptionClick: (step: ActiveCookingStep, option: CookingStepOption) => void
  onClose: () => void
}) {
  const info = STATION_INFO[station]
  const dishes = useGameStore((s) => s.dishes)
  const dishEmoji = activeStep ? (dishes[activeStep.dishId]?.emoji ?? '🍳') : '🍳'

  // ⑨ Cutting board two-phase state; resets on each new mount (keyed externally)
  const [chopPhase, setChopPhase] = useState<'prep' | 'choosing'>('prep')

  const x = anchor?.x ?? 24
  const y = anchor?.y ?? 24
  const borderColor = feedback === 'correct' ? '#6ee7b7'
    : feedback === 'wrong' ? '#fca5a5'
    : 'rgba(100,116,139,0.8)'

  function renderOptions(step: ActiveCookingStep) {
    const { options } = step
    const handleSelect = (o: CookingStepOption) => onOptionClick(step, o)

    if (station === 'plating_area')              return <PlateSelector options={options} onSelect={handleSelect} pending={pending} />
    if (station === 'fridge')                    return <FridgeGrid    options={options} onSelect={handleSelect} pending={pending} />
    if (station === 'spice_rack')                return <SpiceCards    options={options} onSelect={handleSelect} pending={pending} />
    if (isTemperatureOptions(options))           return <TemperatureSelector options={options} onSelect={handleSelect} pending={pending} />

    // ⑤ Default: enriched text buttons
    return (
      <div className="flex flex-col gap-2 mt-3">
        {options.map(option => (
          <button
            key={option.id}
            disabled={pending}
            onClick={() => handleSelect(option)}
            className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-700/50
              hover:bg-slate-600/60 border border-slate-600/50 hover:border-amber-400/50
              transition-colors text-left disabled:opacity-60 disabled:cursor-wait"
          >
            <span className="text-sm text-slate-100">{enrichText(option.text)}</span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <motion.div
      className="absolute inset-0 z-kitchen-fx pointer-events-none"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        className="absolute pointer-events-auto bg-slate-800 border-2 rounded-xl shadow-2xl p-4
          min-w-[220px] max-w-[300px] overflow-hidden"
        style={{
          left: `clamp(12px, ${x + 14}px, calc(100% - 316px))`,
          top:  `clamp(12px, ${y - 24}px, calc(100% - 340px))`,
          borderColor,
        }}
        initial={{ scale: 0.94, opacity: 0, y: 6 }}
        animate={{ scale: 1,    opacity: 1, y: 0 }}
        exit={{   scale: 0.94, opacity: 0, y: 6 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-700">
          <span className="text-lg">{info.emoji}</span>
          <span className="text-sm font-semibold text-slate-200">{info.label}</span>
        </div>

        {/* ⑫ Correct celebration overlay */}
        {feedback === 'correct' && <CorrectCelebration dishEmoji={dishEmoji} />}

        {activeStep ? (
          <>
            <p className="text-xs text-slate-300 font-medium mb-2">{activeStep.stepLabel}</p>

            {/* ④ Scene animation removed — too abstract for ecological validity */}

            {/* ⑨ Cutting board: kinesthetic prep phase */}
            {station === 'cutting_board' && chopPhase === 'prep' ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <motion.div
                  className="text-4xl"
                  animate={{ rotate: [-5, 5, -5], x: [-2, 2, -2] }}
                  transition={{ repeat: Infinity, duration: 0.5 }}
                >
                  🔪
                </motion.div>
                <p className="text-xs text-slate-400 text-center">Get ready to chop!</p>
                <button
                  onClick={() => setChopPhase('choosing')}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400
                    text-white font-bold text-sm transition-colors active:scale-95 shadow-lg"
                >
                  ✂️ Chop!
                </button>
              </div>
            ) : (
              renderOptions(activeStep)
            )}
          </>
        ) : (
          <p className="text-xs text-slate-500 italic py-2">Nothing to do here right now</p>
        )}

        <button
          className="absolute top-2 right-2 text-slate-500 hover:text-slate-300 text-sm"
          onClick={onClose}
        >✕</button>
      </motion.div>
    </motion.div>
  )
}

// ── KitchenRoom (main export) ─────────────────────────────────────────────────

export default function KitchenRoom({
  isActive,
  onStationOpen,
}: {
  isActive: boolean
  onStationOpen?: (point: { clientX: number; clientY: number }) => boolean
}) {
  const activeStation       = useGameStore((s) => s.activeStation)
  const setActiveStation    = useGameStore((s) => s.setActiveStation)
  const activeCookingSteps  = useGameStore((s) => s.activeCookingSteps)
  const cookingWaitSteps    = useGameStore((s) => s.cookingWaitSteps)
  const cookingStepFeedback = useGameStore((s) => s.cookingStepFeedback)
  const isCharMoving        = useCharacterStore((s) => s.isMoving)
  const moveToStation       = useCharacterStore((s) => s.moveToStation)

  const [feedback, setFeedback]   = useState<{ station: KitchenStationId; type: FeedbackType }>({ station: 'fridge', type: null })
  const [debugPos, setDebugPos]   = useState<{ x: number; y: number } | null>(null)

  // ② ⑪ Shared wall-clock tick for wait-step animations (500 ms resolution)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (cookingWaitSteps.length === 0) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [cookingWaitSteps.length])

  // Hotspot flash — driven by store feedback; store lifecycle owned by overlay
  useEffect(() => {
    if (!cookingStepFeedback) return
    const visibleStation = (cookingStepFeedback.station === 'burner2' || cookingStepFeedback.station === 'burner3')
      ? 'burner1' : cookingStepFeedback.station
    setFeedback({ station: visibleStation, type: cookingStepFeedback.result })
    const t = setTimeout(() => setFeedback(f => ({ ...f, type: null })), 300)
    return () => clearTimeout(t)
  }, [cookingStepFeedback])

  const handleDebugMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setDebugPos({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 })
  }, [])

  const handleStationClick = useCallback((station: KitchenStationId, event: React.MouseEvent<HTMLElement>) => {
    if (!isActive || isCharMoving) return
    if (activeStation === station) { setActiveStation(null); return }
    setActiveStation(null)
    const clickPoint = { clientX: event.clientX, clientY: event.clientY }
    moveToStation(station, () => {
      const state = useGameStore.getState()
      const hasActiveStep = state.activeCookingSteps.some(s => stationMatches(station, s.station))
      // ③ Also open station for wait steps
      const hasWaitStep   = state.cookingWaitSteps.some(w => stationMatches(station, w.station))
      if (hasActiveStep || hasWaitStep) {
        const canOpen = onStationOpen ? onStationOpen(clickPoint) : true
        if (canOpen) setActiveStation(station)
      }
    })
  }, [isActive, isCharMoving, activeStation, onStationOpen, setActiveStation, moveToStation])

  return (
    <div
      className="absolute inset-0"
      onMouseMove={DEBUG_COORDS ? handleDebugMouseMove : undefined}
      onMouseLeave={DEBUG_COORDS ? () => setDebugPos(null) : undefined}
    >
      {DEBUG_COORDS && debugPos && (
        <div className="absolute top-1 right-1 z-50 bg-black/80 text-green-400 font-mono text-[11px] px-2 py-1 rounded pointer-events-none select-none">
          left: {debugPos.x.toFixed(1)}% &nbsp; top: {debugPos.y.toFixed(1)}%
        </div>
      )}

      {(Object.entries(STATION_POSITIONS) as [KitchenStationId, typeof STATION_POSITIONS[KitchenStationId]][]).map(
        ([stationId, pos]) => {
          if (HIDDEN_STATIONS.has(stationId)) return null
          const info         = STATION_INFO[stationId]
          const hasActiveStep = activeCookingSteps.some(s => stationMatches(stationId, s.station))
          const waitStep      = cookingWaitSteps.find(w => stationMatches(stationId, w.station))
          const hasWaitStep   = Boolean(waitStep)
          const showFeedback  = feedback.station === stationId && feedback.type

          // ⑪ Wait colour progress (wall-clock, decorative only)
          const waitProgress = waitStep
            ? Math.min(1, (now - waitStep.startedAt) / (waitStep.durationS * 1000))
            : 0

          const hotspotBg = hasActiveStep
            ? 'rgba(251,146,60,0.20)'
            : hasWaitStep
              ? waitBgColor(stationId, waitProgress)
              : undefined

          return (
            <motion.button
              key={stationId}
              className={`group absolute z-10 rounded-lg border-2 transition-colors duration-200
                ${hasActiveStep  ? 'border-orange-300/80 shadow-[0_0_14px_rgba(251,146,60,0.35)]' : ''}
                ${hasWaitStep && !hasActiveStep ? 'border-amber-300/50 shadow-[0_0_10px_rgba(251,191,36,0.20)]' : ''}
                ${!hasActiveStep && !hasWaitStep ? 'bg-slate-950/5 border-white/10 hover:bg-white/10 hover:border-white/30' : ''}
                ${showFeedback === 'correct' ? '!border-emerald-300 !bg-emerald-400/30' : ''}
                ${showFeedback === 'wrong'   ? '!border-red-300   !bg-red-500/30'   : ''}
                ${isActive && !isCharMoving  ? 'cursor-pointer' : 'cursor-default pointer-events-none'}
              `}
              style={{ ...pos, backgroundColor: hotspotBg }}
              onClick={(event) => handleStationClick(stationId, event)}
            >
              {/* Station label */}
              <div className={`absolute bottom-0.5 left-1 text-[9px] font-semibold whitespace-nowrap drop-shadow transition-opacity ${
                hasActiveStep || hasWaitStep ? 'text-white opacity-95' : 'text-white/55 opacity-55 group-hover:opacity-90'
              }`}>
                {info.emoji} {info.label}
              </div>

              {/* ② Wait progress ring */}
              {hasWaitStep && !hasActiveStep && <WaitProgressRing progress={waitProgress} />}

              {/* ① Active-step icon (station-specific animation) */}
              {hasActiveStep && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center text-2xl pointer-events-none"
                  animate={
                    info.activeAnimation === 'shake'  ? { rotate: [-8, 8, -8], x: [-1, 1, -1] } :
                    info.activeAnimation === 'bounce' ? { y: [0, -5, 0], scale: [1, 1.1, 1] } :
                    /* pulse */                         { opacity: [0.45, 1, 0.45], y: [2, -3, 2] }
                  }
                  transition={{ repeat: Infinity, duration: 1.1 }}
                >
                  {info.activeEmoji}
                </motion.div>
              )}

              {/* ① Wait icon (gentle pulse) */}
              {hasWaitStep && !hasActiveStep && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center text-xl pointer-events-none"
                  animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 2.0 }}
                >
                  {info.waitEmoji}
                </motion.div>
              )}

              {/* Feedback flash icon */}
              <AnimatePresence>
                {showFeedback && (
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center text-2xl"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1.2, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {showFeedback === 'correct' && '✅'}
                    {showFeedback === 'wrong'   && '❌'}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          )
        }
      )}

      {/* PM furniture button */}
      <div className="absolute z-10" style={{ left: '3%', bottom: '22%' }}>
        <PMTargetItems room="kitchen" />
      </div>
    </div>
  )
}

// ── KitchenStationOverlay ─────────────────────────────────────────────────────

/** Full-game overlay for station popups. Rendered by FloorPlanView. */
export function KitchenStationOverlay({
  anchor,
}: {
  anchor: { x: number; y: number } | null
}) {
  const activeStation          = useGameStore((s) => s.activeStation)
  const setActiveStation       = useGameStore((s) => s.setActiveStation)
  const activeCookingSteps     = useGameStore((s) => s.activeCookingSteps)
  const cookingWaitSteps       = useGameStore((s) => s.cookingWaitSteps)
  const cookingStepFeedback    = useGameStore((s) => s.cookingStepFeedback)
  const clearCookingStepFeedback = useGameStore((s) => s.clearCookingStepFeedback)
  const wsSend                 = useGameStore((s) => s.wsSend)

  const [submittedStepKeys, setSubmittedStepKeys] = useState<Set<string>>(() => new Set())
  const [pendingStep, setPendingStep]             = useState<ActiveCookingStep | null>(null)

  // Prune submitted keys when steps are removed from the store
  useEffect(() => {
    setSubmittedStepKeys((prev) => {
      const activeKeys = new Set(activeCookingSteps.map(cookingStepKey))
      const next = new Set([...prev].filter(key => activeKeys.has(key)))
      return next.size === prev.size ? prev : next
    })
  }, [activeCookingSteps])

  // ⑫ Extended teardown: 800 ms so celebration animation plays fully
  useEffect(() => {
    if (!pendingStep || !cookingStepFeedback) return
    if (
      pendingStep.dishId    !== cookingStepFeedback.dishId ||
      pendingStep.stepIndex !== cookingStepFeedback.stepIndex
    ) return
    const timer = setTimeout(() => {
      setPendingStep(null)
      setActiveStation(null)
      clearCookingStepFeedback()
    }, 800)
    return () => clearTimeout(timer)
  }, [clearCookingStepFeedback, cookingStepFeedback, pendingStep, setActiveStation])

  const handleOptionClick = useCallback((step: ActiveCookingStep, option: CookingStepOption) => {
    if (!wsSend) return
    const key = cookingStepKey(step)
    if (submittedStepKeys.has(key)) return
    setPendingStep(step)
    setSubmittedStepKeys(prev => new Set(prev).add(key))
    wsSend({
      type: 'cooking_action',
      data: {
        dish: step.dishId,
        step_index: step.stepIndex,
        chosen_option_id: option.id,
        chosen_option_text: option.text,
        station: step.station,
        timestamp: Date.now() / 1000,
      },
    })
  }, [wsSend, submittedStepKeys])

  const activeStepForStation = useMemo(() => {
    if (!activeStation) return undefined
    return activeCookingSteps.find(s =>
      stationMatches(activeStation, s.station) && !submittedStepKeys.has(cookingStepKey(s))
    )
  }, [activeStation, activeCookingSteps, submittedStepKeys])

  // ③ Wait step for current station
  const waitStepForStation = useMemo(() => {
    if (!activeStation) return undefined
    return cookingWaitSteps.find(w => stationMatches(activeStation, w.station))
  }, [activeStation, cookingWaitSteps])

  // Scope pendingStep to the currently open station (rubber-duck fix)
  const scopedPendingStep = (pendingStep && activeStation && stationMatches(activeStation, pendingStep.station))
    ? pendingStep : undefined

  const popupStep    = activeStepForStation ?? scopedPendingStep
  const popupFeedback = (scopedPendingStep && cookingStepFeedback
    && scopedPendingStep.dishId    === cookingStepFeedback.dishId
    && scopedPendingStep.stepIndex === cookingStepFeedback.stepIndex)
    ? cookingStepFeedback.result
    : null

  // Stable key resets StationPopup state (e.g. chopPhase) on each new step
  const stepKey = popupStep
    ? cookingStepKey(popupStep)
    : waitStepForStation
      ? `wait-${waitStepForStation.dishId}-${waitStepForStation.stepIndex}`
      : 'empty'

  return (
    <AnimatePresence mode="wait">
      {activeStation && popupStep ? (
        <StationPopup
          key={`${activeStation}-${stepKey}`}
          station={activeStation}
          anchor={anchor}
          activeStep={popupStep}
          pending={Boolean(scopedPendingStep)}
          feedback={popupFeedback}
          onOptionClick={handleOptionClick}
          onClose={() => setActiveStation(null)}
        />
      ) : activeStation && !popupStep && waitStepForStation ? (
        <WaitPeekPopup
          key={`wait-${activeStation}-${waitStepForStation.stepIndex}`}
          waitStep={waitStepForStation}
          anchor={anchor}
          onClose={() => setActiveStation(null)}
        />
      ) : null}
    </AnimatePresence>
  )
}
