/** Dining room — table setting task. */

import { useGameStore } from '../../../stores/gameStore'
import PMTargetItems from '../PMTargetItems'

const REQUIRED_ITEMS = ['plate', 'fork', 'knife', 'glass', 'napkin']

export default function DiningRoom() {
  const placed = useGameStore((s) => s.diningPlacedItems)
  const addDiningPlacedItem = useGameStore((s) => s.addDiningPlacedItem)
  const wsSend = useGameStore((s) => s.wsSend)

  const handlePlaceItem = (item: string) => {
    if (placed.includes(item)) return
    addDiningPlacedItem(item)
    if (wsSend) {
      wsSend({
        type: 'task_action',
        data: { task: 'table_setting', action: 'place_item', item, timestamp: Date.now() / 1000 },
      })
    }
  }

  const allPlaced = REQUIRED_ITEMS.every(i => placed.includes(i))

  return (
    <div className="absolute inset-0">
      {/* Instruction badge */}
      <div className="absolute top-9 left-2 z-10 pointer-events-none">
        <span className="text-[10px] text-slate-300/80 bg-slate-900/50 rounded px-1.5 py-0.5">
          Set the table for dinner
        </span>
      </div>

      {/* Table setting items overlaid on dining table */}
      <div
        className="absolute flex flex-wrap gap-1.5 items-center justify-center z-10"
        style={{ left: '12%', top: '25%', right: '12%', height: '48%' }}
      >
        {REQUIRED_ITEMS.map((item) => {
          const done = placed.includes(item)
          const emojis: Record<string, string> = {
            plate: '🍽️', fork: '🍴', knife: '🔪', glass: '🥂', napkin: '🧻',
          }
          return (
            <button
              key={item}
              onClick={() => handlePlaceItem(item)}
              disabled={done}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all backdrop-blur-sm
                ${done
                  ? 'bg-green-700/50 text-green-300 border border-green-500'
                  : 'bg-slate-600/50 text-slate-300 border border-slate-500/60 hover:bg-slate-500/60 cursor-pointer'
                }`}
            >
              {emojis[item] || '•'} {item}
            </button>
          )
        })}
        {allPlaced && (
          <p className="text-green-400 text-[10px] font-medium w-full text-center mt-1">✓ Table is set!</p>
        )}
      </div>

      {/* PM targets on side table */}
      <div className="absolute z-10" style={{ left: '3%', bottom: '3%', width: '50%' }}>
        <PMTargetItems room="dining" />
      </div>
    </div>
  )
}
