import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { DoorOpen } from 'lucide-react'

export default function EntranceCard({ isExpanded }) {
  const score = useGameStore((s) => s.score)
  const hobs = useGameStore((s) => s.hobs)
  const steaksServed = hobs.filter((h) => h.status === 'empty').length

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-6 relative">
      <div className={`flex items-center gap-3 text-emerald-800 ${isExpanded ? 'absolute top-6 left-6' : 'mb-4'}`}>
        <DoorOpen size={isExpanded ? 28 : 20} />
        <h2 className={`${isExpanded ? 'text-2xl' : 'text-lg'} font-black tracking-wider`}>Entrance</h2>
      </div>

      <motion.div layout className={`flex items-center ${isExpanded ? 'gap-12 mt-10' : 'gap-4'}`}>
        {/* Door */}
        <div className={`bg-stone-700 rounded-t-lg border-stone-800 relative shadow-xl ${
          isExpanded ? 'w-36 h-56 border-[6px]' : 'w-18 h-28 border-4'
        }`}>
          <div className={`absolute top-1/2 right-2 bg-zinc-400 rounded-sm shadow-md ${
            isExpanded ? 'w-2.5 h-10' : 'w-1.5 h-5'
          }`} />
        </div>

        {/* Scoreboard */}
        <div className={`bg-[#2d3436] rounded-xl shadow-lg relative -rotate-3 ${
          isExpanded ? 'p-6 w-56' : 'p-3 w-32'
        }`}>
          <div className={`absolute left-1/2 -translate-x-1/2 bg-red-500 rounded shadow flex justify-center items-center ${
            isExpanded ? '-top-2.5 w-14 h-4' : '-top-2 w-8 h-3'
          }`} />
          <h3 className={`text-white font-serif text-center border-b border-gray-600 ${
            isExpanded ? 'text-xl mb-4 pb-2' : 'text-[10px] mb-2 pb-1'
          }`}>Score Board</h3>
          <div className={`text-emerald-300 font-mono flex flex-col ${
            isExpanded ? 'space-y-3 text-lg' : 'space-y-1.5 text-[9px]'
          }`}>
            <div className="flex justify-between items-center">
              <span>🍽️ Score</span>
              <span className="font-bold text-white">{score}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
