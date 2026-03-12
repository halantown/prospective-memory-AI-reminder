import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { useHobProgress } from '../../hooks/useHobProgress'
import { Flame, AlertCircle } from 'lucide-react'
import MedicineCabinet from '../tasks/MedicineCabinet'

const steakColor = {
  empty: 'bg-gray-300',
  cooking: 'bg-pink-400',
  ready: 'bg-amber-400',
  burning: 'bg-zinc-900',
}

export default function KitchenCard({ isExpanded }) {
  const hobs = useGameStore((s) => s.hobs)
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

      {/* Stove area — top section */}
      <div className={`flex items-center justify-center ${isExpanded ? 'gap-10 mt-14' : 'gap-3 w-full'}`}>
        {hobs.map((hob, idx) => {
          const progress = progresses[idx] ?? 0
          return (
            <div key={hob.id} className="flex flex-col items-center">
              {/* Pan */}
              <div
                className={`rounded-full bg-zinc-800 border-zinc-900 flex items-center justify-center relative shadow-[0_8px_12px_rgba(0,0,0,0.3)] ${
                  isExpanded ? 'w-28 h-28 border-[6px]' : 'w-14 h-14 border-4'
                }`}
              >
                <div
                  className={`absolute top-1/2 left-[90%] bg-zinc-900 -translate-y-1/2 rounded-r-full shadow-md origin-left rotate-12 ${
                    isExpanded ? 'w-14 h-4' : 'w-7 h-2'
                  }`}
                />
                {hob.status !== 'empty' && (
                  <div
                    className={`rounded-[35%] shadow-inner transition-colors duration-500 ${
                      isExpanded ? 'w-16 h-14' : 'w-8 h-7'
                    } ${steakColor[hob.status]}`}
                  />
                )}
                {hob.status === 'ready' && (
                  <div
                    className={`absolute -top-2 -right-2 bg-amber-400 rounded-full animate-bounce shadow-md flex items-center justify-center ${
                      isExpanded ? 'w-7 h-7' : 'w-4 h-4'
                    }`}
                  >
                    <AlertCircle size={isExpanded ? 18 : 10} className="text-amber-800" />
                  </div>
                )}
                {hob.status === 'burning' && (
                  <div
                    className={`absolute -top-2 -right-2 bg-red-600 rounded-full flex items-center justify-center shadow-md ${
                      isExpanded ? 'w-7 h-7' : 'w-4 h-4'
                    }`}
                  >
                    <Flame size={isExpanded ? 18 : 10} className="text-orange-300 animate-pulse" />
                  </div>
                )}
              </div>

              {/* Progress bar + actions */}
              <div className={`w-full ${isExpanded ? 'mt-6' : 'mt-3'}`}>
                <div
                  className={`bg-orange-200/60 rounded-full overflow-hidden shadow-inner ${
                    isExpanded ? 'h-2.5 mb-3' : 'h-1.5'
                  }`}
                >
                  {hob.status === 'cooking' && (
                    <div className="h-full rounded-full bg-pink-500" style={{ width: `${progress * 100}%` }} />
                  )}
                  {hob.status === 'ready' && (
                    <div className="h-full rounded-full bg-amber-400 animate-pulse" style={{ width: `${(1 - progress) * 100}%` }} />
                  )}
                  {hob.status === 'burning' && (
                    <div className="h-full rounded-full bg-zinc-800 w-full" />
                  )}
                </div>

                {isExpanded && hob.status === 'ready' && (
                  <div className="flex gap-2">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => { e.stopPropagation(); flipSteak(hob.id) }}
                      className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-amber-500 hover:bg-amber-600 shadow-lg"
                    >
                      Flip +5
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => { e.stopPropagation(); serveSteak(hob.id) }}
                      className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-green-500 hover:bg-green-600 shadow-lg"
                    >
                      Serve +5
                    </motion.button>
                  </div>
                )}

                {isExpanded && hob.status === 'burning' && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => { e.stopPropagation(); cleanSteak(hob.id) }}
                    className="w-full py-2.5 rounded-xl font-bold text-sm text-white bg-zinc-600 hover:bg-zinc-700 shadow-lg"
                  >
                    Clean
                  </motion.button>
                )}

                {isExpanded && hob.status === 'cooking' && (
                  <div className="w-full py-2.5 rounded-xl font-bold text-sm text-center text-gray-400 bg-gray-100">
                    Cooking…
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Kitchen table with medicine cabinet — bottom section */}
      {isExpanded ? (
        <div className="relative w-full mt-6">
          {/* Table surface */}
          <div className="relative bg-amber-800/20 border-2 border-amber-700/30 rounded-2xl px-6 py-4 shadow-inner">
            {/* Table wood grain texture hint */}
            <div className="absolute inset-0 rounded-2xl opacity-[0.04] pointer-events-none"
              style={{ background: 'repeating-linear-gradient(90deg, #000 0px, transparent 1px, transparent 12px)' }}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-800/50 uppercase tracking-widest select-none">
                Kitchen Table
              </span>
              <MedicineCabinet isExpanded={true} />
            </div>
          </div>
          {/* Table legs */}
          <div className="flex justify-between px-4 -mt-px">
            <div className="w-3 h-4 bg-amber-900/30 rounded-b" />
            <div className="w-3 h-4 bg-amber-900/30 rounded-b" />
          </div>
        </div>
      ) : (
        /* Compact view: small table hint with medicine icon */
        <div className="w-full mt-2 flex items-center justify-end">
          <MedicineCabinet isExpanded={false} />
        </div>
      )}
    </div>
  )
}
