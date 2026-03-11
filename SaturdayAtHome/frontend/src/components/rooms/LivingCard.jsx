import { motion } from 'framer-motion'
import { Sofa, Tv } from 'lucide-react'

export default function LivingCard({ isExpanded }) {
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

      {isExpanded && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.95 }}
          className="mt-8 px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg transition-colors"
        >
          Watch TV
        </motion.button>
      )}
    </div>
  )
}
