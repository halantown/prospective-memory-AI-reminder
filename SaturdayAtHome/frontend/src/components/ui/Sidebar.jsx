import { useGameStore } from '../../store/gameStore'
import { Home, Flame, Droplets, Sofa, DoorOpen, Mail, Sun, Sunset, Moon } from 'lucide-react'

const rooms = [
  { id: 'kitchen',  label: 'Kitchen',  icon: Flame },
  { id: 'balcony',  label: 'Balcony',  icon: Droplets },
  { id: 'living',   label: 'Living',   icon: Sofa },
  { id: 'entrance', label: 'Entry',    icon: DoorOpen },
  { id: 'messages', label: 'Inbox',    icon: Mail },
]

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
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function parseClockToMinutes(label) {
  const [hh = '10', mm = '00'] = String(label || '10:00').split(':')
  const hour = Number(hh)
  const minute = Number(mm)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 10 * 60
  return hour * 60 + minute
}

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
  if (laundry.pile.length > (laundry.overflowThreshold ?? 5)) return `Pile overfull (${laundry.pile.length})`
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

  const phaseTheme =
    dayPhase === 'moon'
      ? 'from-slate-900 via-slate-800 to-black text-slate-100 border-slate-700'
      : dayPhase === 'sunset'
        ? 'from-orange-300 via-amber-200 to-slate-100 text-slate-800 border-orange-200'
        : 'from-orange-500 via-amber-400 to-yellow-100 text-white border-orange-300'
  const iconByPhase = {
    sun: Sun,
    sunset: Sunset,
    moon: Moon,
  }
  const currentIndex = Math.max(0, (worldClockSchedule || []).findIndex((s) => s.phase === dayPhase))
  const clockMinutes = parseClockToMinutes(worldClockLabel)
  const sunProgress = clamp((clockMinutes - 10 * 60) / (20 * 60 - 10 * 60), 0, 1)
  const moonProgress = clamp((clockMinutes - 18 * 60) / (23 * 60 - 18 * 60), 0, 1)
  const sunX = 8 + sunProgress * 84
  const moonX = 8 + moonProgress * 84
  const sunY = 74 - Math.sin(Math.PI * sunProgress) * 46
  const moonY = 74 - Math.sin(Math.PI * moonProgress) * 34

  return (
    <div className="w-52 bg-slate-900 shadow-[-10px_0_30px_rgba(0,0,0,0.1)] z-40 flex flex-col py-4 px-3 gap-2 border-l border-slate-800 text-slate-400 overflow-y-auto">
      <div className={`-mx-3 -mt-4 border-b bg-gradient-to-b px-3 py-3 ${phaseTheme}`}>
        <div className="text-3xl font-black tracking-wider tabular-nums">{worldClockLabel}</div>
        <div className={`mt-2 relative h-20 overflow-hidden border ${
          dayPhase === 'moon'
            ? 'bg-gradient-to-b from-slate-700/70 to-slate-950/95 border-slate-500/70'
            : dayPhase === 'sunset'
              ? 'bg-gradient-to-b from-orange-300/80 to-amber-100/40 border-orange-200/80'
              : 'bg-gradient-to-b from-sky-300/75 to-yellow-100/45 border-orange-100/90'
        }`}>
          <div className="absolute inset-x-2 bottom-2 h-[2px] rounded-full bg-white/35" />
          <div className="absolute inset-x-2 top-1.5 flex items-center justify-between text-[9px] font-semibold tracking-wide text-white/85">
            <span>10:00</span>
            <span>18:00</span>
            <span>23:00</span>
          </div>
          <span
            className="absolute text-2xl drop-shadow-[0_6px_10px_rgba(15,23,42,0.6)]"
            style={{
              left: `${sunX}%`,
              top: `${sunY}%`,
              transform: 'translate(-50%, -50%)',
              opacity: dayPhase === 'moon' ? 0.55 : 1,
            }}
          >
            ☀️
          </span>
          <span
            className="absolute text-2xl drop-shadow-[0_6px_10px_rgba(15,23,42,0.65)]"
            style={{
              left: `${moonX}%`,
              top: `${moonY}%`,
              transform: 'translate(-50%, -50%)',
              opacity: clockMinutes >= 18 * 60 ? 1 : 0.25,
            }}
          >
            🌙
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          {(worldClockSchedule || []).map((step, i) => {
            const Icon = iconByPhase[step.phase] || Sun
            const isActive = i <= currentIndex
            return (
              <div key={step.phase} className={`flex flex-col items-center gap-1 ${isActive ? 'opacity-100' : 'opacity-45'}`}>
                <Icon size={14} />
                <span className="text-[9px] font-semibold uppercase">{step.label}</span>
              </div>
            )
          })}
        </div>
      </div>

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
