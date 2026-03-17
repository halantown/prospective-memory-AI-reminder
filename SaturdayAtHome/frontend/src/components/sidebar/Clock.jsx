import { useGameStore } from '../../store/gameStore'

/**
 * Parse "10:30 AM" → fractional 24h hour (10.5).
 * Returns 12 (noon) on parse failure.
 */
function parseHour(timeStr) {
  if (!timeStr) return 12
  const m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return 12
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const period = m[3].toUpperCase()
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return h + min / 60
}

/**
 * Compute a sky gradient + icon based on fractional hour (0-24).
 *  6-8   sunrise
 *  8-17  day
 *  17-19 sunset
 *  19-6  night
 */
function skyStyle(hour) {
  if (hour >= 6 && hour < 8) {
    // Sunrise
    return {
      gradient: 'linear-gradient(135deg, #fbbf24 0%, #f97316 40%, #6366f1 100%)',
      icon: '🌅',
      textColor: 'text-amber-900',
    }
  }
  if (hour >= 8 && hour < 12) {
    // Morning
    return {
      gradient: 'linear-gradient(135deg, #38bdf8 0%, #60a5fa 50%, #93c5fd 100%)',
      icon: '☀️',
      textColor: 'text-sky-900',
    }
  }
  if (hour >= 12 && hour < 17) {
    // Afternoon
    return {
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 60%, #8b5cf6 100%)',
      icon: '🌤️',
      textColor: 'text-white',
    }
  }
  if (hour >= 17 && hour < 19) {
    // Sunset
    return {
      gradient: 'linear-gradient(135deg, #f97316 0%, #ec4899 40%, #7c3aed 100%)',
      icon: '🌇',
      textColor: 'text-orange-100',
    }
  }
  // Night (19-6)
  return {
    gradient: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e3a5f 100%)',
    icon: '🌙',
    textColor: 'text-indigo-200',
  }
}

export default function Clock() {
  const time = useGameStore(s => s.simulatedTime)
  const hour = parseHour(time)
  const { gradient, icon, textColor } = skyStyle(hour)

  return (
    <div
      className="flex items-center justify-between px-4 py-2.5 rounded-t-lg"
      style={{ background: gradient }}
    >
      <div>
        <div className={`text-lg font-mono font-bold ${textColor} leading-none`}>
          {time || '--:--'}
        </div>
        <div className={`text-[10px] ${textColor} opacity-70 mt-0.5`}>Saturday</div>
      </div>
      <span className="text-2xl leading-none" role="img" aria-label="time of day">
        {icon}
      </span>
    </div>
  )
}
