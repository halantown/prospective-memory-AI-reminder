import { useRef, useEffect, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import Room from './Room'
import Avatar from './Avatar'
import PepperCharacter from './PepperCharacter'
import GamePanel from './GamePanel'
import SceneClock from './SceneClock'
import TransitionOverlay from './TransitionOverlay'
import EdgeNotification from './EdgeNotification'
import { SCENE_WIDTH, SCENE_HEIGHT, ROOMS } from './sceneConstants'

export default function HomeScene() {
  const gameActive = useGameStore(s => s.gameActive)
  const currentRoom = useGameStore(s => s.currentRoom)
  const containerRef = useRef(null)
  const [scale, setScale] = useState(1)

  // Scale the scene to fit the viewport while maintaining aspect ratio
  useEffect(() => {
    function updateScale() {
      if (!containerRef.current) return
      const parent = containerRef.current.parentElement
      if (!parent) return
      const pw = parent.clientWidth * 0.98
      const ph = parent.clientHeight * 0.96
      const s = Math.min(pw / SCENE_WIDTH, ph / SCENE_HEIGHT, 1)
      setScale(s)
    }
    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  return (
    <div className="w-full h-screen flex items-center justify-center bg-stone-200 overflow-hidden">
      <div
        ref={containerRef}
        className="relative bg-stone-100 shadow-2xl rounded-xl overflow-hidden border-2 border-stone-300"
        style={{
          width: SCENE_WIDTH,
          height: SCENE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        {/* House label */}
        <div className="absolute top-2 left-4 text-xs font-semibold text-stone-400 uppercase tracking-widest z-10">
          🏠 Saturday at Home
        </div>

        {/* Hallway floor between rooms */}
        <div className="absolute inset-0 z-0">
          {/* Horizontal corridor between rows */}
          <div className="absolute bg-stone-200/60" style={{ left: 20, top: 360, width: 710, height: 30 }} />
          {/* Vertical corridor between left columns */}
          <div className="absolute bg-stone-200/60" style={{ left: 360, top: 20, width: 30, height: 660 }} />
          {/* Corridor between right rooms */}
          <div className="absolute bg-stone-200/60" style={{ left: 760, top: 390, width: 620, height: 30 }} />
        </div>

        {/* Rooms */}
        {Object.entries(ROOMS).map(([id, room]) => (
          <Room key={id} roomId={id} room={room} isCurrentRoom={currentRoom === id} />
        ))}

        {/* Characters */}
        <Avatar />
        <PepperCharacter />

        {/* Scene dim overlay when game panel is active */}
        {gameActive && (
          <div className="absolute inset-0 bg-black/10 pointer-events-none z-20 transition-opacity duration-300" />
        )}

        {/* Game Panel floating overlay */}
        <GamePanel />

        {/* Edge notifications for off-screen triggers */}
        <EdgeNotification />

        {/* HUD Clock */}
        <SceneClock />

        {/* Transition narrative overlay */}
        <TransitionOverlay />
      </div>
    </div>
  )
}
