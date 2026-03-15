import { useGameStore } from '../../store/gameStore'
import { Home, Flame, Droplets, Sofa, DoorOpen, Mail } from 'lucide-react'

const rooms = [
  { id: 'kitchen',  label: 'Kitchen',  icon: Flame },
  { id: 'balcony',  label: 'Balcony',  icon: Droplets },
  { id: 'living',   label: 'Living',   icon: Sofa },
  { id: 'entrance', label: 'Entry',    icon: DoorOpen },
  { id: 'messages', label: 'Inbox',    icon: Mail },
]

function formatBlockTimer(totalSec) {
  const safe = Math.max(0, Math.floor(totalSec))
  const mm = String(Math.floor(safe / 60)).padStart(2, '0')
  const ss = String(safe % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

function StatusDot({ color }) {
  if (color === 'red') return (
    <span className="relative flex h-3.5 w-3.5 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border-2 border-slate-900" />
    </span>
  )
  if (color === 'orange') return (
    <span className="relative flex h-3.5 w-3.5 shrink-0">
      <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-60" />
      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-orange-500 border-2 border-slate-900" />
    </span>
  )
  if (color === 'yellow') return (
    <span className="relative flex h-3.5 w-3.5 shrink-0">
      <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-50" />
      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-yellow-400 border-2 border-slate-900" />
    </span>
  )
  if (color === 'blue') return (
    <span className="relative flex h-3.5 w-3.5 shrink-0">
      <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-40" />
      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-400 border-2 border-slate-900" />
    </span>
  )
  return <span className="h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-slate-900 shrink-0" />
}

const Divider = () => <div className="w-full h-px bg-slate-700/60 my-1" />

function useKitchenSummary() {
  const hobs = useGameStore((s) => s.hobs)
  const counts = {}
  hobs.forEach((h) => { counts[h.status] = (counts[h.status] || 0) + 1 })
  const parts = []
  const cooking = (counts.cooking_side1 || 0) + (counts.cooking_side2 || 0)
  const ready = (counts.ready_side1 || 0) + (counts.ready_side2 || 0)
  if (cooking) parts.push(`${cooking} cooking`)
  if (ready) parts.push(`${ready} ready`)
  if (counts.burning) parts.push(`${counts.burning} burning!`)
  if (counts.ash) parts.push(`${counts.ash} ash`)
  return parts.length ? parts.join(', ') : 'All clear'
}

function useBalconySummary() {
  const laundry = useGameStore((s) => s.laundry)
  if (laundry.washStatus === 'jammed') return 'Jammed!'
  if (laundry.washStatus === 'washing') return `Washing — ${laundry.washProgress}s`
  if (laundry.washStatus === 'done') return 'Done — collect!'
  if (laundry.washStatus === 'selecting') return 'Selecting...'
  return laundry.pile.length > 0 ? `${laundry.pile.length} items left` : 'Idle'
}

function useLivingSummary() {
  const plantWilted = useGameStore((s) => s.plantWilted)
  const plantNeedsWater = useGameStore((s) => s.plantNeedsWater)
  if (plantWilted) return 'Plant wilting!'
  if (plantNeedsWater) return 'Needs water'
  return 'Plant OK'
}

function useInboxSummary() {
  const unreadCount = useGameStore((s) => s.unreadCount)
  return unreadCount > 0 ? `${unreadCount} unread` : 'All read'
}

export default function Sidebar() {
  const activeRoom = useGameStore((s) => s.activeRoom)
  const setActiveRoom = useGameStore((s) => s.setActiveRoom)
  const getKitchenStatus = useGameStore((s) => s.getKitchenStatus)
  const getBalconyStatus = useGameStore((s) => s.getBalconyStatus)
  const getLivingStatus = useGameStore((s) => s.getLivingStatus)
  const getInboxStatus = useGameStore((s) => s.getInboxStatus)
  const unreadCount = useGameStore((s) => s.unreadCount)
  const score = useGameStore((s) => s.score)
  const blockTimer = useGameStore((s) => s.blockTimer)
  const dayPhase = useGameStore((s) => s.dayPhase)
  const worldClockLabel = useGameStore((s) => s.worldClockLabel)
  const worldClockSchedule = useGameStore((s) => s.worldClockSchedule)

  const kitchenStatus = getKitchenStatus()
  const balconyStatus = getBalconyStatus()
  const livingStatus = getLivingStatus()
  const inboxStatus = getInboxStatus()

  const kitchenSummary = useKitchenSummary()
  const balconySummary = useBalconySummary()
  const livingSummary = useLivingSummary()
  const inboxSummary = useInboxSummary()

  const getStatusColor = (roomId) => {
    if (roomId === 'kitchen') return kitchenStatus
    if (roomId === 'balcony') return balconyStatus
    if (roomId === 'living') return livingStatus
    if (roomId === 'messages') return inboxStatus
    return null
  }

  const activityRows = [
    { label: 'Kitchen', summary: kitchenSummary, color: kitchenStatus },
    { label: 'Balcony', summary: balconySummary, color: balconyStatus },
    { label: 'Living',  summary: livingSummary,  color: livingStatus },
    { label: 'Inbox',   summary: inboxSummary,   color: inboxStatus },
  ]

  const scoreRows = [
    { label: 'Kitchen', color: kitchenStatus },
    { label: 'Laundry', color: balconyStatus },
    { label: 'Plant',   color: livingStatus },
    { label: 'Inbox',   color: inboxStatus },
  ]

  const phaseLabel =
    dayPhase === 'night' ? 'Night calm' :
    dayPhase === 'evening' ? 'Evening blue' :
    dayPhase === 'sunset' ? 'Sunset amber' :
    dayPhase === 'noon' ? 'Bright noon' :
    dayPhase === 'afternoon' ? 'Afternoon light' :
    'Morning light'

  const currentScheduleIndex = (worldClockSchedule || []).reduce(
    (idx, row, i) => (blockTimer >= row.atSec ? i : idx),
    -1
  )
  const endAt = worldClockSchedule?.[worldClockSchedule.length - 1]?.atSec || 0

  return (
    <div className="w-52 bg-slate-900 shadow-[-10px_0_30px_rgba(0,0,0,0.1)] z-40 flex flex-col py-4 px-3 gap-2 border-l border-slate-800 text-slate-400 overflow-y-auto">

      {/* ── Home overview button ── */}
      <button
        onClick={() => setActiveRoom('overview')}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all group ${
          activeRoom === 'overview'
            ? 'bg-slate-700 text-white'
            : 'hover:bg-slate-800 hover:text-slate-200'
        }`}
      >
        <Home size={20} className="shrink-0 group-hover:scale-110 transition-transform" />
        <span className="text-sm font-bold tracking-wider">HOME</span>
      </button>

      <Divider />

      {/* ── Room navigation ── */}
      {rooms.map((room) => (
        <button
          key={room.id}
          onClick={() => setActiveRoom(room.id)}
          className={`relative w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeRoom === room.id
              ? 'bg-indigo-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.5)]'
              : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <room.icon size={18} className="shrink-0" />
          <span className="flex-1 text-left">{room.label}</span>
          <StatusDot color={getStatusColor(room.id)} />
          {room.id === 'messages' && unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 ring-2 ring-slate-900 z-10">
              {unreadCount}
            </span>
          )}
        </button>
      ))}

      <Divider />

      {/* ── Activity status ── */}
      <div className="px-1">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Activity</h3>
        <div className="space-y-1">
          {activityRows.map((row) => (
            <div key={row.label} className="flex items-start gap-2 text-xs leading-tight">
              <span className="text-slate-500 w-14 shrink-0">{row.label}</span>
              <span className={`flex-1 ${
                row.color === 'red' ? 'text-red-400 font-semibold' :
                row.color === 'orange' ? 'text-orange-400' :
                'text-slate-300'
              }`}>
                {row.summary}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Divider />

      {/* ── Time progression ── */}
      <div className="px-1">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Time of Day</h3>
        <div className="text-[11px] text-slate-500 mb-1.5">
          Game timer: {formatBlockTimer(blockTimer)} / {formatBlockTimer(endAt)}
        </div>
        <div className="space-y-1.5 mb-1.5">
          {(worldClockSchedule || []).map((row, i) => (
            <div key={`${row.phase}-${row.atSec}`} className="grid grid-cols-[40px_1fr] gap-1.5 text-[10px] leading-tight">
              <span className={`${i <= currentScheduleIndex ? 'text-indigo-300 font-semibold' : 'text-slate-500'}`}>
                {row.atLabel}
              </span>
              <span className={`${i === currentScheduleIndex ? 'text-slate-100' : 'text-slate-300'}`}>
                {row.worldClockLabel} {row.cue}
              </span>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-slate-500 mt-1.5">Now: {worldClockLabel} | {phaseLabel}</div>
      </div>

      <Divider />

      {/* ── Laundry rules reference ── */}
      <div className="px-1">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Laundry Rules</h3>
        <table className="w-full text-[11px] leading-relaxed">
          <tbody>
            <tr>
              <td className="pr-1.5 py-0.5">
                <span className="inline-flex gap-0.5">
                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                  <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                  <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                </span>
              </td>
              <td className="text-slate-300 py-0.5">Warm Det.</td>
              <td className="text-slate-500 text-right py-0.5">40°</td>
            </tr>
            <tr>
              <td className="pr-1.5 py-0.5">
                <span className="inline-flex gap-0.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                  <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
                </span>
              </td>
              <td className="text-slate-300 py-0.5">Cold Det.</td>
              <td className="text-slate-500 text-right py-0.5">30°</td>
            </tr>
            <tr>
              <td className="pr-1.5 py-0.5">
                <span className="inline-flex gap-0.5">
                  <span className="w-2 h-2 rounded-full bg-white inline-block" />
                  <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                </span>
              </td>
              <td className="text-slate-300 py-0.5">White Det.</td>
              <td className="text-slate-500 text-right py-0.5">60°</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Divider />

      {/* ── Score breakdown ── */}
      <div className="px-1">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Score</h3>
        <div className="text-xl font-bold text-white mb-1.5">{score}</div>
        <div className="space-y-0.5">
          {scoreRows.map((row) => (
            <div key={row.label} className="flex items-center gap-2 text-xs">
              <StatusDot color={row.color} />
              <span className="text-slate-400">{row.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
