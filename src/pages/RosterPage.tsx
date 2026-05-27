import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getGameById } from '../data/games'
import { entrantDisplayName } from '../lib/models'
import { entrantMatchesFormat, getActiveTournament, useArenaStore } from '../state/arenaStore'

export function RosterPage() {
  const navigate = useNavigate()

  const tournament = useArenaStore((s) => getActiveTournament(s))
  const playerProfiles = useArenaStore((s) => s.playerProfiles)
  const customGames = useArenaStore((s) => s.customGames)
  const setActiveTournamentId = useArenaStore((s) => s.setActiveTournamentId)
  const addPlayerEntrant = useArenaStore((s) => s.addPlayerEntrant)
  const addTeamEntrant = useArenaStore((s) => s.addTeamEntrant)
  const removeEntrant = useArenaStore((s) => s.removeEntrant)
  const toggleCheckIn = useArenaStore((s) => s.toggleCheckIn)
  const generateBracket = useArenaStore((s) => s.generateBracket)

  const [gamertag, setGamertag] = useState('')
  const [teamName, setTeamName] = useState('')
  const [player1, setPlayer1] = useState('')
  const [player2, setPlayer2] = useState('')

  const game = useMemo(
    () => (tournament ? getGameById(tournament.gameId, customGames) : undefined),
    [customGames, tournament],
  )

  if (!tournament) {
    return (
      <div className="space-y-4">
        <div className="text-xl font-semibold">Roster / Check-in</div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
          No active tournament selected. Create one to start signing players in.
        </div>
        <button
          type="button"
          onClick={() => navigate('/create')}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Create Tournament
        </button>
      </div>
    )
  }

  const entrants = tournament.entrants.filter((e) => entrantMatchesFormat(e, tournament.format))
  const checkedInCount = entrants.filter((e) => e.checkedIn).length

  function normalizeGamertag(value: string): string {
    return value.trim().toLowerCase()
  }

  function recordForGamertag(gamertag: string): string {
    const key = normalizeGamertag(gamertag)
    if (!key) return '—'
    const p = playerProfiles[key]
    const wins = p?.wins ?? 0
    const losses = p?.losses ?? 0
    return `${wins}-${losses}`
  }

  function addEntrant() {
    if (!tournament) return

    if (tournament.format === '1v1') {
      addPlayerEntrant(tournament.id, gamertag)
      setGamertag('')
      return
    }

    addTeamEntrant(tournament.id, { teamName, player1, player2 })
    setTeamName('')
    setPlayer1('')
    setPlayer2('')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">Roster / Check-in</div>
          <div className="text-sm text-slate-300">
            {tournament.name} • {game?.name ?? 'Unknown game'} • {tournament.format}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-sm text-slate-300">
            Checked-in: <span className="font-semibold text-slate-100">{checkedInCount}</span> / {entrants.length}
          </div>
          <button
            type="button"
            onClick={() => {
              generateBracket(tournament.id)
              navigate('/bracket')
            }}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Generate Bracket
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
          <div className="text-sm font-semibold">Add Entrant</div>

          {tournament.format === '1v1' ? (
            <div>
              <label className="block text-xs font-medium text-slate-300">Gamertag</label>
              <input
                value={gamertag}
                onChange={(e) => setGamertag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addEntrant()
                  }
                }}
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm"
                placeholder="Player gamertag"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-300">Team Name (optional)</label>
                <input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm"
                  placeholder="Team name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300">Player 1</label>
                <input
                  value={player1}
                  onChange={(e) => setPlayer1(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm"
                  placeholder="Gamertag"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300">Player 2</label>
                <input
                  value={player2}
                  onChange={(e) => setPlayer2(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addEntrant()
                    }
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm"
                  placeholder="Gamertag"
                />
              </div>
            </>
          )}

          <button
            type="button"
            onClick={addEntrant}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm font-semibold hover:bg-slate-900/50"
          >
            Add (Checked-in)
          </button>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="text-sm font-semibold">Entrants</div>

          {entrants.length ? (
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-950/40 text-left text-xs text-slate-300">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Record</th>
                    <th className="px-3 py-2">Checked-in</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {entrants.map((e) => (
                    <tr key={e.id} className="border-t border-slate-800">
                      <td className="px-3 py-2">
                        <div className="text-slate-100">{entrantDisplayName(e)}</div>
                        {e.type === 'team' ? (
                          <div className="mt-1 text-xs text-slate-400">
                            {e.player1} ({recordForGamertag(e.player1)}) • {e.player2} ({recordForGamertag(e.player2)})
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-slate-200">
                        {e.type === 'player' ? recordForGamertag(e.gamertag) : `${recordForGamertag(e.player1)} / ${recordForGamertag(e.player2)}`}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => toggleCheckIn(tournament.id, e.id)}
                          className={[
                            'inline-flex items-center rounded-full border px-2 py-1 text-xs',
                            e.checkedIn
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                              : 'border-slate-700 bg-slate-950/30 text-slate-300',
                          ].join(' ')}
                        >
                          {e.checkedIn ? 'Yes' : 'No'}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeEntrant(tournament.id, e.id)}
                          className="rounded-md border border-slate-800 bg-slate-950/50 px-2 py-1 text-xs text-slate-200 hover:bg-slate-900/50"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-3 text-sm text-slate-300">No entrants yet.</div>
          )}

          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="text-xs text-slate-400">Tip: If nobody is checked-in, bracket uses everyone.</div>
            <button
              type="button"
              onClick={() => {
                setActiveTournamentId(null)
                navigate('/create')
              }}
              className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm hover:bg-slate-900/50"
            >
              New Tournament
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
