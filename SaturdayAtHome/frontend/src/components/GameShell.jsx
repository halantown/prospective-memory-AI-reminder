import { useGameStore } from '../store/gameStore'
import useWebSocket from '../hooks/useWebSocket'
import { useAudio } from '../hooks/useAudio'
import HomeScene from './scene/HomeScene'
import MCQOverlay from './pm/MCQOverlay'
import WelcomeScreen from './screens/WelcomeScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import EncodingScreen from './screens/EncodingScreen'
import QuestionnaireScreen from './screens/QuestionnaireScreen'
import BlockEndScreen from './screens/BlockEndScreen'
import CompleteScreen from './screens/CompleteScreen'

export default function GameShell() {
  const phase = useGameStore(s => s.phase)
  const mcqVisible = useGameStore(s => s.mcqVisible)
  const wsReconnecting = useGameStore(s => s.wsReconnecting)

  useWebSocket()
  useAudio()

  // Note: flushResponseBuffer is handled solely in useWebSocket (every 5s)
  // to avoid duplicate sends

  if (phase === 'welcome') return <WelcomeScreen />
  if (phase === 'onboarding') return <OnboardingScreen />
  if (phase === 'encoding') return <EncodingScreen />
  if (phase === 'questionnaire') return <QuestionnaireScreen />
  if (phase === 'block_end') return <BlockEndScreen />
  if (phase === 'complete') return <CompleteScreen />

  // Playing phase — 2D home scene layout
  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* WS reconnection indicator */}
      {wsReconnecting && (
        <div className="fixed top-0 inset-x-0 z-[100] bg-amber-500 text-white text-center text-sm py-1 animate-pulse">
          Connection lost — reconnecting…
        </div>
      )}

      {/* Home scene replaces old MainPanel + Sidebar layout */}
      <HomeScene />

      {/* MCQ overlay renders above the entire scene */}
      {mcqVisible && (
        <div className="fixed inset-0 z-[60]">
          <MCQOverlay />
        </div>
      )}
    </div>
  )
}
