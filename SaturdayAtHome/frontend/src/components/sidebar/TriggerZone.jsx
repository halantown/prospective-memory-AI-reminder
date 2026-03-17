import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'

export default function TriggerZone() {
  const triggers = useGameStore(s => s.triggers)
  const clickTrigger = useGameStore(s => s.clickTrigger)

  return (
    <div className="flex-1">
      <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-2 px-1">
        Household Events
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {triggers.map(trigger => (
          <TriggerIcon key={trigger.id} trigger={trigger} onClick={() => clickTrigger(trigger.id)} />
        ))}
      </div>
    </div>
  )
}

function TriggerIcon({ trigger, onClick }) {
  const { state, emoji, label } = trigger
  const isFired = state === 'fired'
  const isAmbient = state === 'ambient'
  const isInactive = state === 'inactive'

  return (
    <motion.button
      onClick={isFired ? onClick : undefined}
      disabled={!isFired}
      className={`
        relative flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-colors
        ${isFired
          ? 'border-amber-500 bg-amber-500/20 cursor-pointer hover:bg-amber-500/30 shadow-lg shadow-amber-500/20'
          : isAmbient
            ? 'border-blue-500/40 bg-blue-500/10 cursor-default'
            : 'border-slate-700 bg-slate-800/60 cursor-default opacity-40'
        }
      `}
      animate={
        isFired
          ? { scale: [1, 1.04, 1] }
          : isAmbient
            ? { opacity: [0.5, 1, 0.5] }
            : {}
      }
      transition={
        isFired
          ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
          : isAmbient
            ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
            : {}
      }
    >
      <span className="text-xl leading-none">{emoji}</span>
      <span className={`text-[10px] mt-1 text-center leading-tight ${
        isInactive ? 'text-slate-500' : isFired ? 'text-amber-300 font-semibold' : 'text-blue-400'
      }`}>
        {label}
      </span>

      {isFired && (
        <motion.div
          className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )}
    </motion.button>
  )
}
