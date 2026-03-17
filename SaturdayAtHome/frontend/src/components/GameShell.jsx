import { useGameStore } from '../store/gameStore'
import useWebSocket from '../hooks/useWebSocket'
import { useAudio } from '../hooks/useAudio'
import Sidebar from './sidebar/Sidebar'
import MainPanel from './game/MainPanel'
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

  // Playing phase — main layout
  return (
    <div className="w-full h-screen flex overflow-hidden bg-slate-50">
      {/* WS reconnection indicator */}
      {wsReconnecting && (
        <div className="fixed top-0 inset-x-0 z-[100] bg-amber-500 text-white text-center text-sm py-1 animate-pulse">
          Connection lost — reconnecting…
        </div>
      )}
      {/* Main Panel — 75% */}
      <div className="flex-1 relative">
        <MainPanel />
        {mcqVisible && <MCQOverlay />}
      </div>
      {/* Sidebar — 25% */}
      <div className="w-80 flex-shrink-0 border-l border-slate-700 bg-slate-900">
        <Sidebar />
      </div>
    </div>
  )
}
