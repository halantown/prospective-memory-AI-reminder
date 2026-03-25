/** Living room — PM items via bookshelf popup + visitors on sofa. */

import { useGameStore } from '../../../stores/gameStore'
import PMTargetItems from '../PMTargetItems'

const VISITOR_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
  'bg-yellow-500', 'bg-orange-500',
]

export default function LivingRoom({ isActive: _isActive }: { isActive: boolean }) {
  const visitors = useGameStore((s) => s.visitors)

  return (
    <div className="absolute inset-0">
      {/* Visitors on sofa */}
      {visitors.length > 0 && (
        <div className="absolute z-10 flex gap-2 items-end" style={{ left: '10%', top: '35%' }}>
          {visitors.map((name, i) => (
            <div key={name + i} className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full ${VISITOR_COLORS[i % VISITOR_COLORS.length]}
                  flex items-center justify-center text-white text-xs font-bold shadow-md`}
              >
                {name.charAt(0).toUpperCase()}
              </div>
              <span className="text-[8px] text-slate-300/80 mt-0.5 truncate max-w-[40px]">
                {name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* PM furniture button positioned near the bookshelf (right side) */}
      <div className="absolute z-10" style={{ right: '5%', top: '25%' }}>
        <PMTargetItems room="living_room" />
      </div>
    </div>
  )
}
