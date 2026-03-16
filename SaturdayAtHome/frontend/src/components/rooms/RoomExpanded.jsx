import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { Home } from 'lucide-react'
import KitchenCard from './KitchenCard'
import BalconyCard from './BalconyCard'
import LivingCard from './LivingCard'
import EntranceCard from './EntranceCard'
import MessagesCard from './MessagesCard'

const roomComponents = {
  kitchen: KitchenCard,
  balcony: BalconyCard,
  living: LivingCard,
  entrance: EntranceCard,
  messages: MessagesCard,
}

const roomBg = {
  kitchen: 'bg-orange-50',
  balcony: 'bg-sky-50',
  living: 'bg-amber-50',
  entrance: 'bg-emerald-50',
  messages: 'bg-slate-50',
}

const balconyBgByPhase = {
  sun: 'bg-orange-100',
  sunset: 'bg-amber-50',
  moon: 'bg-slate-700',
}

export default function RoomExpanded() {
  const activeRoom = useGameStore((s) => s.activeRoom)
  const setActiveRoom = useGameStore((s) => s.setActiveRoom)
  const dayPhase = useGameStore((s) => s.dayPhase)

  if (activeRoom === 'overview') return null

  const RoomComponent = roomComponents[activeRoom]
  if (!RoomComponent) return null

  const bgClass =
    activeRoom === 'balcony'
      ? (balconyBgByPhase[dayPhase] || balconyBgByPhase.sun)
      : roomBg[activeRoom]

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/30 pointer-events-auto"
        onClick={() => setActiveRoom('overview')}
      />

      {/* Expanded room card — scaled to ~70% */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className={`relative w-[68%] h-[72%] rounded-[32px] shadow-2xl pointer-events-auto overflow-hidden will-change-transform transform-gpu transition-colors duration-700 ${bgClass}`}
        transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
      >
        <RoomComponent isExpanded={true} />

        <button
          onClick={() => setActiveRoom('overview')}
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-800 transition-colors bg-white/50 p-2 rounded-full backdrop-blur"
        >
          <Home size={24} />
        </button>
      </motion.div>
    </div>
  )
}
