import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import KitchenCard from '../rooms/KitchenCard'
import BalconyCard from '../rooms/BalconyCard'
import LivingCard from '../rooms/LivingCard'
import EntranceCard from '../rooms/EntranceCard'
import MessagesCard from '../rooms/MessagesCard'

const roomConfig = [
  { id: 'balcony',  bg: 'bg-sky-50',      Component: BalconyCard,  gridArea: 'balcony' },
  { id: 'kitchen',  bg: 'bg-orange-50',   Component: KitchenCard,  gridArea: 'kitchen' },
  { id: 'living',   bg: 'bg-amber-50',    Component: LivingCard,   gridArea: 'living' },
  { id: 'entrance', bg: 'bg-emerald-50',  Component: EntranceCard, gridArea: 'entrance' },
  { id: 'messages', bg: 'bg-slate-50',    Component: MessagesCard, gridArea: 'messages' },
]

const balconyBgByPhase = {
  morning: 'bg-sky-50',
  afternoon: 'bg-amber-50',
  evening: 'bg-indigo-100',
}

export default function RoomOverview() {
  const activeRoom = useGameStore((s) => s.activeRoom)
  const setActiveRoom = useGameStore((s) => s.setActiveRoom)
  const dayPhase = useGameStore((s) => s.dayPhase)
  const balconyBg = balconyBgByPhase[dayPhase] || balconyBgByPhase.morning

  return (
    <div className="absolute inset-0 p-6 grid gap-4 z-0"
      style={{
        gridTemplateColumns: '1fr 1.4fr',
        gridTemplateRows: '1.2fr 1fr',
        gridTemplateAreas: `
          "balcony kitchen"
          "bottom kitchen"
        `,
      }}
    >
      {/* Balcony - top left */}
      <motion.div
        onClick={() => setActiveRoom('balcony')}
        whileHover={activeRoom === 'overview' ? { scale: 1.015, y: -2 } : {}}
        className={`rounded-3xl cursor-pointer shadow-sm hover:shadow-lg transition-all duration-700 overflow-hidden ${balconyBg} will-change-transform transform-gpu ${
          activeRoom === 'balcony' ? 'opacity-0' : ''
        }`}
        style={{ gridArea: 'balcony' }}
      >
        <BalconyCard isExpanded={false} />
      </motion.div>

      {/* Kitchen - right (tall) */}
      <motion.div
        onClick={() => setActiveRoom('kitchen')}
        whileHover={activeRoom === 'overview' ? { scale: 1.015, y: -2 } : {}}
        className={`rounded-3xl cursor-pointer shadow-sm hover:shadow-lg transition-shadow overflow-hidden bg-orange-50 will-change-transform transform-gpu ${
          activeRoom === 'kitchen' ? 'opacity-0' : ''
        }`}
        style={{ gridArea: 'kitchen' }}
      >
        <KitchenCard isExpanded={false} />
      </motion.div>

      {/* Bottom row - 3 cards */}
      <div className="grid grid-cols-3 gap-4" style={{ gridArea: 'bottom' }}>
        <motion.div
          onClick={() => setActiveRoom('living')}
          whileHover={activeRoom === 'overview' ? { scale: 1.02, y: -2 } : {}}
          className={`rounded-3xl cursor-pointer shadow-sm hover:shadow-lg transition-shadow overflow-hidden bg-amber-50 will-change-transform transform-gpu ${
            activeRoom === 'living' ? 'opacity-0' : ''
          }`}
        >
          <LivingCard isExpanded={false} />
        </motion.div>

        <motion.div
          onClick={() => setActiveRoom('entrance')}
          whileHover={activeRoom === 'overview' ? { scale: 1.02, y: -2 } : {}}
          className={`rounded-3xl cursor-pointer shadow-sm hover:shadow-lg transition-shadow overflow-hidden bg-emerald-50 will-change-transform transform-gpu ${
            activeRoom === 'entrance' ? 'opacity-0' : ''
          }`}
        >
          <EntranceCard isExpanded={false} />
        </motion.div>

        <motion.div
          onClick={() => setActiveRoom('messages')}
          whileHover={activeRoom === 'overview' ? { scale: 1.02, y: -2 } : {}}
          className={`rounded-3xl cursor-pointer shadow-sm hover:shadow-lg transition-shadow overflow-hidden bg-slate-50 will-change-transform transform-gpu ${
            activeRoom === 'messages' ? 'opacity-0' : ''
          }`}
        >
          <MessagesCard isExpanded={false} />
        </motion.div>
      </div>
    </div>
  )
}
