/** App root — path-based routing with session recovery. */

import { useEffect } from 'react'
import { useGameStore } from './stores/gameStore'
import { getSessionStatus } from './services/api'
import type { Phase } from './types'
import WelcomePage from './pages/game/WelcomePage'
import EncodingPage from './pages/game/EncodingPage'
import GamePage from './pages/game/GamePage'
import MicroBreakPage from './pages/game/MicroBreakPage'
import DebriefPage from './pages/game/DebriefPage'
import AdminDashboard from './pages/admin/DashboardPage'
import ConfigPage from './pages/admin/ConfigPage'
import TimelineEditorPage from './pages/admin/TimelineEditorPage'
import ParticipantControlPage from './pages/admin/ParticipantControlPage'

export default function App() {
  const path = window.location.pathname

  // Admin routes — specific routes before generic /admin catch-all
  if (path.startsWith('/admin/participant/')) {
    const participantId = path.split('/admin/participant/')[1]?.split('/')[0]
    if (participantId) return <ParticipantControlPage participantId={participantId} />
  }
  if (path.startsWith('/dashboard') || path.startsWith('/admin')) {
    return <AdminDashboard />
  }
  if (path.startsWith('/config')) {
    return <ConfigPage />
  }
  if (path.startsWith('/timeline-editor')) {
    return <TimelineEditorPage />
  }

  // Game routes — phase-based rendering
  return <GameShell />
}

function GameShell() {
  const phase = useGameStore((s) => s.phase)
  const sessionId = useGameStore((s) => s.sessionId)
  const setSession = useGameStore((s) => s.setSession)
  const setPhase = useGameStore((s) => s.setPhase)
  const setBlockNumber = useGameStore((s) => s.setBlockNumber)

  // Prevent browser back-button during experiment
  useEffect(() => {
    if (phase === 'welcome' || phase === 'complete') return
    window.history.pushState(null, '', window.location.href)
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [phase])

  // Warn before tab close during active gameplay
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'encoding') return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [phase])

  // Recover session from sessionStorage on mount
  useEffect(() => {
    if (sessionId) return
    const saved = sessionStorage.getItem('cff_session')
    if (!saved) return

    try {
      const data = JSON.parse(saved)
      if (!data.session_id || !data.participant_id || !data.group || !data.condition_order) return

      // Restore session and fetch current status
      setSession(data)
      getSessionStatus(data.session_id)
        .then((status) => {
          if (status.current_block) setBlockNumber(status.current_block)
          // Map backend status/phase to frontend phase
          const phaseMap: Record<string, Phase> = {
            pending: 'encoding',
            encoding: 'encoding',
            playing: 'playing',
            microbreak: 'microbreak',
            completed: 'encoding', // next block starts with encoding
          }
          const resolvedPhase: Phase = phaseMap[status.phase || ''] || 'welcome'
          if (status.status === 'completed') {
            setPhase('complete')
          } else if (status.status === 'in_progress') {
            setPhase(resolvedPhase)
          }
        })
        .catch(() => {
          // Session invalid — clear and go to welcome
          sessionStorage.removeItem('cff_session')
        })
    } catch {
      sessionStorage.removeItem('cff_session')
    }
  }, [])

  switch (phase) {
    case 'welcome':
      return <WelcomePage />
    case 'onboarding':
      return <WelcomePage />
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
