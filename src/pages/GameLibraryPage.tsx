import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllGames } from '../data/games'
import { GameCover } from '../components/GameCover'
import type { BracketType, Game, TournamentFormat } from '../lib/models'
import { useArenaStore } from '../state/arenaStore'

const GENRE_ORDER = [
  'Fighting',
  'Battle Royale',
  'Shooter',
  'MOBA',
  'Sports',
  'Racing',
  'Party',
  'Strategy',
  'Puzzle',
  'Sandbox',
  'Platform',
  'Card',
  'Rhythm',
] as const

const GAME_ROW_STEP_PX = 420

const DEFAULT_FORMATS: TournamentFormat[] = ['1v1', '2v2']
const DEFAULT_BRACKET_TYPES: BracketType[] = ['single_elimination', 'double_elimination', 'swiss', 'round_robin']

const TOURNEY_STYLE_PRESETS: Array<{
  id: string
  label: string
  formats: TournamentFormat[]
  bracketTypes: BracketType[]
}> = [
  {
    id: 'fgc',
    label: 'Fighting (1v1, Double Elim)',
    formats: ['1v1'],
    bracketTypes: ['double_elimination', 'single_elimination'],
  },
  {
    id: 'smash',
    label: 'Smash (1v1 + 2v2, Double Elim)',
    formats: ['1v1', '2v2'],
    bracketTypes: ['double_elimination', 'single_elimination'],
  },
  {
    id: 'duos',
    label: 'Doubles / Duos (2v2)',
    formats: ['2v2'],
    bracketTypes: ['single_elimination', 'double_elimination'],
  },
  {
    id: 'card',
    label: 'Card / Strategy (1v1, Swiss)',
    formats: ['1v1'],
    bracketTypes: ['swiss'],
  },
  {
    id: 'roundrobin',
    label: 'Racing / Party (1v1, Round Robin)',
    formats: ['1v1'],
    bracketTypes: ['round_robin'],
  },
]

type ArenaBridge = Window['arena']

function getArenaBridge(): ArenaBridge | null {
  const w = window as unknown as { arena?: ArenaBridge }
  return w.arena ?? null
}

export function GameLibraryPage() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const tournaments = useArenaStore((s) => s.tournaments)
  const customGames = useArenaStore((s) => s.customGames)
  const addCustomGame = useArenaStore((s) => s.addCustomGame)
  const updateCustomGame = useArenaStore((s) => s.updateCustomGame)
  const removeCustomGame = useArenaStore((s) => s.removeCustomGame)

  const customGameCovers = useArenaStore((s) => s.customGameCovers)
  const setCustomGameCover = useArenaStore((s) => s.setCustomGameCover)

  const gameFormatOverrides = useArenaStore((s) => s.gameFormatOverrides)
  const setGameFormatsForGame = useArenaStore((s) => s.setGameFormatsForGame)
  const gameBracketTypeOverrides = useArenaStore((s) => s.gameBracketTypeOverrides)
  const setGameBracketTypesForGame = useArenaStore((s) => s.setGameBracketTypesForGame)

  const customGameIds = useMemo(() => new Set(customGames.map((g) => g.id)), [customGames])

  const canPickImage = Boolean(getArenaBridge()?.files?.pickImageDataUrl)

  const [libraryMessage, setLibraryMessage] = useState<string>('')

  const [newGameName, setNewGameName] = useState('')
  const [newGameGenre, setNewGameGenre] = useState('')
  const [newGamePlatforms, setNewGamePlatforms] = useState('')

  const [draftFormats, setDraftFormats] = useState<TournamentFormat[]>(['1v1'])
  const [draftBracketTypes, setDraftBracketTypes] = useState<BracketType[]>([...DEFAULT_BRACKET_TYPES])
  const [draftCoverDataUrl, setDraftCoverDataUrl] = useState<string | null>(null)
  const [tourneyPresetId, setTourneyPresetId] = useState<string>('')

  const [matchTypesDropdownOpen, setMatchTypesDropdownOpen] = useState(false)
  const [bracketStylesDropdownOpen, setBracketStylesDropdownOpen] = useState(false)

  const [editingGameId, setEditingGameId] = useState<string | null>(null)
  const [editGameName, setEditGameName] = useState('')
  const [editGameGenre, setEditGameGenre] = useState('')
  const [editGamePlatforms, setEditGamePlatforms] = useState('')

  const [isGameEditorOpen, setIsGameEditorOpen] = useState(false)

  const [coverViewGameId, setCoverViewGameId] = useState<string | null>(null)
  const [tourneySettingsGameId, setTourneySettingsGameId] = useState<string | null>(null)

  const allGames = useMemo(() => getAllGames(customGames), [customGames])

  const q = query.trim().toLowerCase()

  const recentlyPlayed = useMemo(() => {
    if (tournaments.length === 0) return [] as Game[]

    const latestByGameId = new Map<string, string>()
    for (const t of tournaments) {
      const prev = latestByGameId.get(t.gameId)
      if (!prev || t.createdAt > prev) latestByGameId.set(t.gameId, t.createdAt)
    }

    const gameIds = Array.from(latestByGameId.entries())
      .sort((a, b) => b[1].localeCompare(a[1]))
      .map(([id]) => id)

    const games = gameIds
      .map((id) => allGames.find((g) => g.id === id))
      .filter((g): g is Game => Boolean(g))

    return games
  }, [allGames, tournaments])

  const genreRows = useMemo(() => {
    const byGenre = new Map<string, Game[]>()

    for (const g of allGames) {
      const genre = g.genres?.[0] ?? 'Other'
      const arr = byGenre.get(genre) ?? []
      arr.push(g)
      byGenre.set(genre, arr)
    }

    for (const arr of byGenre.values()) {
      arr.sort((a, b) => a.name.localeCompare(b.name))
    }

    const ordered: Array<{ title: string; games: Game[] }> = []

    for (const genre of GENRE_ORDER) {
      const arr = byGenre.get(genre)
      if (arr?.length) ordered.push({ title: genre, games: arr })
    }

    const remainingGenres = Array.from(byGenre.keys())
      .filter((k) => !isOrderedGenre(k))
      .sort((a, b) => a.localeCompare(b))

    for (const genre of remainingGenres) {
      const arr = byGenre.get(genre)
      if (arr?.length) ordered.push({ title: genre, games: arr })
    }

    return ordered
  }, [allGames])

  const filteredRecentlyPlayed = useMemo(() => {
    if (!q) return recentlyPlayed
    return recentlyPlayed.filter((g) => matchesQuery(g, q))
  }, [recentlyPlayed, q])

  const filteredGenreRows = useMemo(() => {
    if (!q) return genreRows
    return genreRows
      .map((row) => ({
        ...row,
        games: row.games.filter((g) => matchesQuery(g, q)),
      }))
      .filter((row) => row.games.length > 0)
  }, [genreRows, q])

  function clearPanels() {
    setIsGameEditorOpen(false)
    setEditingGameId(null)
    setCoverViewGameId(null)
    setTourneySettingsGameId(null)
    setLibraryMessage('')
    setMatchTypesDropdownOpen(false)
    setBracketStylesDropdownOpen(false)
  }

  function openAddGameEditor() {
    setLibraryMessage('')
    setEditingGameId(null)
    setNewGameName('')
    setNewGameGenre('')
    setNewGamePlatforms('')
    setDraftFormats(['1v1'])
    setDraftBracketTypes([...DEFAULT_BRACKET_TYPES])
    setDraftCoverDataUrl(null)
    setTourneyPresetId('')
    setCoverViewGameId(null)
    setTourneySettingsGameId(null)
    setIsGameEditorOpen(true)
  }

  function closeGameEditor(clearMessage = true) {
    setIsGameEditorOpen(false)
    setEditingGameId(null)
    if (clearMessage) setLibraryMessage('')
  }

  function parsePlatforms(raw: string): string[] {
    return raw
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
  }

  function onAddGame() {
    setLibraryMessage('')

    const id = addCustomGame({
      name: newGameName,
      genre: newGameGenre,
      platforms: parsePlatforms(newGamePlatforms),
    })

    if (!id) {
      setLibraryMessage('Enter a game name.')
      return
    }

    setGameFormatsForGame(id, draftFormats)
    setGameBracketTypesForGame(id, draftBracketTypes)
    if (draftCoverDataUrl) setCustomGameCover(id, draftCoverDataUrl)

    setNewGameName('')
    setNewGameGenre('')
    setNewGamePlatforms('')
    setDraftFormats(['1v1'])
    setDraftBracketTypes([...DEFAULT_BRACKET_TYPES])
    setDraftCoverDataUrl(null)
    setTourneyPresetId('')
    setIsGameEditorOpen(false)
    setLibraryMessage('Game added.')
  }

  function startEditGame(gameId: string) {
    setLibraryMessage('')
    const g = allGames.find((x) => x.id === gameId)
    if (!g) return
    if (!customGameIds.has(gameId)) {
      setLibraryMessage('Built-in games can’t be edited yet. Add your own game to edit info.')
      return
    }

    setEditingGameId(gameId)
    setCoverViewGameId(null)
    setTourneySettingsGameId(null)
    setIsGameEditorOpen(true)
    setEditGameName(g.name)
    setEditGameGenre(g.genres?.[0] ?? '')
    setEditGamePlatforms((g.platforms ?? []).join(', '))

    setDraftFormats(gameFormatOverrides[gameId] ?? [...DEFAULT_FORMATS])
    setDraftBracketTypes(gameBracketTypeOverrides[gameId] ?? [...DEFAULT_BRACKET_TYPES])
    setDraftCoverDataUrl(customGameCovers[gameId] ?? null)
    setTourneyPresetId('')
  }

  function saveEditGame() {
    if (!editingGameId) return
    setLibraryMessage('')

    const ok = updateCustomGame(editingGameId, {
      name: editGameName,
      genre: editGameGenre,
      platforms: parsePlatforms(editGamePlatforms),
    })

    if (!ok) {
      setLibraryMessage('Could not save game. Check the name field.')
      return
    }

    setGameFormatsForGame(editingGameId, draftFormats)
    setGameBracketTypesForGame(editingGameId, draftBracketTypes)
    setCustomGameCover(editingGameId, draftCoverDataUrl)

    setEditingGameId(null)
    setIsGameEditorOpen(false)
    setLibraryMessage('Game updated.')
  }

  function applyTourneyPreset(presetId: string) {
    setTourneyPresetId(presetId)
    const preset = TOURNEY_STYLE_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    setDraftFormats(uniqueFormats(preset.formats))
    setDraftBracketTypes(uniqueBracketTypes(preset.bracketTypes))
  }

  function toggleDraftFormat(format: TournamentFormat, nextChecked: boolean) {
    setDraftFormats((prev) => {
      const next = nextChecked ? [...prev, format] : prev.filter((f) => f !== format)
      const uniq = uniqueFormats(next)
      if (uniq.length === 0) return prev
      return uniq
    })
  }

  function toggleDraftBracketType(type: BracketType, nextChecked: boolean) {
    setDraftBracketTypes((prev) => {
      const next = nextChecked ? [...prev, type] : prev.filter((t) => t !== type)
      const uniq = uniqueBracketTypes(next)
      if (uniq.length === 0) return prev
      return uniq
    })
  }

  async function pickDraftCover() {
    setLibraryMessage('')
    const arena = getArenaBridge()
    if (!arena?.files?.pickImageDataUrl) return

    try {
      const result = await arena.files.pickImageDataUrl()
      if (!result || result.canceled) return
      setDraftCoverDataUrl(result.dataUrl)
    } catch {
      setLibraryMessage('Cover selection failed.')
    }
  }

  async function editCover(gameId: string) {
    setLibraryMessage('')
    const arena = getArenaBridge()
    if (!arena?.files?.pickImageDataUrl) return

    try {
      const result = await arena.files.pickImageDataUrl()
      if (!result || result.canceled) return
      setCustomGameCover(gameId, result.dataUrl)
      setLibraryMessage('Cover updated.')
    } catch {
      setLibraryMessage('Cover update failed.')
    }
  }

  function viewCover(gameId: string) {
    setLibraryMessage('')
    setIsGameEditorOpen(false)
    setCoverViewGameId(gameId)
    setEditingGameId(null)
    setTourneySettingsGameId(null)
  }

  function openTourneySettings(gameId: string) {
    setLibraryMessage('')
    setIsGameEditorOpen(false)
    setTourneySettingsGameId(gameId)
    setEditingGameId(null)
    setCoverViewGameId(null)
  }

  function toggleFormat(gameId: string, format: TournamentFormat, nextChecked: boolean) {
    const current = gameFormatOverrides[gameId] ?? (['1v1', '2v2'] as TournamentFormat[])
    const next = nextChecked ? [...current, format] : current.filter((f) => f !== format)
    const uniq = uniqueFormats(next)
    if (uniq.length === 0) return
    setGameFormatsForGame(gameId, uniq)
  }

  function toggleBracketType(gameId: string, bracketType: BracketType, nextChecked: boolean) {
    const current =
      gameBracketTypeOverrides[gameId] ??
      (['single_elimination', 'double_elimination', 'swiss', 'round_robin'] as BracketType[])
    const next = nextChecked ? [...current, bracketType] : current.filter((t) => t !== bracketType)
    const uniq = uniqueBracketTypes(next)
    if (uniq.length === 0) return
    setGameBracketTypesForGame(gameId, uniq)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">Game Library</div>
          <div className="text-sm text-slate-300">Pick a game to start a tournament.</div>
        </div>
        <div className="w-full max-w-sm">
          <label className="block text-xs font-medium text-slate-300">Search</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search games…"
            className={[
              'mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2',
              'text-sm text-slate-100 placeholder:text-slate-500',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500/40',
            ].join(' ')}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={openAddGameEditor}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Add Game
          </button>
          {!isGameEditorOpen && libraryMessage ? <div className="text-xs text-slate-400">{libraryMessage}</div> : null}
        </div>

        {coverViewGameId ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Cover Art</div>
              <button
                type="button"
                onClick={clearPanels}
                className="rounded-md border border-slate-800 bg-slate-950/50 px-2 py-1 text-xs hover:bg-slate-900/50"
              >
                Close
              </button>
            </div>

            {(() => {
              const game = allGames.find((g) => g.id === coverViewGameId)
              if (!game) return <div className="mt-2 text-sm text-slate-400">Game not found.</div>
              const customCover = customGameCovers[game.id]
              const base = import.meta.env.BASE_URL || '/'
              const normalized = base.endsWith('/') ? base : `${base}/`
              const src = customCover || `${normalized}covers/${encodeURIComponent(game.id)}.svg`
              return (
                <div className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr]">
                  <div className="aspect-[3/4] w-full max-w-[220px] overflow-hidden rounded-xl ring-1 ring-white/10">
                    <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">{game.name}</div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!canPickImage}
                        onClick={() => void editCover(game.id)}
                        className={[
                          'rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500',
                          'disabled:cursor-default disabled:opacity-40 disabled:hover:bg-indigo-600',
                        ].join(' ')}
                      >
                        Edit Cover Art
                      </button>
                    </div>
                    {!canPickImage ? (
                      <div className="text-xs text-slate-500">Cover editing is available in the desktop app (Electron).</div>
                    ) : null}
                  </div>
                </div>
              )
            })()}
          </div>
        ) : null}

        {tourneySettingsGameId ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Tourney Settings</div>
              <button
                type="button"
                onClick={clearPanels}
                className="rounded-md border border-slate-800 bg-slate-950/50 px-2 py-1 text-xs hover:bg-slate-900/50"
              >
                Close
              </button>
            </div>

            {(() => {
              const game = allGames.find((g) => g.id === tourneySettingsGameId)
              if (!game) return <div className="mt-2 text-sm text-slate-400">Game not found.</div>

              const formats = gameFormatOverrides[game.id] ?? (['1v1', '2v2'] as TournamentFormat[])
              const bracketTypes =
                gameBracketTypeOverrides[game.id] ??
                (['single_elimination', 'double_elimination', 'swiss', 'round_robin'] as BracketType[])

              return (
                <div className="mt-3 space-y-4">
                  <div className="text-sm font-semibold">{game.name}</div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-300">Tournament Types</div>
                    <div className="flex flex-wrap gap-3">
                      <label className="flex items-center gap-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={formats.includes('1v1')}
                          onChange={(e) => toggleFormat(game.id, '1v1', e.target.checked)}
                        />
                        1v1
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={formats.includes('2v2')}
                          onChange={(e) => toggleFormat(game.id, '2v2', e.target.checked)}
                        />
                        2v2
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-300">Bracket Styles</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="flex items-center gap-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={bracketTypes.includes('single_elimination')}
                          onChange={(e) => toggleBracketType(game.id, 'single_elimination', e.target.checked)}
                        />
                        Single Elimination
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={bracketTypes.includes('double_elimination')}
                          onChange={(e) => toggleBracketType(game.id, 'double_elimination', e.target.checked)}
                        />
                        Double Elimination
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={bracketTypes.includes('swiss')}
                          onChange={(e) => toggleBracketType(game.id, 'swiss', e.target.checked)}
                        />
                        Swiss
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={bracketTypes.includes('round_robin')}
                          onChange={(e) => toggleBracketType(game.id, 'round_robin', e.target.checked)}
                        />
                        Round Robin
                      </label>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        ) : null}
      </div>

      {isGameEditorOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => closeGameEditor()}
        >
          <div className="absolute inset-0 bg-slate-950/70" />
          <div
            className="relative w-full max-w-lg max-h-[80vh] overflow-auto rounded-xl border border-slate-800 bg-slate-950/95 p-4 backdrop-blur"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            <div className="text-sm font-semibold">{editingGameId ? 'Edit Game' : 'Add Game'}</div>
            <div className="mt-2 text-sm text-slate-300">
              {editingGameId
                ? 'Update your custom game info.'
                : 'Add a game to your library with a category and optional platforms.'}
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <div className="text-xs font-semibold text-slate-300">Cover Art</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[140px_1fr]">
                  <div className="aspect-[3/4] w-full overflow-hidden rounded-xl ring-1 ring-white/10">
                    {(() => {
                      const gameId = editingGameId
                      if (draftCoverDataUrl) {
                        return <img src={draftCoverDataUrl} alt="" className="h-full w-full object-cover" draggable={false} />
                      }
                      if (gameId) {
                        const base = import.meta.env.BASE_URL || '/'
                        const normalized = base.endsWith('/') ? base : `${base}/`
                        const src = customGameCovers[gameId] || `${normalized}covers/${encodeURIComponent(gameId)}.svg`
                        return <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
                      }
                      return <div className="h-full w-full bg-slate-900/40" />
                    })()}
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled={!canPickImage}
                      onClick={() => void pickDraftCover()}
                      className={[
                        'rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500',
                        'disabled:cursor-default disabled:opacity-40 disabled:hover:bg-indigo-600',
                      ].join(' ')}
                    >
                      Choose Cover Art
                    </button>
                    {!canPickImage ? (
                      <div className="text-xs text-slate-500">Cover editing is available in the desktop app (Electron).</div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300">Game Name</label>
                <input
                  value={editingGameId ? editGameName : newGameName}
                  onChange={(e) => (editingGameId ? setEditGameName(e.target.value) : setNewGameName(e.target.value))}
                  placeholder="e.g., Smash Remix"
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300">Category</label>
                <input
                  value={editingGameId ? editGameGenre : newGameGenre}
                  onChange={(e) => (editingGameId ? setEditGameGenre(e.target.value) : setNewGameGenre(e.target.value))}
                  placeholder="e.g., Fighting"
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300">Platforms (optional)</label>
                <input
                  value={editingGameId ? editGamePlatforms : newGamePlatforms}
                  onChange={(e) =>
                    editingGameId ? setEditGamePlatforms(e.target.value) : setNewGamePlatforms(e.target.value)
                  }
                  placeholder="Comma-separated, e.g., PC, Switch"
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <div className="text-xs font-semibold text-slate-300">Tournament Styles</div>

                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300">Preset</label>
                    <select
                      value={tourneyPresetId}
                      onChange={(e) => {
                        const next = e.target.value
                        if (!next) {
                          setTourneyPresetId('')
                          return
                        }
                        applyTourneyPreset(next)
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    >
                      <option value="">Custom</option>
                      {TOURNEY_STYLE_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-300">Match Types</div>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setMatchTypesDropdownOpen(!matchTypesDropdownOpen)}
                        className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      >
                        {draftFormats.length > 0 ? draftFormats.join(', ') : 'Select match types...'}
                      </button>
                      {matchTypesDropdownOpen ? (
                        <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/95 backdrop-blur">
                          <button
                            type="button"
                            onClick={() => toggleDraftFormat('1v1', !draftFormats.includes('1v1'))}
                            className={[
                              'block w-full px-3 py-2 text-left text-sm hover:bg-slate-900/60',
                              draftFormats.includes('1v1')
                                ? 'bg-indigo-600/20 text-indigo-200 font-semibold'
                                : 'text-slate-200',
                            ].join(' ')}
                          >
                            1v1
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleDraftFormat('2v2', !draftFormats.includes('2v2'))}
                            className={[
                              'block w-full px-3 py-2 text-left text-sm hover:bg-slate-900/60',
                              draftFormats.includes('2v2')
                                ? 'bg-indigo-600/20 text-indigo-200 font-semibold'
                                : 'text-slate-200',
                            ].join(' ')}
                          >
                            2v2
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-300">Bracket Styles</div>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setBracketStylesDropdownOpen(!bracketStylesDropdownOpen)}
                        className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      >
                        {draftBracketTypes.length > 0
                          ? draftBracketTypes
                              .map((t) =>
                                t === 'single_elimination'
                                  ? 'Single Elim'
                                  : t === 'double_elimination'
                                    ? 'Double Elim'
                                    : t === 'swiss'
                                      ? 'Swiss'
                                      : 'Round Robin',
                              )
                              .join(', ')
                          : 'Select bracket styles...'}
                      </button>
                      {bracketStylesDropdownOpen ? (
                        <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/95 backdrop-blur">
                          <button
                            type="button"
                            onClick={() =>
                              toggleDraftBracketType('single_elimination', !draftBracketTypes.includes('single_elimination'))
                            }
                            className={[
                              'block w-full px-3 py-2 text-left text-sm hover:bg-slate-900/60',
                              draftBracketTypes.includes('single_elimination')
                                ? 'bg-indigo-600/20 text-indigo-200 font-semibold'
                                : 'text-slate-200',
                            ].join(' ')}
                          >
                            Single Elimination
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              toggleDraftBracketType('double_elimination', !draftBracketTypes.includes('double_elimination'))
                            }
                            className={[
                              'block w-full px-3 py-2 text-left text-sm hover:bg-slate-900/60',
                              draftBracketTypes.includes('double_elimination')
                                ? 'bg-indigo-600/20 text-indigo-200 font-semibold'
                                : 'text-slate-200',
                            ].join(' ')}
                          >
                            Double Elimination
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleDraftBracketType('swiss', !draftBracketTypes.includes('swiss'))}
                            className={[
                              'block w-full px-3 py-2 text-left text-sm hover:bg-slate-900/60',
                              draftBracketTypes.includes('swiss')
                                ? 'bg-indigo-600/20 text-indigo-200 font-semibold'
                                : 'text-slate-200',
                            ].join(' ')}
                          >
                            Swiss
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleDraftBracketType('round_robin', !draftBracketTypes.includes('round_robin'))}
                            className={[
                              'block w-full px-3 py-2 text-left text-sm hover:bg-slate-900/60',
                              draftBracketTypes.includes('round_robin')
                                ? 'bg-indigo-600/20 text-indigo-200 font-semibold'
                                : 'text-slate-200',
                            ].join(' ')}
                          >
                            Round Robin
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                {editingGameId ? (
                  <>
                    <button
                      type="button"
                      onClick={saveEditGame}
                      className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => closeGameEditor()}
                      className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm font-semibold hover:bg-slate-900/50"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={onAddGame}
                      className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                    >
                      Add Game
                    </button>
                    <button
                      type="button"
                      onClick={() => closeGameEditor()}
                      className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm font-semibold hover:bg-slate-900/50"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>

              {libraryMessage ? <div className="text-xs text-slate-400">{libraryMessage}</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      {!q && filteredRecentlyPlayed.length > 0 ? (
        <GameRow
          title="Recently Played"
          games={filteredRecentlyPlayed}
          onSelect={(gameId) => navigate(`/create?gameId=${encodeURIComponent(gameId)}`)}
          customGameIds={customGameIds}
          canPickImage={canPickImage}
          onEditGameInfo={(gameId) => startEditGame(gameId)}
          onDeleteGame={(gameId) => {
            setLibraryMessage('')
            const result = removeCustomGame(gameId)
            if (!result.ok) setLibraryMessage(result.reason ?? 'Delete failed.')
            else setLibraryMessage('Game deleted.')
          }}
          onViewCover={(gameId) => viewCover(gameId)}
          onEditCover={(gameId) => void editCover(gameId)}
          onTourneySettings={(gameId) => openTourneySettings(gameId)}
        />
      ) : null}

      <div className="space-y-6">
        {filteredGenreRows.map((row) => (
          <GameRow
            key={row.title}
            title={row.title}
            games={row.games}
            onSelect={(gameId) => navigate(`/create?gameId=${encodeURIComponent(gameId)}`)}
            customGameIds={customGameIds}
            canPickImage={canPickImage}
            onEditGameInfo={(gameId) => startEditGame(gameId)}
            onDeleteGame={(gameId) => {
              setLibraryMessage('')
              const result = removeCustomGame(gameId)
              if (!result.ok) setLibraryMessage(result.reason ?? 'Delete failed.')
              else setLibraryMessage('Game deleted.')
            }}
            onViewCover={(gameId) => viewCover(gameId)}
            onEditCover={(gameId) => void editCover(gameId)}
            onTourneySettings={(gameId) => openTourneySettings(gameId)}
          />
        ))}
      </div>

      {filteredGenreRows.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
          No games matched your search.
        </div>
      ) : null}
    </div>
  )
}

function GameRow({
  title,
  games,
  onSelect,
  customGameIds,
  canPickImage,
  onEditGameInfo,
  onDeleteGame,
  onViewCover,
  onEditCover,
  onTourneySettings,
}: {
  title: string
  games: Game[]
  onSelect: (gameId: string) => void
  customGameIds: Set<string>
  canPickImage: boolean
  onEditGameInfo: (gameId: string) => void
  onDeleteGame: (gameId: string) => void
  onViewCover: (gameId: string) => void
  onEditCover: (gameId: string) => void
  onTourneySettings: (gameId: string) => void
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)
  const [pageCount, setPageCount] = useState(1)
  const [pageIndex, setPageIndex] = useState(0)

  const [openMenuGameId, setOpenMenuGameId] = useState<string | null>(null)
  const [confirmDeleteGameId, setConfirmDeleteGameId] = useState<string | null>(null)

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return

    const max = Math.max(0, el.scrollWidth - el.clientWidth)
    const left = el.scrollLeft > 1
    const right = el.scrollLeft < max - 1

    const nextPageCount = max > 0 ? Math.ceil(max / GAME_ROW_STEP_PX) + 1 : 1
    const nextPageIndex = clampInt(Math.round(el.scrollLeft / GAME_ROW_STEP_PX), 0, nextPageCount - 1)

    setCanLeft(left)
    setCanRight(right)
    setPageCount(nextPageCount)
    setPageIndex(nextPageIndex)
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return

    updateEdges()

    const onScroll = () => updateEdges()
    el.addEventListener('scroll', onScroll, { passive: true })

    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => updateEdges())
      ro.observe(el)
    }

    return () => {
      el.removeEventListener('scroll', onScroll)
      ro?.disconnect()
    }
  }, [updateEdges, games.length])

  function scrollByCards(direction: -1 | 1) {
    const el = scrollerRef.current
    if (!el) return

    el.scrollBy({ left: direction * GAME_ROW_STEP_PX, behavior: 'smooth' })
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-100">{title}</div>
      </div>

      <div className="relative">
        <button
          type="button"
          aria-label={`Scroll ${title} left`}
          disabled={!canLeft}
          onClick={() => scrollByCards(-1)}
          className={[
            'absolute left-0 top-1/2 z-10 -translate-y-1/2',
            'h-10 w-10 rounded-full border border-slate-800 bg-slate-950/70',
            'text-lg font-semibold text-slate-100',
            'hover:bg-slate-900/60 active:bg-slate-900/80',
            'disabled:cursor-default disabled:opacity-30 disabled:hover:bg-slate-950/70',
          ].join(' ')}
        >
          ‹
        </button>

        <div
          ref={scrollerRef}
          className={[
            'flex gap-4 overflow-x-auto scroll-smooth hide-scrollbar',
            'px-12 py-1',
          ].join(' ')}
        >
          {games.map((game) => {
            const isCustom = customGameIds.has(game.id)
            const menuOpen = openMenuGameId === game.id
            const confirmingDelete = confirmDeleteGameId === game.id

            return (
              <div key={game.id} className="group relative w-44 shrink-0 text-left">
                <button type="button" onClick={() => onSelect(game.id)} className="w-full">
                  <GameCover
                    game={game}
                    className="transition-transform duration-150 group-hover:-translate-y-0.5 group-active:translate-y-0"
                  />
                </button>

                <button
                  type="button"
                  aria-label="Game actions"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setConfirmDeleteGameId(null)
                    setOpenMenuGameId((prev) => (prev === game.id ? null : game.id))
                  }}
                  className={[
                    'absolute right-2 top-2 z-20',
                    'rounded-md border border-slate-800 bg-slate-950/70 px-2 py-1 text-sm font-semibold text-slate-100',
                    'hover:bg-slate-900/70 active:bg-slate-900/80',
                  ].join(' ')}
                >
                  ⋯
                </button>

                {menuOpen ? (
                  <div
                    className={[
                      'absolute right-2 top-10 z-30 w-40 overflow-hidden rounded-lg border border-slate-800',
                      'bg-slate-950/95 backdrop-blur',
                    ].join(' ')}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                  >
                    {!confirmingDelete ? (
                      <div className="p-1">
                        <MenuItem
                          disabled={!isCustom}
                          onClick={() => {
                            setOpenMenuGameId(null)
                            onEditGameInfo(game.id)
                          }}
                        >
                          Edit Game Info
                        </MenuItem>

                        <MenuItem
                          disabled={!canPickImage}
                          onClick={() => {
                            setOpenMenuGameId(null)
                            onEditCover(game.id)
                          }}
                        >
                          Edit Cover Art
                        </MenuItem>

                        <MenuItem
                          onClick={() => {
                            setOpenMenuGameId(null)
                            onViewCover(game.id)
                          }}
                        >
                          View Cover Art
                        </MenuItem>

                        <MenuItem
                          onClick={() => {
                            setOpenMenuGameId(null)
                            onTourneySettings(game.id)
                          }}
                        >
                          Tourney Settings
                        </MenuItem>

                        <div className="my-1 h-px bg-slate-800" />

                        <MenuItem
                          disabled={!isCustom}
                          tone="danger"
                          onClick={() => {
                            setConfirmDeleteGameId(game.id)
                          }}
                        >
                          Delete
                        </MenuItem>
                      </div>
                    ) : (
                      <div className="p-3">
                        <div className="text-xs font-semibold text-slate-200">Delete game?</div>
                        <div className="mt-1 text-xs text-slate-400">This can’t be undone.</div>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteGameId(null)}
                            className="flex-1 rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1 text-xs hover:bg-slate-900/60"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteGameId(null)
                              setOpenMenuGameId(null)
                              onDeleteGame(game.id)
                            }}
                            className="flex-1 rounded-md bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-500"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        {pageCount > 1 ? (
          <div className="pointer-events-none mt-2 flex items-center justify-center gap-1.5">
            {Array.from({ length: pageCount }).map((_, i) => (
              <span
                key={i}
                className={[
                  'h-1.5 w-1.5 rounded-full',
                  i === pageIndex ? 'bg-slate-200' : 'bg-slate-700',
                ].join(' ')}
              />
            ))}
          </div>
        ) : null}

        <button
          type="button"
          aria-label={`Scroll ${title} right`}
          disabled={!canRight}
          onClick={() => scrollByCards(1)}
          className={[
            'absolute right-0 top-1/2 z-10 -translate-y-1/2',
            'h-10 w-10 rounded-full border border-slate-800 bg-slate-950/70',
            'text-lg font-semibold text-slate-100',
            'hover:bg-slate-900/60 active:bg-slate-900/80',
            'disabled:cursor-default disabled:opacity-30 disabled:hover:bg-slate-950/70',
          ].join(' ')}
        >
          ›
        </button>
      </div>
    </section>
  )
}

function MenuItem({
  children,
  disabled,
  tone,
  onClick,
}: {
  children: string
  disabled?: boolean
  tone?: 'default' | 'danger'
  onClick: () => void
}) {
  const isDanger = tone === 'danger'
  return (
    <button
      type="button"
      disabled={Boolean(disabled)}
      onClick={onClick}
      className={[
        'block w-full rounded-md px-2 py-2 text-left text-xs font-semibold',
        isDanger ? 'text-rose-200 hover:bg-rose-500/10' : 'text-slate-200 hover:bg-slate-900/60',
        'disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.trunc(value)))
}

function matchesQuery(game: Game, q: string): boolean {
  if (!q) return true
  const name = game.name.toLowerCase()
  if (name.includes(q)) return true
  return (game.genres ?? []).some((g) => g.toLowerCase().includes(q))
}

function uniqueFormats(formats: TournamentFormat[]): TournamentFormat[] {
  const uniq = Array.from(new Set(formats))
  const ordered: TournamentFormat[] = []
  if (uniq.includes('1v1')) ordered.push('1v1')
  if (uniq.includes('2v2')) ordered.push('2v2')
  return ordered
}

function uniqueBracketTypes(types: BracketType[]): BracketType[] {
  const uniq = Array.from(new Set(types))
  const ordered: BracketType[] = []
  if (uniq.includes('single_elimination')) ordered.push('single_elimination')
  if (uniq.includes('double_elimination')) ordered.push('double_elimination')
  if (uniq.includes('swiss')) ordered.push('swiss')
  if (uniq.includes('round_robin')) ordered.push('round_robin')
  return ordered
}

function isOrderedGenre(value: string): value is (typeof GENRE_ORDER)[number] {
  return (GENRE_ORDER as readonly string[]).includes(value)
}
