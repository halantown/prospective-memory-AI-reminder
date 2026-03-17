import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { ROOMS, TRIGGER_ROOM_MAP, SCENE_WIDTH, SCENE_HEIGHT } from './sceneConstants'

export default function EdgeNotification() {
  const triggers = useGameStore(s => s.triggers)
  const gameActive = useGameStore(s => s.gameActive)
  const currentRoom = useGameStore(s => s.currentRoom)

  // Only show when game panel is active (otherwise triggers are directly visible)
  if (!gameActive) return null

  // Find fired or ambient triggers NOT in the current room
  const notifications = triggers
    .filter(t => t.state === 'fired' || t.state === 'ambient')
    .map(t => {
      const triggerRoom = TRIGGER_ROOM_MAP[t.id]
      if (!triggerRoom || triggerRoom === currentRoom) return null
      const room = ROOMS[triggerRoom]
      if (!room) return null

      // Determine direction relative to center of scene
      const roomCenterX = room.x + room.w / 2
      const roomCenterY = room.y + room.h / 2

      return {
        id: t.id,
        state: t.state,
        x: Math.max(20, Math.min(roomCenterX, SCENE_WIDTH - 20)),
        y: Math.max(20, Math.min(roomCenterY, SCENE_HEIGHT - 20)),
      }
    })
    .filter(Boolean)

  return (
    <>
      {notifications.map(n => (
        <motion.div
          key={n.id}
          className={`absolute z-40 w-3.5 h-3.5 rounded-full pointer-events-none ${
            n.state === 'fired'
              ? 'bg-amber-500 shadow-md shadow-amber-400/60'
              : 'bg-blue-400/50'
          }`}
          style={{ left: n.x - 7, top: n.y - 7 }}
          animate={
            n.state === 'fired'
              ? { scale: [1, 1.5, 1], opacity: [0.8, 1, 0.8] }
              : { opacity: [0.3, 0.7, 0.3] }
          }
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      ))}
    </>
  )
}
