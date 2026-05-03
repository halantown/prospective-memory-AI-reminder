/** App root — path-based routing with session recovery. */

import { useEffect, useState } from 'react'
import { useGameStore } from './stores/gameStore'
import { getCookingDefinitions, getSessionStatus } from './services/api'
import type { Phase } from './types'
import { frontendPhaseForBackend, isMainExperimentPhase, renderPhaseFor } from './utils/phase'
import WelcomePage from './pages/game/WelcomePage'
import ConsentPage from './pages/game/ConsentPage'
import DemographicsPage from './pages/game/DemographicsPage'
import IntroductionPage from './pages/game/IntroductionPage'
import MSEPrePage from './pages/game/MSEPrePage'
import GamePage from './pages/game/GamePage'
import PostQuestionnairePage from './pages/game/PostQuestionnairePage'
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
  const initializeCookingDefinitions = useGameStore((s) => s.initializeCookingDefinitions)
  const [recoveryBlocked, setRecoveryBlocked] = useState(false)

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

  // Warn before tab close during active gameplay or early phases
  useEffect(() => {
    const activePhases: Phase[] = ['playing', 'consent', 'introduction', 'MAIN_EXPERIMENT', 'CONSENT']
    if (!activePhases.includes(phase)) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [phase])

  // Recover session from sessionStorage on mount
  useEffect(() => {
    if (sessionId) return
    const urlToken = new URLSearchParams(window.location.search).get('token')?.trim().toUpperCase()
    const saved = sessionStorage.getItem('cff_session')
    if (urlToken && saved) {
      try {
        const data = JSON.parse(saved)
        if (data.token !== urlToken) {
          sessionStorage.removeItem('cff_session')
          return
        }
      } catch {
        sessionStorage.removeItem('cff_session')
        return
      }
    }
    if (!saved) return

    try {
      const data = JSON.parse(saved)
      if (!data.session_id || !data.participant_id || !data.condition) return

      // Restore session and fetch current status
      setSession(data)
      if (!data.cooking_definitions) {
        getCookingDefinitions(data.session_id)
          .then(initializeCookingDefinitions)
          .catch(() => {
            console.warn('[App] Failed to restore cooking definitions')
            if (isMainExperimentPhase(data.current_phase)) {
              setRecoveryBlocked(true)
            }
          })
      }
      getSessionStatus(data.session_id)
        .then((status) => {
          const resolvedPhase: Phase = frontendPhaseForBackend(status.phase)
          if (status.status === 'completed') {
            setPhase('complete')
          } else if (status.status === 'in_progress') {
            setPhase(resolvedPhase)
          }
        })
        .catch(() => {
          if (isMainExperimentPhase(data.current_phase)) {
            setRecoveryBlocked(true)
            return
          }
          sessionStorage.removeItem('cff_session')
        })
    } catch {
      sessionStorage.removeItem('cff_session')
    }
  }, [])

  if (recoveryBlocked) {
    return <ConnectionIssuePage participantId={useGameStore.getState().participantId} />
  }

  switch (renderPhaseFor(phase)) {
    case 'welcome':
      return <WelcomePage />
    case 'consent':
      return <ConsentPage />
    case 'demographics':
      return <DemographicsPage />
    case 'mse_pre':
      return <MSEPrePage />
    case 'introduction':
      return <IntroductionPage />
    case 'playing':
      return <GamePage />
    case 'post_questionnaire':
      return <PostQuestionnairePage />
    case 'debrief':
      return <DebriefPage />
    case 'complete':
      return <CompletePage />
    default:
      return <WelcomePage />
  }
}

function ConnectionIssuePage({ participantId }: { participantId: string | null }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-red-300 bg-white p-6 text-center shadow-xl">
        <h1 className="text-xl font-bold text-slate-900">Connection issue</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Connection issue. Please contact the experimenter.
        </p>
        {participantId && (
          <p className="mt-4 rounded bg-slate-100 px-3 py-2 font-mono text-xs text-slate-600">
            Participant: {participantId}
          </p>
        )}
      </div>
    </div>
  )
}

function CompletePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Thank You!</h1>
        <p className="text-slate-600">
          You have completed the session. Please inform the experimenter.
        </p>
      </div>
    </div>
  )
}
