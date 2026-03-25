import { useGameStore } from '../../store/gameStore'
import SemanticCatGame from './SemanticCatGame'
import GoNoGoGame from './GoNoGoGame'
import TriviaGame from './TriviaGame'

export default function MainPanel() {
  const gameType = useGameStore(s => s.currentGameType)
  const gameDimmed = useGameStore(s => s.gameDimmed)
  const gamePaused = useGameStore(s => s.gamePaused)

  return (
    <div className={`h-full flex flex-col relative ${gameDimmed ? 'opacity-30 pointer-events-none' : ''} transition-opacity`}>
      {gameType === 'semantic_cat' && <SemanticCatGame />}
      {gameType === 'go_nogo' && <GoNoGoGame />}
      {gameType === 'trivia' && <TriviaGame />}

      {/* Pause indicator */}
      {gamePaused && !gameDimmed && (
        <div className="absolute top-3 right-3 bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full animate-pulse z-10">
          ⏸ PAUSED
        </div>
      )}
    </div>
  )
}
