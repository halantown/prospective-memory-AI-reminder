import { useGameStore } from '../../store/gameStore'

const ROOMS = [
  { id: 'study', label: 'Study', x: 10, y: 10, w: 40, h: 35 },
  { id: 'kitchen', label: 'Kitchen', x: 55, y: 10, w: 35, h: 35 },
  { id: 'living', label: 'Living', x: 10, y: 50, w: 40, h: 40 },
  { id: 'entrance', label: 'Entrance', x: 55, y: 50, w: 35, h: 18 },
  { id: 'balcony', label: 'Balcony', x: 55, y: 72, w: 35, h: 18 },
]

export default function MiniMap() {
  const currentRoom = useGameStore(s => s.currentRoom)

  return (
    <div className="bg-slate-100 rounded-lg p-2">
      <div className="text-[10px] text-slate-400 font-medium mb-1 text-center">Floor Plan</div>
      <svg viewBox="0 0 100 100" className="w-full h-auto" style={{ maxHeight: 120 }}>
        {ROOMS.map(room => {
          const active = currentRoom === room.id
          return (
            <g key={room.id}>
              <rect
                x={room.x} y={room.y}
                width={room.w} height={room.h}
                rx={3}
                fill={active ? '#dbeafe' : '#f1f5f9'}
                stroke={active ? '#3b82f6' : '#cbd5e1'}
                strokeWidth={active ? 1.5 : 0.5}
              />
              <text
                x={room.x + room.w / 2}
                y={room.y + room.h / 2 + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={6}
                fill={active ? '#1e40af' : '#94a3b8'}
                fontWeight={active ? 'bold' : 'normal'}
              >
                {room.label}
              </text>
              {active && (
                <circle
                  cx={room.x + room.w / 2}
                  cy={room.y + room.h / 2 + 8}
                  r={2.5}
                  fill="#3b82f6"
                >
                  <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
