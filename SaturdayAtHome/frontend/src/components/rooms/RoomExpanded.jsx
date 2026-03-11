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

export default function RoomExpanded() {
  const activeRoom = useGameStore((s) => s.activeRoom)
  const setActiveRoom = useGameStore((s) => s.setActiveRoom)

  if (activeRoom === 'overview') return null

  const RoomComponent = roomComponents[activeRoom]
  if (!RoomComponent) return null

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm pointer-events-auto"
        onClick={() => setActiveRoom('overview')}
      />

      {/* Expanded room card — scaled to ~75% */}
      <motion.div
        layoutId={`card-container-${activeRoom}`}
        className={`relative w-3/4 h-4/5 rounded-[32px] shadow-2xl pointer-events-auto overflow-hidden ${roomBg[activeRoom]}`}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
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
