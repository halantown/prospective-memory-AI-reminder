import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { ROOMS, TRIGGER_ROOM_MAP, SCENE_WIDTH, SCENE_HEIGHT } from './sceneConstants'

export default function EdgeNotification() {
  const triggers = useGameStore(s => s.triggers)
  const gameActive = useGameStore(s => s.gameActive)
  const currentRoom = useGameStore(s => s.currentRoom)

  // Only show when game panel is active (otherwise triggers are directly visible)
  if (!gameActive) return null

  const room = ROOMS[currentRoom] || ROOMS.study
  // Game panel bounds (mirroring GamePanel.jsx calculation)
  const panelW = SCENE_WIDTH * 0.58
  const panelH = SCENE_HEIGHT * 0.65
  const centerX = room.x + room.w / 2
  const centerY = room.y + room.h / 2
  const panelLeft = Math.max(10, Math.min(centerX - panelW / 2, SCENE_WIDTH - panelW - 10))
  const panelTop = Math.max(10, Math.min(centerY - panelH / 2, SCENE_HEIGHT - panelH - 10))
  const panelRight = panelLeft + panelW
  const panelBottom = panelTop + panelH
  const panelCX = panelLeft + panelW / 2
  const panelCY = panelTop + panelH / 2

  // Find fired or ambient triggers NOT in the current room
  const notifications = triggers
    .filter(t => t.state === 'fired' || t.state === 'ambient')
    .map(t => {
      const triggerRoom = TRIGGER_ROOM_MAP[t.id]
      if (!triggerRoom || triggerRoom === currentRoom) return null
      const tRoom = ROOMS[triggerRoom]
      if (!tRoom) return null

      // Target point: center of the trigger's room
      const tx = tRoom.x + tRoom.w / 2
      const ty = tRoom.y + tRoom.h / 2

      // Direction from panel center to trigger room
      const dx = tx - panelCX
      const dy = ty - panelCY

      // Project onto game panel edges to find indicator position
      let edgeX, edgeY
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
        edgeX = panelCX
        edgeY = panelTop
      } else {
        // Find intersection with panel rectangle edge
        const scaleX = dx !== 0 ? (panelW / 2) / Math.abs(dx) : Infinity
        const scaleY = dy !== 0 ? (panelH / 2) / Math.abs(dy) : Infinity
        const s = Math.min(scaleX, scaleY)
        edgeX = panelCX + dx * s
        edgeY = panelCY + dy * s
      }

      // Clamp to panel edges with small padding
      edgeX = Math.max(panelLeft + 8, Math.min(edgeX, panelRight - 8))
      edgeY = Math.max(panelTop + 8, Math.min(edgeY, panelBottom - 8))

      return { id: t.id, state: t.state, x: edgeX, y: edgeY }
    })
    .filter(Boolean)

  return (
    <>
      {notifications.map(n => (
        <motion.div
          key={n.id}
          className={`absolute z-[35] w-3.5 h-3.5 rounded-full pointer-events-none ${
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
