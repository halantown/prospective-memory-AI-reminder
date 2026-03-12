import { motion } from 'framer-motion'
import { useGameStore, HOB_STATUS } from '../../store/gameStore'
import { useHobProgress } from '../../hooks/useHobProgress'
import { Flame, AlertCircle } from 'lucide-react'
import MedicineCabinet from '../tasks/MedicineCabinet'
import PressureCooker from '../tasks/PressureCooker'

const steakColor = {
  [HOB_STATUS.EMPTY]:         'bg-gray-300',
  [HOB_STATUS.COOKING_SIDE1]: 'bg-pink-400',
  [HOB_STATUS.READY_SIDE1]:   'bg-amber-400',
  [HOB_STATUS.COOKING_SIDE2]: 'bg-orange-400',
  [HOB_STATUS.READY_SIDE2]:   'bg-yellow-300',
  [HOB_STATUS.BURNING]:       'bg-zinc-900',
  [HOB_STATUS.ASH]:           'bg-gray-800',
}

const barStyle = {
  [HOB_STATUS.EMPTY]:         { color: 'bg-gray-400', anim: '' },
  [HOB_STATUS.COOKING_SIDE1]: { color: 'bg-pink-400', anim: '' },
  [HOB_STATUS.READY_SIDE1]:   { color: 'bg-amber-400', anim: 'animate-pulse' },
  [HOB_STATUS.COOKING_SIDE2]: { color: 'bg-orange-400', anim: '' },
  [HOB_STATUS.READY_SIDE2]:   { color: 'bg-yellow-300', anim: 'animate-pulse' },
  [HOB_STATUS.BURNING]:       { color: 'bg-red-600', anim: 'animate-[pulse_0.5s_ease-in-out_infinite]' },
  [HOB_STATUS.ASH]:           { color: 'bg-gray-800', anim: '' },
}

function sideLabel(status) {
  if (status === HOB_STATUS.COOKING_SIDE1 || status === HOB_STATUS.READY_SIDE1) return 'Side 1'
  if (status === HOB_STATUS.COOKING_SIDE2 || status === HOB_STATUS.READY_SIDE2) return 'Side 2'
  return null
}

export default function KitchenCard({ isExpanded }) {
  const hobs = useGameStore((s) => s.hobs)
  const pepperSteak = useGameStore((s) => s.pepperSteak)
  const flipSteak = useGameStore((s) => s.flipSteak)
  const serveSteak = useGameStore((s) => s.serveSteak)
  const cleanSteak = useGameStore((s) => s.cleanSteak)
  const progresses = useHobProgress()

  return (
    <div className="flex flex-col items-center justify-between w-full h-full p-6 relative">
      {/* Header */}
      <div className={`flex items-center gap-3 text-orange-800 ${isExpanded ? 'absolute top-6 left-6' : 'mb-3'}`}>
        <Flame size={isExpanded ? 28 : 20} />
        <h2 className={`${isExpanded ? 'text-2xl' : 'text-lg'} font-black tracking-wider`}>Kitchen</h2>
      </div>

      {/* Stove area — 2×2 grid */}
      <div className={`grid grid-cols-2 ${isExpanded ? 'gap-8 mt-14' : 'gap-3 w-full'}`}>
        {hobs.map((hob, idx) => {
          const progress = progresses[idx] ?? 0
          const side = sideLabel(hob.status)
          const isCooking = hob.status === HOB_STATUS.COOKING_SIDE1 || hob.status === HOB_STATUS.COOKING_SIDE2
          const isReady = hob.status === HOB_STATUS.READY_SIDE1 || hob.status === HOB_STATUS.READY_SIDE2
          const bar = barStyle[hob.status] || barStyle[HOB_STATUS.EMPTY]

          return (
            <div key={hob.id} className="flex flex-col items-center">
              {/* Pan */}
              <div className={`rounded-full bg-zinc-800 border-zinc-900 flex items-center justify-center relative shadow-[0_8px_12px_rgba(0,0,0,0.3)] ${
                isExpanded ? 'w-24 h-24 border-[5px]' : 'w-14 h-14 border-4'
              }`}>
                <div className={`absolute top-1/2 left-[90%] bg-zinc-900 -translate-y-1/2 rounded-r-full shadow-md origin-left rotate-12 ${
                  isExpanded ? 'w-12 h-3.5' : 'w-7 h-2'
                }`} />
                {hob.status !== HOB_STATUS.EMPTY && (
                  <div className={`rounded-[35%] shadow-inner transition-colors duration-500 ${
                    isExpanded ? 'w-14 h-12' : 'w-8 h-7'
                  } ${steakColor[hob.status] || 'bg-gray-300'}`} />
                )}
                {isReady && (
                  <div className={`absolute -top-2 -right-2 bg-amber-400 rounded-full animate-bounce shadow-md flex items-center justify-center ${
                    isExpanded ? 'w-7 h-7' : 'w-4 h-4'
                  }`}>
                    <AlertCircle size={isExpanded ? 18 : 10} className="text-amber-800" />
                  </div>
                )}
                {hob.status === HOB_STATUS.BURNING && (
                  <div className={`absolute -top-2 -right-2 bg-red-600 rounded-full flex items-center justify-center shadow-md ${
                    isExpanded ? 'w-7 h-7' : 'w-4 h-4'
                  }`}>
                    <Flame size={isExpanded ? 18 : 10} className="text-orange-300 animate-pulse" />
                  </div>
                )}
              </div>

              {/* Side indicator */}
              {side && isExpanded && (
                <span className="text-xs font-medium text-slate-500 mt-1">{side}</span>
              )}

              {/* Progress bar + actions */}
              <div className={`w-full ${isExpanded ? 'mt-3' : 'mt-3'}`}>
                {/* Main progress bar */}
                <div className={`bg-orange-200/60 rounded-full overflow-hidden shadow-inner ${
                  isExpanded ? 'h-2.5 mb-2' : 'h-1.5'
                }`}>
                  {isCooking && (
                    <div className={`h-full rounded-full ${bar.color}`} style={{ width: `${progress * 100}%` }} />
                  )}
                  {isReady && (
                    <div className={`h-full rounded-full ${bar.color} ${bar.anim}`} style={{ width: `${(1 - progress) * 100}%` }} />
                  )}
                  {hob.status === HOB_STATUS.BURNING && (
                    <div className={`h-full rounded-full w-full ${bar.color} ${bar.anim}`} />
                  )}
                  {hob.status === HOB_STATUS.ASH && (
                    <div className="h-full rounded-full bg-gray-800 w-full" />
                  )}
                </div>

                {/* Ash countdown bar (burning → ash progress, separate from main) */}
                {isExpanded && hob.status === HOB_STATUS.BURNING && (
                  <div className="h-1.5 rounded-full overflow-hidden shadow-inner mb-2"
                    style={{ background: 'linear-gradient(to right, #6b7280, #1f2937)' }}>
                    <div className="h-full rounded-full bg-gray-900 transition-all" style={{ width: `${progress * 100}%` }} />
                  </div>
                )}

                {/* COOKING_SIDE1: no interaction */}
                {isExpanded && hob.status === HOB_STATUS.COOKING_SIDE1 && (
                  <div className="w-full py-2.5 rounded-xl font-bold text-sm text-center text-gray-400 bg-gray-100">
                    Cooking side 1…
                  </div>
                )}

                {/* READY_SIDE1: pepper or flip */}
                {isExpanded && hob.status === HOB_STATUS.READY_SIDE1 && !hob.peppered && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => { e.stopPropagation(); pepperSteak(hob.id) }}
                    className="w-full py-2.5 rounded-xl font-bold text-sm text-white bg-amber-500 hover:bg-amber-600 shadow-lg"
                  >
                    🌶 Add Pepper +2
                  </motion.button>
                )}
                {isExpanded && hob.status === HOB_STATUS.READY_SIDE1 && hob.peppered && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => { e.stopPropagation(); flipSteak(hob.id) }}
                    className="w-full py-2.5 rounded-xl font-bold text-sm text-white bg-amber-500 hover:bg-amber-600 shadow-lg"
                  >
                    🔄 Flip
                  </motion.button>
                )}

                {/* COOKING_SIDE2: no interaction */}
                {isExpanded && hob.status === HOB_STATUS.COOKING_SIDE2 && (
                  <div className="w-full py-2.5 rounded-xl font-bold text-sm text-center text-gray-400 bg-gray-100">
                    Cooking side 2…
                  </div>
                )}

                {/* READY_SIDE2: pepper or serve */}
                {isExpanded && hob.status === HOB_STATUS.READY_SIDE2 && !hob.peppered && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => { e.stopPropagation(); pepperSteak(hob.id) }}
                    className="w-full py-2.5 rounded-xl font-bold text-sm text-yellow-900 bg-yellow-400 hover:bg-yellow-500 shadow-lg"
                  >
                    🌶 Add Pepper +2
                  </motion.button>
                )}
                {isExpanded && hob.status === HOB_STATUS.READY_SIDE2 && hob.peppered && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => { e.stopPropagation(); serveSteak(hob.id) }}
                    className="w-full py-2.5 rounded-xl font-bold text-sm text-white bg-green-500 hover:bg-green-600 shadow-lg"
                  >
                    🍽 Serve +5
                  </motion.button>
                )}

                {/* BURNING: clean button */}
                {isExpanded && hob.status === HOB_STATUS.BURNING && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => { e.stopPropagation(); cleanSteak(hob.id) }}
                    className="w-full py-2.5 rounded-xl font-bold text-sm text-white bg-red-600 hover:bg-red-700 shadow-lg"
                  >
                    🗑 Clean −10
                  </motion.button>
                )}

                {/* ASH: info only */}
                {isExpanded && hob.status === HOB_STATUS.ASH && (
                  <div className="w-full py-2.5 rounded-xl font-bold text-sm text-center text-gray-500 bg-gray-200">
                    Burned to ash!
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* 4th burner — pressure cooker PM task */}
        <PressureCooker isExpanded={isExpanded} />
      </div>

      {/* Kitchen table with medicine cabinet — bottom section */}
      <div className={`relative w-full ${isExpanded ? 'mt-6' : 'mt-auto'}`}>
        {/* Table surface */}
        <div className={`relative bg-amber-800/20 border-2 border-amber-700/30 shadow-inner flex items-center justify-between ${
          isExpanded ? 'rounded-2xl px-6 py-4' : 'rounded-lg px-3 py-1.5'
        }`}>
          {/* Wood grain texture */}
          <div className="absolute inset-0 rounded-[inherit] opacity-[0.04] pointer-events-none"
            style={{ background: 'repeating-linear-gradient(90deg, #000 0px, transparent 1px, transparent 12px)' }}
          />
          <span className={`font-semibold text-amber-800/50 uppercase tracking-widest select-none ${
            isExpanded ? 'text-xs' : 'text-[7px]'
          }`}>
            Kitchen Table
          </span>
          <MedicineCabinet isExpanded={isExpanded} />
        </div>
        {/* Table legs */}
        <div className={`flex justify-between -mt-px ${isExpanded ? 'px-4' : 'px-2'}`}>
          <div className={`bg-amber-900/30 rounded-b ${isExpanded ? 'w-3 h-4' : 'w-1.5 h-2'}`} />
          <div className={`bg-amber-900/30 rounded-b ${isExpanded ? 'w-3 h-4' : 'w-1.5 h-2'}`} />
        </div>
      </div>
    </div>
  )
}
