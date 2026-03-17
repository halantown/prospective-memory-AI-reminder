import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'

export default function SceneTrigger({ trigger, position, furnitureEmoji, label }) {
  const clickTrigger = useGameStore(s => s.clickTrigger)

  // If trigger data not found in store, render as static furniture
  if (!trigger) {
    return (
      <div
        className="absolute flex flex-col items-center select-none z-10"
        style={{ left: position.x - 20, top: position.y - 20 }}
      >
        <span className="text-2xl leading-none">{furnitureEmoji}</span>
        <span className="text-[8px] mt-0.5 whitespace-nowrap font-medium text-stone-400">{label}</span>
      </div>
    )
  }

  const isFired = trigger.state === 'fired'
  const isAmbient = trigger.state === 'ambient'

  return (
    <motion.button
      onClick={isFired ? () => clickTrigger(trigger.id) : undefined}
      disabled={!isFired}
      className={`absolute flex flex-col items-center z-10 select-none rounded-lg p-1 transition-colors ${
        isFired
          ? 'cursor-pointer bg-amber-400/30 ring-2 ring-amber-500 shadow-lg shadow-amber-400/40'
          : isAmbient
            ? 'cursor-default bg-blue-300/20'
            : 'cursor-default'
      }`}
      style={{ left: position.x - 20, top: position.y - 20 }}
      animate={
        isFired
          ? { scale: [1, 1.12, 1], y: [0, -3, 0] }
          : isAmbient
            ? { opacity: [0.6, 1, 0.6], rotate: [0, 2, -2, 0] }
            : {}
      }
      transition={
        isFired
          ? { duration: 1, repeat: Infinity, ease: 'easeInOut' }
          : isAmbient
            ? { duration: 2.5, repeat: Infinity, ease: 'easeInOut' }
            : {}
      }
    >
      <span className="text-2xl leading-none">{furnitureEmoji}</span>
      <span className={`text-[8px] mt-0.5 whitespace-nowrap font-medium ${
        isFired ? 'text-amber-700' : isAmbient ? 'text-blue-600' : 'text-stone-400'
      }`}>
        {label}
      </span>

      {/* Fired indicator dot */}
      {isFired && (
        <motion.div
          className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white"
          animate={{ scale: [1, 1.4, 1] }}
          transition={{ duration: 0.7, repeat: Infinity }}
        />
      )}
    </motion.button>
  )
}
