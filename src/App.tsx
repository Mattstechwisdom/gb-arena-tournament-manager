import { HashRouter, NavLink, Route, Routes, useMatch, useNavigate, useResolvedPath } from 'react-router-dom'
import { CreateTournamentPage } from './pages/CreateTournamentPage'
import { GameLibraryPage } from './pages/GameLibraryPage'
import { RosterPage } from './pages/RosterPage'
import { BracketPage } from './pages/BracketPage'
import { ReportingPage } from './pages/ReportingPage'
import { SettingsPage } from './pages/SettingsPage'
import { useArenaStore } from './state/arenaStore'

export default function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  )
}

function AppShell() {
  const isHydrated = useArenaStore((s) => s.isHydrated)
  const tournaments = useArenaStore((s) => s.tournaments)
  const activeTournamentId = useArenaStore((s) => s.activeTournamentId)
  const setActiveTournamentId = useArenaStore((s) => s.setActiveTournamentId)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <aside className="w-64 shrink-0 border-r border-slate-800 bg-slate-950/40 p-4">
          <div className="text-lg font-semibold">GB Arena</div>
          <div className="mt-1 text-xs text-slate-400">Tournament Manager</div>

          <nav className="mt-6 space-y-1">
            <SideLink to="/">Game Library</SideLink>
            <SideLink to="/create">Create Tournament</SideLink>
            <SideLink to="/roster">Roster</SideLink>
            <SideLink to="/bracket">Bracket</SideLink>
            <SideLink to="/reporting">Reporting</SideLink>

            <div className="mt-6 border-t border-slate-800 pt-4">
              <div className="px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Settings</div>
              <div className="mt-1 space-y-1">
                <SideLink to="/settings">Settings</SideLink>
              </div>
            </div>
          </nav>

          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
            <div className="text-xs font-semibold text-slate-300">Active Tournament</div>
            <select
              value={activeTournamentId ?? ''}
              onChange={(e) => setActiveTournamentId(e.target.value || null)}
              className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/50 px-2 py-2 text-sm"
            >
              <option value="">None</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <div className="mt-2 text-xs text-slate-500">Saved locally on this PC.</div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="border-b border-slate-800 bg-slate-950/20 px-4 py-3">
            <div className="text-sm text-slate-300">Clean, offline tournament setup • brackets • reporting</div>
          </header>

          <div className="p-4">
            {!isHydrated ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
                Loading…
              </div>
            ) : (
              <Routes>
                <Route path="/" element={<GameLibraryPage />} />
                <Route path="/create" element={<CreateTournamentPage />} />
                <Route path="/roster" element={<RosterPage />} />
                <Route path="/bracket" element={<BracketPage />} />
                <Route path="/reporting" element={<ReportingPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function SideLink({ to, children }: { to: string; children: string }) {
  const navigate = useNavigate()
  const resolved = useResolvedPath(to)
  const match = useMatch({ path: resolved.pathname, end: to === '/' })
  const isActive = Boolean(match)

  return (
    <NavLink
      to={to}
      onClick={(e) => {
        // If the user clicks the current page again, force a reselect navigation.
        // Pages can use location.state.__reselect to reset to their “root” view.
        if (!isActive) return
        e.preventDefault()
        navigate(to, { replace: true, state: { __reselect: Date.now() } })
      }}
      className={({ isActive }) =>
        [
          'block rounded-lg px-3 py-2 text-sm font-medium',
          isActive ? 'bg-slate-900/60 text-slate-50 ring-1 ring-white/10' : 'text-slate-300 hover:bg-slate-900/40',
        ].join(' ')
      }
      end={to === '/'}
    >
      {children}
    </NavLink>
  )
}
