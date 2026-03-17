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

  return (
    <div className="w-full h-screen flex items-center justify-center bg-stone-200 overflow-hidden">
      <div
        className="relative bg-stone-100 shadow-2xl rounded-xl overflow-hidden border-2 border-stone-300"
        style={{
          width: SCENE_WIDTH,
          height: SCENE_HEIGHT,
          maxWidth: '98vw',
          maxHeight: '96vh',
          aspectRatio: `${SCENE_WIDTH}/${SCENE_HEIGHT}`,
        }}
      >
        {/* House label */}
        <div className="absolute top-2 left-4 text-xs font-semibold text-stone-400 uppercase tracking-widest z-10">
          🏠 Saturday at Home
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
