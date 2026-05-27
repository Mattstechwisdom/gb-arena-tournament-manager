import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getAllGames, getGameById } from '../data/games'
import type { BracketType, Game, Rules, TournamentFormat } from '../lib/models'
import { GameCover } from '../components/GameCover'
import { DEFAULT_RULES, useArenaStore } from '../state/arenaStore'

function recommendedBracketTypeForGame(game: Game | undefined): BracketType {
  const genres = (game?.genres ?? []).map((g) => g.toLowerCase())
  if (genres.includes('fighting')) return 'double_elimination'
  if (genres.includes('card') || genres.includes('strategy')) return 'swiss'
  if (genres.includes('racing')) return 'round_robin'
  return 'single_elimination'
}

export function CreateTournamentPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const preselectedGameId = params.get('gameId')

  const createTournament = useArenaStore((s) => s.createTournament)
  const gameFormatOverrides = useArenaStore((s) => s.gameFormatOverrides)
  const gameBracketTypeOverrides = useArenaStore((s) => s.gameBracketTypeOverrides)
  const customGames = useArenaStore((s) => s.customGames)

  const [name, setName] = useState('')
  const [format, setFormat] = useState<TournamentFormat>('1v1')
  const [bracketType, setBracketType] = useState<BracketType>('single_elimination')
  const [ticketCost, setTicketCost] = useState<number>(0)

  const [gameQuery, setGameQuery] = useState('')
  const [selectedGameId, setSelectedGameId] = useState<string>(
    preselectedGameId && getGameById(preselectedGameId, customGames)
      ? preselectedGameId
      : getAllGames(customGames)[0]?.id ?? '',
  )

  const [rules, setRules] = useState<Rules>(() => ({ ...DEFAULT_RULES }))
  const [banInput, setBanInput] = useState('')

  useEffect(() => {
    if (preselectedGameId && getGameById(preselectedGameId, customGames)) {
      setSelectedGameId(preselectedGameId)
    }
  }, [customGames, preselectedGameId])

  const allowedFormats = useMemo(() => {
    const formats = selectedGameId ? gameFormatOverrides[selectedGameId] : undefined
    if (formats?.length) return formats
    return ['1v1', '2v2'] as TournamentFormat[]
  }, [gameFormatOverrides, selectedGameId])

  const allowedBracketTypes = useMemo(() => {
    const types = selectedGameId ? gameBracketTypeOverrides[selectedGameId] : undefined
    if (types?.length) return types
    return ['single_elimination', 'double_elimination', 'swiss', 'round_robin'] as BracketType[]
  }, [gameBracketTypeOverrides, selectedGameId])

  useEffect(() => {
    if (!allowedFormats.includes(format)) {
      setFormat(allowedFormats[0] ?? '1v1')
    }
  }, [allowedFormats, format])

  useEffect(() => {
    if (!allowedBracketTypes.includes(bracketType)) {
      setBracketType(allowedBracketTypes[0] ?? 'single_elimination')
    }
  }, [allowedBracketTypes, bracketType])

  useEffect(() => {
    setBracketType(recommendedBracketTypeForGame(getGameById(selectedGameId, customGames)))
  }, [customGames, selectedGameId])

  const selectedGame = useMemo(() => getGameById(selectedGameId, customGames), [customGames, selectedGameId])

  const allGames = useMemo(() => getAllGames(customGames), [customGames])

  const gameResults = useMemo(() => {
    const q = gameQuery.trim().toLowerCase()
    if (!q) return []
    return allGames.filter((g) => g.name.toLowerCase().includes(q)).slice(0, 10)
  }, [allGames, gameQuery])

  function addBannedCharacter() {
    const next = banInput.trim()
    if (!next) return
    if (rules.bannedCharacters.some((x) => x.toLowerCase() === next.toLowerCase())) {
      setBanInput('')
      return
    }
    setRules({
      ...rules,
      bannedCharacters: [...rules.bannedCharacters, next],
    })
    setBanInput('')
  }

  function removeBannedCharacter(value: string) {
    setRules({
      ...rules,
      bannedCharacters: rules.bannedCharacters.filter((x) => x !== value),
    })
  }

  function onCreate() {
    if (!selectedGameId) return

    createTournament({
      name,
      gameId: selectedGameId,
      format,
      bracketType,
      rules,
      ticketCost,
    })

    navigate('/roster')
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold">Create Tournament</div>
        <div className="text-sm text-slate-300">Set up the game, format, and rules. You can edit finances later in Reporting.</div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <div>
            <label className="block text-xs font-medium text-slate-300">Tournament Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Friday Night Bracket"
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as TournamentFormat)}
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
              {allowedFormats.includes('1v1') ? <option value="1v1">1v1</option> : null}
              {allowedFormats.includes('2v2') ? <option value="2v2">2v2</option> : null}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Bracket Style</label>
            <select
              value={bracketType}
              onChange={(e) => setBracketType(e.target.value as BracketType)}
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
              {allowedBracketTypes.includes('single_elimination') ? (
                <option value="single_elimination">Single Elimination</option>
              ) : null}
              {allowedBracketTypes.includes('double_elimination') ? (
                <option value="double_elimination">Double Elimination</option>
              ) : null}
              {allowedBracketTypes.includes('swiss') ? <option value="swiss">Swiss</option> : null}
              {allowedBracketTypes.includes('round_robin') ? <option value="round_robin">Round Robin</option> : null}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Ticket Cost (per entrant)</label>
            <input
              type="number"
              min={0}
              step={1}
              value={Number.isFinite(ticketCost) ? ticketCost : 0}
              onChange={(e) => setTicketCost(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>

          <button
            type="button"
            onClick={onCreate}
            className={[
              'w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white',
              'hover:bg-indigo-500 active:bg-indigo-700',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500/40',
            ].join(' ')}
          >
            Create Tournament
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[240px_1fr]">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">Game</label>
              <input
                value={gameQuery}
                onChange={(e) => setGameQuery(e.target.value)}
                placeholder="Search games…"
                className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              {gameResults.length ? (
                <div className="max-h-64 overflow-auto rounded-lg border border-slate-800 bg-slate-950/60">
                  {gameResults.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setSelectedGameId(g.id)
                        setGameQuery('')
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-slate-900/50"
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-xs font-medium text-slate-300">Selected Game</div>
              {selectedGame ? (
                <div className="mt-3 grid gap-4 sm:grid-cols-[180px_1fr]">
                  <GameCover game={selectedGame} className="max-w-[220px]" />
                  <div className="space-y-1">
                    <div className="text-lg font-semibold">{selectedGame.name}</div>
                    <div className="text-sm text-slate-300">{selectedGame.genres?.join(' • ') ?? '—'}</div>
                    <div className="text-sm text-slate-400">Cover visuals are generated (no bundled official art).</div>
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-sm text-slate-300">Pick a game to continue.</div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="text-sm font-semibold">Rules</div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-300">Best Of</label>
                <select
                  value={rules.bestOf}
                  onChange={(e) => setRules({ ...rules, bestOf: Number(e.target.value) as 1 | 3 | 5 })}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm"
                >
                  <option value={1}>1</option>
                  <option value={3}>3</option>
                  <option value={5}>5</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300">Timer (minutes)</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={rules.timerMinutes ?? ''}
                  onChange={(e) => {
                    const n = e.target.value === '' ? null : Number(e.target.value)
                    setRules({ ...rules, timerMinutes: Number.isFinite(n as number) ? n : null })
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={rules.characterBansEnabled}
                    onChange={(e) => setRules({ ...rules, characterBansEnabled: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-950"
                  />
                  Character bans enabled
                </label>
              </div>
            </div>

            {!rules.characterBansEnabled ? (
              <div className="mt-2 text-xs text-slate-500">Enable this to add banned characters.</div>
            ) : null}

            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-300">Stage List (optional)</label>
              <textarea
                value={rules.stageList}
                onChange={(e) => setRules({ ...rules, stageList: e.target.value })}
                placeholder="One per line…"
                rows={4}
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm"
              />
            </div>

            {rules.characterBansEnabled ? (
              <div className="mt-4">
                <label className="block text-xs font-medium text-slate-300">Banned Characters</label>
                <div className="mt-1 flex gap-2">
                  <input
                    value={banInput}
                    onChange={(e) => setBanInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addBannedCharacter()
                      }
                    }}
                    placeholder="Add character…"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={addBannedCharacter}
                    className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm hover:bg-slate-900/50"
                  >
                    Add
                  </button>
                </div>

                {rules.bannedCharacters.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {rules.bannedCharacters.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => removeBannedCharacter(c)}
                        className="rounded-full border border-slate-800 bg-slate-950/50 px-3 py-1 text-xs text-slate-200 hover:bg-slate-900/50"
                        title="Remove"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-slate-400">No banned characters yet.</div>
                )}
              </div>
            ) : null}

            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-300">Additional Rules / Notes</label>
              <textarea
                value={rules.notes}
                onChange={(e) => setRules({ ...rules, notes: e.target.value })}
                rows={4}
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
