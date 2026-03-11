import { useGameStore } from '../../store/gameStore'
import { Home, Flame, Droplets, Sofa, DoorOpen, MessageSquare } from 'lucide-react'

const rooms = [
  { id: 'kitchen',  label: 'Kitchen',  icon: Flame,         chars: ['K','i','t'] },
  { id: 'balcony',  label: 'Balcony',  icon: Droplets,      chars: ['B','a','l'] },
  { id: 'living',   label: 'Living',   icon: Sofa,          chars: ['L','i','v'] },
  { id: 'entrance', label: 'Entry',    icon: DoorOpen,      chars: ['E','n','t'] },
  { id: 'messages', label: 'Msgs',     icon: MessageSquare, chars: ['M','s','g'] },
]

function StatusDot({ color }) {
  if (color === 'red') return (
    <span className="absolute -top-1 -right-1 flex h-4 w-4">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-slate-900" />
    </span>
  )
  if (color === 'yellow') return (
    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-yellow-400 border-2 border-slate-900" />
  )
  if (color === 'blue') return (
    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-blue-400 border-2 border-slate-900 animate-pulse" />
  )
  return null
}

export default function Sidebar() {
  const activeRoom = useGameStore((s) => s.activeRoom)
  const setActiveRoom = useGameStore((s) => s.setActiveRoom)
  const getKitchenStatus = useGameStore((s) => s.getKitchenStatus)
  const getBalconyStatus = useGameStore((s) => s.getBalconyStatus)
  const unreadCount = useGameStore((s) => s.unreadCount)

  const kitchenStatus = getKitchenStatus()
  const balconyStatus = getBalconyStatus()

  const getStatusColor = (roomId) => {
    if (roomId === 'kitchen') return kitchenStatus
    if (roomId === 'balcony') return balconyStatus
    return null
  }

  return (
    <div className="w-20 bg-slate-900 shadow-[10px_0_30px_rgba(0,0,0,0.1)] z-40 flex flex-col items-center py-6 gap-4 border-r border-slate-800 text-slate-400">
      {/* Home overview button */}
      <button
        onClick={() => setActiveRoom('overview')}
        className={`p-2.5 rounded-xl transition-all group flex flex-col items-center ${
          activeRoom === 'overview'
            ? 'bg-slate-700 text-white'
            : 'hover:bg-slate-800 hover:text-slate-200'
        }`}
      >
        <Home size={24} className="mb-1 group-hover:scale-110 transition-transform" />
        <span className="text-[10px] font-bold tracking-wider">HOME</span>
      </button>

      <div className="w-10 h-px bg-slate-800 my-1" />

      {/* Room buttons */}
      {rooms.map((room) => (
        <button
          key={room.id}
          onClick={() => setActiveRoom(room.id)}
          className={`relative w-12 py-3 rounded-xl font-bold text-xs flex flex-col items-center gap-0.5 transition-all ${
            activeRoom === room.id
              ? 'bg-indigo-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.5)] scale-110'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200'
          }`}
        >
          <room.icon size={18} />
          <span className="text-[9px] tracking-wider mt-0.5">{room.label}</span>
          <StatusDot color={getStatusColor(room.id)} />
          {room.id === 'messages' && unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
