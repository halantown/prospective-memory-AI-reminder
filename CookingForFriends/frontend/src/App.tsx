/** App root — path-based routing. */

import { useGameStore } from './stores/gameStore'
import WelcomePage from './pages/game/WelcomePage'
import EncodingPage from './pages/game/EncodingPage'
import GamePage from './pages/game/GamePage'
import MicroBreakPage from './pages/game/MicroBreakPage'
import DebriefPage from './pages/game/DebriefPage'
import AdminDashboard from './pages/admin/DashboardPage'

export default function App() {
  const path = window.location.pathname

  // Admin routes
  if (path.startsWith('/admin')) {
    return <AdminDashboard />
  }

  // Game routes — phase-based rendering
  return <GameShell />
}

function GameShell() {
  const phase = useGameStore((s) => s.phase)

  switch (phase) {
    case 'welcome':
      return <WelcomePage />
    case 'onboarding':
      return <WelcomePage /> // Onboarding embedded in welcome flow
    case 'encoding':
      return <EncodingPage />
    case 'playing':
      return <GamePage />
    case 'microbreak':
      return <MicroBreakPage />
    case 'block_end':
      return <MicroBreakPage />
    case 'debrief':
      return <DebriefPage />
    case 'complete':
      return <CompletePage />
    default:
      return <WelcomePage />
  }
}

function CompletePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Thank You!</h1>
        <p className="text-slate-600">
          You have completed the experiment. Please inform the experimenter.
        </p>
      </div>
    </div>
  )
}
