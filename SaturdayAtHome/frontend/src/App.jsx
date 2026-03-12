import GameShell from './components/GameShell'
import Dashboard from './components/Dashboard'
import ManagePage from './components/ManagePage'
import ConfigPage from './components/ConfigPage'

export default function App() {
  const path = window.location.pathname
  if (path === '/dashboard') return <Dashboard />
  if (path === '/manage') return <ManagePage />
  if (path === '/config') return <ConfigPage />
  return <GameShell />
}
