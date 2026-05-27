import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getGameById } from '../data/games'
import { entrantDisplayName } from '../lib/models'
import type { BracketType } from '../lib/models'
import { entrantMatchesFormat, getActiveTournament, useArenaStore } from '../state/arenaStore'

export function BracketPage() {
  const navigate = useNavigate()

  const tournament = useArenaStore((s) => getActiveTournament(s))
  const customGames = useArenaStore((s) => s.customGames)
  const generateBracket = useArenaStore((s) => s.generateBracket)
  const setMatchWinner = useArenaStore((s) => s.setMatchWinner)

  const game = useMemo(
    () => (tournament ? getGameById(tournament.gameId, customGames) : undefined),
    [customGames, tournament],
  )

  const entrantById = useMemo(() => {
    const map = new Map<string, string>()
    if (!tournament) return map
    for (const e of tournament.entrants) {
      if (!entrantMatchesFormat(e, tournament.format)) continue
      map.set(e.id, entrantDisplayName(e))
    }
    return map
  }, [tournament])

  if (!tournament) {
    return (
      <div className="space-y-4">
        <div className="text-xl font-semibold">Bracket</div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
          No active tournament selected.
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

  const bracket = tournament.bracket

  if (!bracket) {
    return (
      <div className="space-y-4">
        <div>
          <div className="text-xl font-semibold">Bracket</div>
          <div className="text-sm text-slate-300">
            {tournament.name} • {game?.name ?? 'Unknown game'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
          No bracket generated yet. Go to Roster to add entrants, or generate now.
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate('/roster')}
            className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm hover:bg-slate-900/50"
          >
            Go to Roster
          </button>
          <button
            type="button"
            onClick={() => generateBracket(tournament.id)}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Generate Bracket
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">Bracket</div>
          <div className="text-sm text-slate-300">
            {tournament.name} • {game?.name ?? 'Unknown game'} • {tournament.format} • {bracketTypeLabel(bracket.type)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => generateBracket(tournament.id)}
          className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm hover:bg-slate-900/50"
        >
          Regenerate
        </button>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-800 bg-slate-950/30 p-4">
        <div className="flex min-w-max gap-6">
          {bracket.rounds.map((round, roundIndex) => (
            <div key={roundIndex} className="w-72">
              <div className="mb-2 text-xs font-semibold text-slate-300">
                {bracket.roundLabels?.[roundIndex] ?? roundTitle(bracket.type, bracket.rounds.length, roundIndex)}
              </div>
              <div className="space-y-3">
                {round.map((match) => {
                  const aId = match.sides[0].entrantId
                  const bId = match.sides[1].entrantId
                  const isByeA = !aId && Boolean(bId) && match.winnerEntrantId === bId
                  const isByeB = !bId && Boolean(aId) && match.winnerEntrantId === aId
                  const aName = aId ? (entrantById.get(aId) ?? 'Unknown') : isByeA ? 'BYE' : 'TBD'
                  const bName = bId ? (entrantById.get(bId) ?? 'Unknown') : isByeB ? 'BYE' : 'TBD'

                  const aIsWinner = match.winnerEntrantId && aId === match.winnerEntrantId
                  const bIsWinner = match.winnerEntrantId && bId === match.winnerEntrantId

                  const canSetWinner = Boolean(aId && bId)

                  return (
                    <div key={match.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className={['text-sm font-medium', aIsWinner ? 'text-emerald-200' : 'text-slate-100'].join(' ')}>{aName}</div>
                        {canSetWinner ? (
                          <button
                            type="button"
                            onClick={() => setMatchWinner(tournament.id, { roundIndex, matchIndex: match.matchIndex, winnerSlot: 0 })}
                            className={[
                              'rounded-md px-2 py-1 text-xs font-semibold',
                              aIsWinner
                                ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30'
                                : 'border border-slate-800 bg-slate-950/60 text-slate-200 hover:bg-slate-900/50',
                            ].join(' ')}
                          >
                            Win
                          </button>
                        ) : null}
                      </div>

                      <div className="my-2 h-px bg-slate-800" />

                      <div className="flex items-center justify-between gap-2">
                        <div className={['text-sm font-medium', bIsWinner ? 'text-emerald-200' : 'text-slate-100'].join(' ')}>{bName}</div>
                        {canSetWinner ? (
                          <button
                            type="button"
                            onClick={() => setMatchWinner(tournament.id, { roundIndex, matchIndex: match.matchIndex, winnerSlot: 1 })}
                            className={[
                              'rounded-md px-2 py-1 text-xs font-semibold',
                              bIsWinner
                                ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30'
                                : 'border border-slate-800 bg-slate-950/60 text-slate-200 hover:bg-slate-900/50',
                            ].join(' ')}
                          >
                            Win
                          </button>
                        ) : null}
                      </div>

                      {!canSetWinner && match.winnerEntrantId ? (
                        <div className="mt-2 text-xs text-slate-400">Auto-advanced</div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {bracket.type === 'round_robin' ? (
        <div className="text-xs text-slate-400">Tip: Round robin rounds are independent.</div>
      ) : (
        <div className="text-xs text-slate-400">Tip: Changing any earlier-round winner will clear later rounds.</div>
      )}
    </div>
  )
}

function bracketTypeLabel(type: BracketType): string {
  if (type === 'single_elimination') return 'Single Elimination'
  if (type === 'double_elimination') return 'Double Elimination'
  if (type === 'swiss') return 'Swiss'
  return 'Round Robin'
}

function roundTitle(type: BracketType, roundsCount: number, roundIndex: number): string {
  if (type !== 'single_elimination') return `Round ${roundIndex + 1}`
  const remaining = roundsCount - roundIndex
  if (remaining === 1) return 'Final'
  if (remaining === 2) return 'Semifinals'
  if (remaining === 3) return 'Quarterfinals'
  return `Round ${roundIndex + 1}`
}
