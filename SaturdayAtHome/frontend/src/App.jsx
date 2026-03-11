import GameShell from './components/GameShell'
import Dashboard from './components/Dashboard'

export default function App() {
  const path = window.location.pathname
  if (path === '/dashboard') return <Dashboard />
  return <GameShell />
}
