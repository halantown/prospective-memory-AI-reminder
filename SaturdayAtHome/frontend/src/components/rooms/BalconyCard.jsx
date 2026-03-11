import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { Droplets, Shirt } from 'lucide-react'

export default function BalconyCard({ isExpanded }) {
  const machine = useGameStore((s) => s.machine)
  const handleMachineAction = useGameStore((s) => s.handleMachineAction)
  const washTime = useGameStore((s) => s.washTime)

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-6 relative">
      <div className={`flex items-center gap-3 text-sky-800 ${isExpanded ? 'absolute top-6 left-6' : 'mb-4'}`}>
        <Droplets size={isExpanded ? 28 : 20} />
        <h2 className={`${isExpanded ? 'text-2xl' : 'text-lg'} font-black tracking-wider`}>Balcony</h2>
      </div>

      {/* Washing machine (top-down view) */}
      <motion.div layout className={`bg-white rounded-[20px] border-[5px] border-slate-200 shadow-md flex flex-col items-center relative transition-all ${
        isExpanded ? 'w-48 h-56 p-3 mt-6' : 'w-28 h-32 p-2'
      }`}>
        {/* Control panel */}
        <div className={`w-full bg-slate-800 rounded-lg flex justify-between items-center px-3 ${
          isExpanded ? 'h-7 mb-3' : 'h-4 mb-2'
        }`}>
          <div className="flex gap-1.5 ml-auto">
            <div className={`rounded-full bg-red-500 ${isExpanded ? 'w-2 h-2' : 'w-1.5 h-1.5'}`} />
            <div className={`rounded-full ${machine.status === 'washing' ? 'bg-green-400 animate-pulse' : 'bg-slate-600'} ${
              isExpanded ? 'w-2 h-2' : 'w-1.5 h-1.5'
            }`} />
          </div>
        </div>

        {/* Drum */}
        <div className={`rounded-full border-slate-300 bg-sky-50 flex items-center justify-center overflow-hidden relative shadow-inner ${
          isExpanded ? 'w-32 h-32 border-[6px]' : 'w-18 h-18 border-4'
        }`}>
          {machine.status === 'washing' && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
              className="w-full h-full bg-blue-200/50 flex items-center justify-center"
            >
              <Shirt size={isExpanded ? 56 : 28} className="text-blue-500/60" />
            </motion.div>
          )}
          {machine.status === 'done' && (
            <Shirt size={isExpanded ? 64 : 32} className="text-blue-500 drop-shadow-md z-20" />
          )}
        </div>
      </motion.div>

      {/* Progress bar + button */}
      <motion.div layout className={`flex flex-col items-center w-full ${
        isExpanded ? 'mt-6 max-w-xs' : 'mt-4 max-w-[140px]'
      }`}>
        <div className="w-full h-2.5 bg-sky-200/60 rounded-full overflow-hidden shadow-inner mb-3">
          <div
            className="h-full bg-blue-500 transition-all duration-1000 ease-linear"
            style={{ width: `${(machine.progress / washTime) * 100}%` }}
          />
        </div>
        {isExpanded && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={(e) => { e.stopPropagation(); handleMachineAction() }}
            disabled={machine.status === 'washing'}
            className={`w-full py-3 rounded-xl font-bold text-base text-white shadow-lg transition-colors ${
              machine.status === 'empty' ? 'bg-blue-500 hover:bg-blue-600' :
              machine.status === 'washing' ? 'bg-slate-400' :
              'bg-green-500 hover:bg-green-600 animate-pulse'
            }`}
          >
            {machine.status === 'empty' ? 'Load laundry' :
             machine.status === 'washing' ? 'Washing...' :
             'Collect laundry'}
          </motion.button>
        )}
      </motion.div>
    </div>
  )
}
