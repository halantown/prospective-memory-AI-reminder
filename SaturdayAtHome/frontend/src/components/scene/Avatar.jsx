import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { ROOMS } from './sceneConstants'

export default function Avatar() {
  const currentRoom = useGameStore(s => s.currentRoom)
  const room = ROOMS[currentRoom] || ROOMS.study

  const targetX = room.x + (room.workSpot?.x || room.w / 2) - 16
  const targetY = room.y + (room.workSpot?.y || room.h / 2) - 16

  return (
    <motion.div
      className="absolute z-[25] flex flex-col items-center pointer-events-none select-none"
      animate={{ left: targetX, top: targetY }}
      transition={{ duration: 2.5, ease: 'easeInOut' }}
    >
      <motion.span
        className="text-3xl leading-none drop-shadow-md"
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        🧑
      </motion.span>
      <span className="text-[8px] text-stone-600 font-semibold bg-white/70 px-1 rounded mt-0.5">You</span>
    </motion.div>
  )
}
