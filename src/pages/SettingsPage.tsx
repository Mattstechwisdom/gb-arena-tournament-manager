import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getAllGames, getGameById } from '../data/games'
import { GameCover } from '../components/GameCover'
import { getActiveTournament, useArenaStore } from '../state/arenaStore'
import type { BracketType, Rules, TournamentFormat } from '../lib/models'

type ArenaBridge = Window['arena']

function getArenaBridge(): ArenaBridge | null {
  const w = window as unknown as { arena?: ArenaBridge }
  return w.arena ?? null
}

export function SettingsPage() {
  const location = useLocation()
  const navigate = useNavigate()

  const tournament = useArenaStore((s) => getActiveTournament(s))

  const customGames = useArenaStore((s) => s.customGames)

  const customGameCovers = useArenaStore((s) => s.customGameCovers)
  const setCustomGameCover = useArenaStore((s) => s.setCustomGameCover)
  const gameFormatOverrides = useArenaStore((s) => s.gameFormatOverrides)
  const setGameFormatsForGame = useArenaStore((s) => s.setGameFormatsForGame)
  const gameBracketTypeOverrides = useArenaStore((s) => s.gameBracketTypeOverrides)
  const setGameBracketTypesForGame = useArenaStore((s) => s.setGameBracketTypesForGame)
  const importBackup = useArenaStore((s) => s.importBackup)
  const updateRules = useArenaStore((s) => s.updateRules)

  const [section, setSection] = useState<'home' | 'gameInfo' | 'tournamentTypes' | 'rules' | 'backup'>('home')

  const reselect = (location.state as { __reselect?: number } | null | undefined)?.__reselect
  useEffect(() => {
    if (!reselect) return
    setSection('home')
  }, [reselect])

  const [gameQuery, setGameQuery] = useState('')
  const [selectedGameId, setSelectedGameId] = useState<string>(getAllGames(customGames)[0]?.id ?? '')

  const [bulkCoverMessage, setBulkCoverMessage] = useState<string>('')

  const [banInput, setBanInput] = useState('')

  const [backupMessage, setBackupMessage] = useState<string>('')

  const allGames = useMemo(() => getAllGames(customGames), [customGames])

  const selectedGame = useMemo(
    () => (selectedGameId ? getGameById(selectedGameId, customGames) : undefined),
    [customGames, selectedGameId],
  )
  const isCustomCover = Boolean(selectedGameId && customGameCovers[selectedGameId])

  const selectedFormats = useMemo(() => {
    const override = selectedGameId ? gameFormatOverrides[selectedGameId] : undefined
    return override?.length ? override : (['1v1', '2v2'] as TournamentFormat[])
  }, [gameFormatOverrides, selectedGameId])

  const selectedBracketTypes = useMemo(() => {
    const override = selectedGameId ? gameBracketTypeOverrides[selectedGameId] : undefined
    return override?.length
      ? override
      : (['single_elimination', 'double_elimination', 'swiss', 'round_robin'] as BracketType[])
  }, [gameBracketTypeOverrides, selectedGameId])

  const gameResults = useMemo(() => {
    const q = gameQuery.trim().toLowerCase()
    if (!q) return []
    return allGames.filter((g) => g.name.toLowerCase().includes(q)).slice(0, 10)
  }, [allGames, gameQuery])

  useEffect(() => {
    if (!allGames.length) return
    if (selectedGameId && getGameById(selectedGameId, customGames)) return
    setSelectedGameId(allGames[0]!.id)
  }, [allGames, customGames, selectedGameId])

  const canPickImage = Boolean(getArenaBridge()?.files?.pickImageDataUrl)
  const canPickCoverFolder = Boolean(getArenaBridge()?.files?.pickImageFolderDataUrls)
  const canBackup = Boolean(getArenaBridge()?.files?.saveTextFile && getArenaBridge()?.files?.openTextFile)

  async function importCover() {
    if (!selectedGameId) return

    try {
      const arena = getArenaBridge()
      if (!arena?.files?.pickImageDataUrl) return

      const result = await arena.files.pickImageDataUrl()
      if (!result || result.canceled) return

      setCustomGameCover(selectedGameId, result.dataUrl)
    } catch {
      // ignore (browser preview / dialog canceled)
    }
  }

  async function importCoverFolder() {
    setBulkCoverMessage('')

    try {
      const arena = getArenaBridge()
      if (!arena?.files?.pickImageFolderDataUrls) return

      const result = await arena.files.pickImageFolderDataUrls()
      if (!result || result.canceled) return

      const keyToGameId = new Map<string, string>()
      for (const g of allGames) {
        keyToGameId.set(normalizeCoverKey(g.id), g.id)
        keyToGameId.set(normalizeCoverKey(g.name), g.id)
      }

      let imported = 0
      for (const f of result.files) {
        const key = normalizeCoverKey(stripExtension(f.fileName))
        const gameId = keyToGameId.get(key)
        if (!gameId) continue
        if (customGameCovers[gameId]) continue
        setCustomGameCover(gameId, f.dataUrl)
        imported += 1
      }

      setBulkCoverMessage(imported > 0 ? `Imported ${imported} cover(s).` : 'No new covers were imported.')
    } catch {
      setBulkCoverMessage('Cover folder import failed.')
    }
  }

  function toggleFormat(format: TournamentFormat, nextChecked: boolean) {
    if (!selectedGameId) return

    const current = selectedFormats
    const next = nextChecked ? [...current, format] : current.filter((f) => f !== format)
    const uniq = uniqueFormats(next)
    if (uniq.length === 0) return
    setGameFormatsForGame(selectedGameId, uniq)
  }

  function toggleBracketType(bracketType: BracketType, nextChecked: boolean) {
    if (!selectedGameId) return

    const current = selectedBracketTypes
    const next = nextChecked ? [...current, bracketType] : current.filter((t) => t !== bracketType)
    const uniq = uniqueBracketTypes(next)
    if (uniq.length === 0) return
    setGameBracketTypesForGame(selectedGameId, uniq)
  }

  function addBannedCharacter(nextRules: Rules) {
    if (!tournament) return
    const next = banInput.trim()
    if (!next) return
    if (nextRules.bannedCharacters.some((x) => x.toLowerCase() === next.toLowerCase())) {
      setBanInput('')
      return
    }
    updateRules(tournament.id, { ...nextRules, bannedCharacters: [...nextRules.bannedCharacters, next] })
    setBanInput('')
  }

  function removeBannedCharacter(nextRules: Rules, value: string) {
    if (!tournament) return
    updateRules(tournament.id, { ...nextRules, bannedCharacters: nextRules.bannedCharacters.filter((x) => x !== value) })
  }

  async function exportBackupToFile() {
    setBackupMessage('')
    const arena = getArenaBridge()
    if (!arena?.files?.saveTextFile) return

    try {
      const data = useArenaStore.getState().toPersisted()
      const json = JSON.stringify(data, null, 2)
      const stamp = new Date().toISOString().slice(0, 10)
      const result = await arena.files.saveTextFile({
        defaultPath: `gb-arena-backup-${stamp}.json`,
        content: json,
      })
      if (!result?.canceled) setBackupMessage('Backup exported.')
    } catch {
      setBackupMessage('Backup export failed.')
    }
  }

  async function importBackupFromFile() {
    setBackupMessage('')
    const arena = getArenaBridge()
    if (!arena?.files?.openTextFile) return

    try {
      const result = await arena.files.openTextFile()
      if (!result || result.canceled) return

      const raw = JSON.parse(result.content)
      const ok = importBackup(raw)
      setBackupMessage(ok ? 'Backup restored.' : 'Invalid backup file.')
    } catch {
      setBackupMessage('Backup restore failed.')
    }
  }

  function removeCover() {
    if (!selectedGameId) return
    setCustomGameCover(selectedGameId, null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">Settings</div>
          <div className="text-sm text-slate-300">
            {section === 'home'
              ? 'Choose a settings section.'
              : section === 'gameInfo'
                ? 'Manage game info like custom cover art.'
                : section === 'tournamentTypes'
                  ? 'Choose what match formats and bracket styles a game supports.'
                  : section === 'rules'
                    ? 'Edit rules for the active tournament.'
                  : 'Backup and restore your saved tournaments.'}
          </div>
        </div>

        {section !== 'home' ? (
          <button
            type="button"
            onClick={() => {
              setSection('home')
              setBackupMessage('')
            }}
            className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm font-semibold hover:bg-slate-900/50"
          >
            Back
          </button>
        ) : null}
      </div>

      {section === 'home' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SettingsCard
            title="Attendees"
            description={tournament ? `Edit roster/check-in (${tournament.name}).` : 'Edit roster/check-in for the active tournament.'}
            disabled={!tournament}
            onClick={() => navigate('/roster')}
          />

          <SettingsCard
            title="Game Info"
            description="Import custom cover art and manage game details."
            onClick={() => setSection('gameInfo')}
          />

          <SettingsCard
            title="Tournament Types"
            description="Pick which formats and bracket styles each game supports."
            onClick={() => setSection('tournamentTypes')}
          />

          <SettingsCard
            title="Rules"
            description={tournament ? `Edit rules (bans, stages, best-of) for ${tournament.name}.` : 'Edit rules for the active tournament.'}
            disabled={!tournament}
            onClick={() => setSection('rules')}
          />

          <SettingsCard
            title="Backup / Restore"
            description="Export or restore all saved tournaments (includes brackets/winners)."
            onClick={() => setSection('backup')}
          />
        </div>
      ) : null}

      {section === 'rules' ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="text-sm font-semibold">Rules</div>
          <div className="mt-2 text-sm text-slate-300">Update match rules like best-of, timer, stages, and character bans.</div>

          {!tournament ? (
            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-300">
              No active tournament selected.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300">Best Of</label>
                  <select
                    value={tournament.rules.bestOf}
                    onChange={(e) => updateRules(tournament.id, { ...tournament.rules, bestOf: Number(e.target.value) as 1 | 3 | 5 })}
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
                    value={tournament.rules.timerMinutes ?? ''}
                    onChange={(e) => {
                      const n = e.target.value === '' ? null : Number(e.target.value)
                      updateRules(tournament.id, { ...tournament.rules, timerMinutes: Number.isFinite(n as number) ? n : null })
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={tournament.rules.characterBansEnabled}
                      onChange={(e) => updateRules(tournament.id, { ...tournament.rules, characterBansEnabled: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-950"
                    />
                    Character bans enabled
                  </label>
                </div>
              </div>

              {!tournament.rules.characterBansEnabled ? (
                <div className="text-xs text-slate-500">Enable this to add banned characters.</div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-300">Banned Characters</label>
                  <div className="mt-1 flex gap-2">
                    <input
                      value={banInput}
                      onChange={(e) => setBanInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addBannedCharacter(tournament.rules)
                        }
                      }}
                      placeholder="Add character…"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => addBannedCharacter(tournament.rules)}
                      className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm hover:bg-slate-900/50"
                    >
                      Add
                    </button>
                  </div>

                  {tournament.rules.bannedCharacters.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {tournament.rules.bannedCharacters.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => removeBannedCharacter(tournament.rules, c)}
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
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300">Stage List (optional)</label>
                <textarea
                  value={tournament.rules.stageList}
                  onChange={(e) => updateRules(tournament.id, { ...tournament.rules, stageList: e.target.value })}
                  placeholder="One per line…"
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300">Additional Rules / Notes</label>
                <textarea
                  value={tournament.rules.notes}
                  onChange={(e) => updateRules(tournament.id, { ...tournament.rules, notes: e.target.value })}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}
        </div>
      ) : null}

      {section === 'gameInfo' ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="text-sm font-semibold">Game Info</div>
          <div className="mt-2 text-sm text-slate-300">Select a game and import your own cover art.</div>

          <div className="mt-4 grid gap-4 md:grid-cols-[240px_1fr]">
            <div className="space-y-4">
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
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-xs font-medium text-slate-300">Selected Game</div>
              {selectedGame ? (
                <div className="mt-3 grid gap-4 sm:grid-cols-[180px_1fr]">
                  <GameCover game={selectedGame} className="max-w-[220px]" />
                  <div className="space-y-2">
                    <div>
                      <div className="text-lg font-semibold">{selectedGame.name}</div>
                      <div className="text-sm text-slate-300">{selectedGame.genres?.join(' • ') ?? '—'}</div>
                    </div>

                    <div className="text-xs text-slate-400">Cover: {isCustomCover ? 'Custom' : 'Generated'}</div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!canPickImage || !selectedGameId}
                        onClick={importCover}
                        className={[
                          'rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm font-semibold',
                          'hover:bg-slate-900/50',
                          'disabled:cursor-default disabled:opacity-40 disabled:hover:bg-slate-950/50',
                        ].join(' ')}
                      >
                        Import Cover Art
                      </button>

                      <button
                        type="button"
                        disabled={!canPickCoverFolder}
                        onClick={importCoverFolder}
                        className={[
                          'rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm font-semibold',
                          'hover:bg-slate-900/50',
                          'disabled:cursor-default disabled:opacity-40 disabled:hover:bg-slate-950/50',
                        ].join(' ')}
                      >
                        Import Cover Folder
                      </button>

                      <button
                        type="button"
                        disabled={!isCustomCover}
                        onClick={removeCover}
                        className={[
                          'rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm',
                          'hover:bg-slate-900/50',
                          'disabled:cursor-default disabled:opacity-40 disabled:hover:bg-slate-950/50',
                        ].join(' ')}
                      >
                        Remove Custom Cover
                      </button>
                    </div>

                    {bulkCoverMessage ? <div className="text-xs text-slate-400">{bulkCoverMessage}</div> : null}

                    {!canPickImage ? (
                      <div className="text-xs text-slate-500">
                        Importing cover art is available in the desktop app (Electron). The browser preview can’t open native file pickers.
                      </div>
                    ) : null}

                    {!canPickCoverFolder ? (
                      <div className="text-xs text-slate-500">
                        Importing a cover folder is available in the desktop app (Electron). The browser preview can’t open native folder pickers.
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-sm text-slate-300">Pick a game to edit.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {section === 'tournamentTypes' ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="text-sm font-semibold">Tournament Types</div>
          <div className="mt-2 text-sm text-slate-300">
            Enable which match formats and bracket styles are available when creating tournaments for a game.
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[240px_1fr]">
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
                <div className="mt-3 space-y-3">
                  <div className="text-lg font-semibold">{selectedGame.name}</div>

                  <div>
                    <div className="text-xs font-medium text-slate-300">Match Format</div>
                    <div className="mt-2 flex flex-wrap gap-4">
                      <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={selectedFormats.includes('1v1')}
                          onChange={(e) => toggleFormat('1v1', e.target.checked)}
                          className="h-4 w-4 rounded border-slate-700 bg-slate-950"
                        />
                        1v1
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={selectedFormats.includes('2v2')}
                          onChange={(e) => toggleFormat('2v2', e.target.checked)}
                          className="h-4 w-4 rounded border-slate-700 bg-slate-950"
                        />
                        2v2
                      </label>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">At least one format must be enabled.</div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-300">Bracket Style</div>
                    <div className="mt-2 flex flex-wrap gap-4">
                      <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={selectedBracketTypes.includes('single_elimination')}
                          onChange={(e) => toggleBracketType('single_elimination', e.target.checked)}
                          className="h-4 w-4 rounded border-slate-700 bg-slate-950"
                        />
                        Single Elimination
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={selectedBracketTypes.includes('double_elimination')}
                          onChange={(e) => toggleBracketType('double_elimination', e.target.checked)}
                          className="h-4 w-4 rounded border-slate-700 bg-slate-950"
                        />
                        Double Elimination
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={selectedBracketTypes.includes('swiss')}
                          onChange={(e) => toggleBracketType('swiss', e.target.checked)}
                          className="h-4 w-4 rounded border-slate-700 bg-slate-950"
                        />
                        Swiss
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={selectedBracketTypes.includes('round_robin')}
                          onChange={(e) => toggleBracketType('round_robin', e.target.checked)}
                          className="h-4 w-4 rounded border-slate-700 bg-slate-950"
                        />
                        Round Robin
                      </label>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">At least one bracket style must be enabled.</div>
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-sm text-slate-300">Pick a game to edit.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {section === 'backup' ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="text-sm font-semibold">Backup / Restore</div>
          <div className="mt-2 text-sm text-slate-300">
            Export or restore your saved tournaments (includes brackets and match results).
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canBackup}
              onClick={exportBackupToFile}
              className={[
                'rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm font-semibold',
                'hover:bg-slate-900/50',
                'disabled:cursor-default disabled:opacity-40 disabled:hover:bg-slate-950/50',
              ].join(' ')}
            >
              Export Backup
            </button>

            <button
              type="button"
              disabled={!canBackup}
              onClick={importBackupFromFile}
              className={[
                'rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm font-semibold',
                'hover:bg-slate-900/50',
                'disabled:cursor-default disabled:opacity-40 disabled:hover:bg-slate-950/50',
              ].join(' ')}
            >
              Restore Backup
            </button>
          </div>

          {backupMessage ? <div className="mt-3 text-sm text-slate-300">{backupMessage}</div> : null}

          {!canBackup ? (
            <div className="mt-3 text-xs text-slate-500">
              Backup/restore is available in the desktop app (Electron). The browser preview can’t open native file dialogs.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function SettingsCard({
  title,
  description,
  onClick,
  disabled,
}: {
  title: string
  description: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={Boolean(disabled)}
      onClick={onClick}
      className={[
        'rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-left',
        'hover:bg-slate-900/30',
        'disabled:cursor-default disabled:opacity-40 disabled:hover:bg-slate-950/40',
      ].join(' ')}
    >
      <div className="text-sm font-semibold text-slate-100">{title}</div>
      <div className="mt-1 text-sm text-slate-300">{description}</div>
    </button>
  )
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

function stripExtension(fileName: string): string {
  const i = fileName.lastIndexOf('.')
  return i > 0 ? fileName.slice(0, i) : fileName
}

function normalizeCoverKey(value: string): string {
  // Normalize to a filename-friendly key so cover packs can be named by id or game name.
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .replace(/(coverart|boxart|cover|box)$/, '')
}
