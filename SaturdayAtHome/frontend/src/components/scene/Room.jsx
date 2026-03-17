import SceneTrigger from './SceneTrigger'
import { useGameStore } from '../../store/gameStore'

export default function Room({ roomId, room, isCurrentRoom }) {
  const triggers = useGameStore(s => s.triggers)

  return (
    <div
      className={`absolute rounded-lg border-2 transition-all duration-500 ${
        isCurrentRoom ? 'ring-2 ring-blue-400/50' : ''
      }`}
      style={{
        left: room.x,
        top: room.y,
        width: room.w,
        height: room.h,
        backgroundColor: room.color,
        borderColor: room.borderColor,
      }}
    >
      {/* Room label */}
      <div className="absolute top-1 left-2 text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
        {room.label}
      </div>

      {/* Furniture items */}
      {room.furniture.map((item, i) => {
        // If this furniture item is a trigger, render SceneTrigger
        if (item.triggerId) {
          const trigger = triggers.find(t => t.id === item.triggerId)
          return (
            <SceneTrigger
              key={item.triggerId}
              trigger={trigger}
              position={{ x: item.x, y: item.y }}
              furnitureEmoji={item.emoji}
              label={item.label}
            />
          )
        }

        // Regular furniture
        return (
          <div
            key={i}
            className="absolute flex flex-col items-center select-none"
            style={{ left: item.x - 15, top: item.y - 15 }}
          >
            <span className="text-xl">{item.emoji}</span>
            <span className="text-[8px] text-stone-400 mt-0.5 whitespace-nowrap">{item.label}</span>
          </div>
        )
      })}
    </div>
  )
}
