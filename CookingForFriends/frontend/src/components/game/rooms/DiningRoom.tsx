/** Dining room — table setting task. */

import { useState } from 'react'
import { useGameStore } from '../../../stores/gameStore'

const REQUIRED_ITEMS = ['plate', 'fork', 'knife', 'glass', 'napkin']

export default function DiningRoom() {
  const [placed, setPlaced] = useState<string[]>([])
  const wsSend = useGameStore((s) => s.wsSend)

  const handlePlaceItem = (item: string) => {
    if (placed.includes(item)) return
    setPlaced([...placed, item])
    if (wsSend) {
      wsSend({
        type: 'task_action',
        data: { task: 'table_setting', action: 'place_item', item, timestamp: Date.now() / 1000 },
      })
    }
  }

  const allPlaced = REQUIRED_ITEMS.every(i => placed.includes(i))

  return (
    <div className="flex flex-col gap-2 h-full">
      <p className="text-xs text-slate-400">Set the table for dinner</p>
      <div className="flex flex-wrap gap-2">
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
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all
                ${done
                  ? 'bg-green-700/40 text-green-300 border border-green-500'
                  : 'bg-slate-600/60 text-slate-300 border border-slate-500 hover:bg-slate-500/60 cursor-pointer'
                }`}
            >
              {emojis[item] || '•'} {item}
            </button>
          )
        })}
      </div>
      {allPlaced && (
        <p className="text-green-400 text-xs font-medium mt-1">✓ Table is set!</p>
      )}
    </div>
  )
}
