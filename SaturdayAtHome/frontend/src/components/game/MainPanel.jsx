import { useGameStore } from '../../store/gameStore'
import SemanticCatGame from './SemanticCatGame'
import GoNoGoGame from './GoNoGoGame'
import TriviaGame from './TriviaGame'
import TransitionScreen from './TransitionScreen'

export default function MainPanel() {
  const gameType = useGameStore(s => s.currentGameType)
  const gameActive = useGameStore(s => s.gameActive)
  const gameDimmed = useGameStore(s => s.gameDimmed)

  return (
    <div className={`h-full flex flex-col ${gameDimmed ? 'opacity-30 pointer-events-none' : ''} transition-opacity`}>
      {!gameActive && <TransitionScreen />}
      {gameActive && gameType === 'semantic_cat' && <SemanticCatGame />}
      {gameActive && gameType === 'go_nogo' && <GoNoGoGame />}
      {gameActive && gameType === 'trivia' && <TriviaGame />}
    </div>
  )
}
