/** App root — path-based routing with session recovery. */

import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useGameStore } from './stores/gameStore'
import { getCookingDefinitions, getSessionStatus, setSessionToken } from './services/api'
import type { Phase } from './types'
import { frontendPhaseForBackend, isMainExperimentPhase, renderPhaseFor } from './utils/phase'
import ErrorBoundary from './components/ErrorBoundary'

// Early phase pages — static imports (lightweight, loaded sequentially)
import WelcomePage from './pages/game/WelcomePage'
import ConsentPage from './pages/game/ConsentPage'
import DemographicsPage from './pages/game/DemographicsPage'
import MSEPrePage from './pages/game/MSEPrePage'
import StoryIntroPage from './pages/game/StoryIntroPage'

// Heavy game pages — lazy loaded
const EncodingFlowPage = lazy(() => import('./pages/game/EncodingFlowPage'))
const TutorialFlowPage = lazy(() => import('./pages/game/TutorialFlowPage'))
const EveningTransitionPage = lazy(() => import('./pages/game/EveningTransitionPage'))
const GamePage = lazy(() => import('./pages/game/GamePage'))
const PostTestFlowPage = lazy(() => import('./pages/game/PostTestFlowPage'))
const DebriefPage = lazy(() => import('./pages/game/DebriefPage'))

// Admin pages — lazy loaded (separate user flow)
const AdminDashboard = lazy(() => import('./pages/admin/DashboardPage'))
const ConfigPage = lazy(() => import('./pages/admin/ConfigPage'))
const TimelineEditorPage = lazy(() => import('./pages/admin/TimelineEditorPage'))
const ParticipantControlPage = lazy(() => import('./pages/admin/ParticipantControlPage'))
const EncodingHotspotToolPage = lazy(() => import('./pages/admin/EncodingHotspotToolPage'))
const SoundPreviewPage = lazy(() => import('./pages/admin/SoundPreviewPage'))

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm">
        Loading...
      </div>
    </div>
  )
}

function ParticipantControlWrapper() {
  const { participantId } = useParams()
  if (!participantId) return null
  return <ParticipantControlPage participantId={participantId} />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Admin routes — lazy loaded, SPA navigation */}
        <Route path="/admin/participant/:participantId" element={<ErrorBoundary><Suspense fallback={<LoadingFallback />}><ParticipantControlWrapper /></Suspense></ErrorBoundary>} />
        <Route path="/admin/timeline-editor" element={<ErrorBoundary><Suspense fallback={<LoadingFallback />}><TimelineEditorPage /></Suspense></ErrorBoundary>} />
        <Route path="/admin/encoding-hotspots" element={<ErrorBoundary><Suspense fallback={<LoadingFallback />}><EncodingHotspotToolPage /></Suspense></ErrorBoundary>} />
        <Route path="/admin/sounds" element={<ErrorBoundary><Suspense fallback={<LoadingFallback />}><SoundPreviewPage /></Suspense></ErrorBoundary>} />
        <Route path="/timeline-editor" element={<ErrorBoundary><Suspense fallback={<LoadingFallback />}><TimelineEditorPage /></Suspense></ErrorBoundary>} />
        <Route path="/dashboard" element={<ErrorBoundary><Suspense fallback={<LoadingFallback />}><AdminDashboard /></Suspense></ErrorBoundary>} />
        <Route path="/admin" element={<ErrorBoundary><Suspense fallback={<LoadingFallback />}><AdminDashboard /></Suspense></ErrorBoundary>} />
        <Route path="/config" element={<ErrorBoundary><Suspense fallback={<LoadingFallback />}><ConfigPage /></Suspense></ErrorBoundary>} />
        {/* Game routes — phase-based rendering (not URL-driven) */}
        <Route path="*" element={<GameShell />} />
      </Routes>
    </BrowserRouter>
  )
}

function GameShell() {
  const phase = useGameStore((s) => s.phase)
  const sessionId = useGameStore((s) => s.sessionId)
  const participantId = useGameStore((s) => s.participantId)
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
    const activePhases: Phase[] = ['MAIN_EXPERIMENT', 'CONSENT']
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
    if (urlToken) {
      window.history.replaceState({}, '', window.location.pathname)
    }
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

      // Restore session token for API auth and fetch current status
      if (data.token) setSessionToken(data.token)
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
    return <ConnectionIssuePage participantId={participantId} />
  }

  const renderPhase = renderPhaseFor(phase)

  const page = (() => {
    switch (renderPhase) {
      case 'welcome':        return <WelcomePage />
      case 'consent':        return <ConsentPage />
      case 'demographics':   return <DemographicsPage />
      case 'mse_pre':        return <MSEPrePage />
      case 'story_intro':    return <StoryIntroPage />
      case 'encoding_flow':  return <EncodingFlowPage />
      case 'tutorial_flow':  return <TutorialFlowPage />
      case 'evening_transition': return <EveningTransitionPage />
      case 'playing':        return <GamePage />
      case 'session_transition': return <SessionTransitionPage />
      case 'post_test':      return <PostTestFlowPage />
      case 'debrief':        return <DebriefPage />
      case 'complete':       return <CompletePage />
    }
  })()

  return (
    <ErrorBoundary participantId={participantId}>
      <Suspense fallback={<LoadingFallback />}>
        <AnimatePresence mode="wait">
          <motion.div
            key={renderPhase}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {page}
          </motion.div>
        </AnimatePresence>
      </Suspense>
    </ErrorBoundary>
  )
}

function ConnectionIssuePage({ participantId }: { participantId: string | null }) {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-6 text-center shadow-lg">
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

function SessionTransitionPage() {
  const sessionId = useGameStore((s) => s.sessionId)
  const setPhase = useGameStore((s) => s.setPhase)
  const [loading, setLoading] = useState(false)

  const handleContinue = async () => {
    if (!sessionId || loading) return
    setLoading(true)
    try {
      const status = await getSessionStatus(sessionId)
      setPhase(frontendPhaseForBackend(status.phase))
    } catch {
      setPhase('POST_MANIP_CHECK')
    }
  }

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-6">
      <div className="bg-stone-100 rounded-lg shadow-xl p-8 max-w-md text-center">
        <h1 className="text-2xl font-bold text-slate-800 mb-3">Session Complete</h1>
        <p className="text-slate-600">
          The cooking session has ended. Please click Continue to proceed to the next part.
        </p>
        <button
          onClick={handleContinue}
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? 'Loading...' : 'Continue'}
        </button>
      </div>
    </div>
  )
}

function CompletePage() {
  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-6">
      <div className="bg-stone-100 rounded-lg shadow-xl p-8 max-w-md text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Thank You!</h1>
        <p className="text-slate-600">
          You have completed the session. Please inform the experimenter.
        </p>
      </div>
    </div>
  )
}
