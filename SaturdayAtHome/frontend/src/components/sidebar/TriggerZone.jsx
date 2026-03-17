import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'

export default function TriggerZone() {
  const triggers = useGameStore(s => s.triggers)
  const clickTrigger = useGameStore(s => s.clickTrigger)

  return (
    <div className="flex-1">
      <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-2 px-1">
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
          ? 'border-amber-400 bg-amber-50 cursor-pointer hover:bg-amber-100 shadow-md'
          : isAmbient
            ? 'border-blue-200 bg-blue-50/50 cursor-default'
            : 'border-slate-100 bg-slate-50 cursor-default opacity-50'
        }
      `}
      animate={
        isFired
          ? { scale: [1, 1.04, 1] }
          : isAmbient
            ? { opacity: [0.6, 1, 0.6] }
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
        isInactive ? 'text-slate-400' : isFired ? 'text-amber-700 font-semibold' : 'text-blue-500'
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
