import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { Sofa, Tv, Flower2 } from 'lucide-react'

export default function LivingCard({ isExpanded }) {
  const plantNeedsWater = useGameStore((s) => s.plantNeedsWater)
  const plantWilted = useGameStore((s) => s.plantWilted)
  const waterPlant = useGameStore((s) => s.waterPlant)

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-6 relative">
      <div className={`flex items-center gap-3 text-amber-800 ${isExpanded ? 'absolute top-6 left-6' : 'mb-4'}`}>
        <Sofa size={isExpanded ? 28 : 20} />
        <h2 className={`${isExpanded ? 'text-2xl' : 'text-lg'} font-black tracking-wider`}>Living Room</h2>
      </div>

      <motion.div layout className={`flex flex-col items-center ${isExpanded ? 'mt-10' : ''}`}>
        {/* TV */}
        <div className={`bg-zinc-900 rounded-xl border-zinc-800 flex items-center justify-center relative shadow-lg ${
          isExpanded ? 'w-72 h-44 border-[5px] p-2' : 'w-36 h-22 border-3 p-1'
        }`}>
          <div className="w-full h-full bg-zinc-800 rounded-lg flex flex-col items-center justify-center overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 to-purple-900/30 animate-pulse" />
            <Tv size={isExpanded ? 40 : 20} className="text-white/20 mb-1 z-10" />
            {isExpanded && <p className="text-zinc-500 z-10 text-lg tracking-widest">No signal</p>}
          </div>
        </div>

        {/* Sofa */}
        <div className={`bg-amber-700/80 rounded-t-[24px] border-t-amber-800/50 flex justify-center ${
          isExpanded ? 'w-80 h-16 mt-10 border-t-[6px]' : 'w-40 h-8 mt-5 border-t-4'
        }`}>
          {isExpanded && <span className="text-amber-900/40 font-bold mt-3">Cozy sofa area</span>}
        </div>
      </motion.div>

      {/* Plant — needs attention indicator */}
      {isExpanded && (
        <div className="absolute bottom-8 right-8">
          <motion.button
            onClick={(e) => { e.stopPropagation(); if (plantNeedsWater) waterPlant() }}
            disabled={!plantNeedsWater}
            whileTap={plantNeedsWater ? { scale: 0.9 } : {}}
            className={`flex flex-col items-center gap-1 p-4 rounded-2xl border-2 transition-all ${
              plantWilted
                ? 'border-red-400 bg-red-50 shadow-lg animate-pulse cursor-pointer'
                : plantNeedsWater
                ? 'border-orange-400 bg-orange-50 shadow-lg cursor-pointer hover:shadow-xl'
                : 'border-green-200 bg-green-50/50 cursor-default'
            }`}
          >
            <Flower2 size={32} className={
              plantWilted ? 'text-red-400' : plantNeedsWater ? 'text-orange-500' : 'text-green-400'
            } />
            <span className={`text-xs font-bold ${
              plantWilted ? 'text-red-600' : plantNeedsWater ? 'text-orange-600' : 'text-green-600'
            }`}>
              {plantWilted ? '🥀 Wilting!' : plantNeedsWater ? '💧 Needs water' : '🌱 Happy'}
            </span>
          </motion.button>
        </div>
      )}

      {/* Mini plant indicator in overview */}
      {!isExpanded && plantNeedsWater && (
        <div className={`absolute bottom-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs ${
          plantWilted ? 'bg-red-500 animate-ping' : 'bg-orange-400 animate-pulse'
        }`}>
          🌿
        </div>
      )}
    </div>
  )
}
