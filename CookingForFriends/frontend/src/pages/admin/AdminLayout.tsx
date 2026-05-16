import { Suspense } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Settings,
  CalendarClock,
  MousePointerClick,
  Volume2,
} from 'lucide-react'
import ErrorBoundary from '../../components/ErrorBoundary'

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/config', label: 'Config', icon: Settings },
  { to: '/admin/timeline-editor', label: 'Runtime Plan', icon: CalendarClock },
  { to: '/admin/encoding-hotspots', label: 'Encoding Hotspots', icon: MousePointerClick },
  { to: '/admin/sounds', label: 'Sounds', icon: Volume2 },
]

function isNavActive(to: string, pathname: string): boolean {
  if (to === '/admin') {
    return pathname === '/admin' || pathname === '/dashboard' || pathname.startsWith('/admin/participant/')
  }
  return pathname === to
}

function LayoutLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm">
        Loading…
      </div>
    </div>
  )
}

export default function AdminLayout() {
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <h1 className="text-xl font-bold text-slate-800">🍳 Cooking for Friends</h1>
        </div>
        <nav className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isNavActive(to, pathname)
                  ? 'border-cooking-500 text-cooking-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <ErrorBoundary>
        <Suspense fallback={<LayoutLoadingFallback />}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
