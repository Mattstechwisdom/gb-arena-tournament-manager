import { create } from 'zustand'
import type {
  BracketType,
  Entrant,
  Finance,
  Game,
  PlayerProfile,
  PersistedStateV1,
  PrizePlacement,
  Rules,
  TeamEntrant,
  Tournament,
  TournamentFormat,
  VendorShare,
} from '../lib/models'
import { placementLabel } from '../lib/models'
import { newId } from '../lib/id'
import { GAMES } from '../data/games'
import {
  generateDoubleEliminationBracket,
  generateRoundRobinBracket,
  generateSingleEliminationBracket,
  generateSwissBracket,
  setDoubleElimMatchResult,
  setRoundRobinMatchResult,
  setSingleElimMatchResult,
  setSwissMatchResult,
} from '../lib/bracket'
import { createDemoPersistedStateV1 } from '../demo/demoData'

export interface CreateTournamentDraft {
  name: string
  gameId: string
  format: TournamentFormat
  bracketType: BracketType
  rules: Rules
  ticketCost: number
}

interface ArenaStoreState {
  isHydrated: boolean
  activeTournamentId: string | null
  tournaments: Tournament[]

  customGames: Game[]

  playerProfiles: Record<string, PlayerProfile>

  customGameCovers: Record<string, string>
  gameFormatOverrides: Record<string, TournamentFormat[]>
  gameBracketTypeOverrides: Record<string, BracketType[]>

  hydrate: () => Promise<void>
  toPersisted: () => PersistedStateV1

  setActiveTournamentId: (id: string | null) => void
  createTournament: (draft: CreateTournamentDraft) => string

  addCustomGame: (draft: { name: string; genre?: string; platforms?: string[] }) => string | null
  updateCustomGame: (gameId: string, draft: { name: string; genre?: string; platforms?: string[] }) => boolean
  removeCustomGame: (gameId: string) => { ok: boolean; reason?: string }

  setCustomGameCover: (gameId: string, dataUrl: string | null) => void
  setGameFormatsForGame: (gameId: string, formats: TournamentFormat[]) => void
  setGameBracketTypesForGame: (gameId: string, bracketTypes: BracketType[]) => void
  importBackup: (raw: unknown) => boolean

  addPlayerEntrant: (tournamentId: string, gamertag: string) => void
  addTeamEntrant: (tournamentId: string, team: { teamName: string; player1: string; player2: string }) => void
  removeEntrant: (tournamentId: string, entrantId: string) => void
  toggleCheckIn: (tournamentId: string, entrantId: string) => void

  generateBracket: (tournamentId: string) => void
  setMatchWinner: (
    tournamentId: string,
    args: { roundIndex: number; matchIndex: number; winnerSlot: 0 | 1; scoreA?: number | null; scoreB?: number | null },
  ) => void

  updateRules: (tournamentId: string, nextRules: Rules) => void
  updateFinance: (tournamentId: string, nextFinance: Finance) => void
  setTicketCost: (tournamentId: string, ticketCost: number) => void

  addVendor: (tournamentId: string, vendor: Omit<VendorShare, 'id'>) => void
  updateVendor: (tournamentId: string, vendor: VendorShare) => void
  removeVendor: (tournamentId: string, vendorId: string) => void

  addPrize: (tournamentId: string, prize: Omit<PrizePlacement, 'id'>) => void
  updatePrize: (tournamentId: string, prize: PrizePlacement) => void
  removePrize: (tournamentId: string, prizeId: string) => void
}

export const DEFAULT_RULES: Rules = {
  bestOf: 3,
  timerMinutes: null,
  stageList: '',
  characterBansEnabled: false,
  bannedCharacters: [],
  notes: '',
}

export const DEFAULT_FINANCE: Finance = {
  ticketCost: 0,
  vendors: [],
  prizes: [
    { id: newId('prize'), placement: 1, label: placementLabel(1), amount: 0 },
    { id: newId('prize'), placement: 2, label: placementLabel(2), amount: 0 },
    { id: newId('prize'), placement: 3, label: placementLabel(3), amount: 0 },
  ],
}

export const useArenaStore = create<ArenaStoreState>((set, get) => ({
  isHydrated: false,
  activeTournamentId: null,
  tournaments: [],

  customGames: [],

  playerProfiles: {},

  customGameCovers: {},
  gameFormatOverrides: {},
  gameBracketTypeOverrides: {},

  hydrate: async () => {
    try {
      const arena = (window as unknown as { arena?: Window['arena'] }).arena
      if (!arena?.appState?.get) {
        set({ isHydrated: true })
        return
      }

      const [raw, env] = await Promise.all([
        arena.appState.get(),
        arena.env?.get ? arena.env.get().catch(() => null) : Promise.resolve(null),
      ])

      const parsed = parsePersisted(raw)

      // Auto-seed demo data when running in the demo profile.
      if ((!parsed || parsed.tournaments.length === 0) && env?.profile === 'demo') {
        const ok = get().importBackup(createDemoPersistedStateV1())
        if (!ok) set({ isHydrated: true })
        return
      }

      if (!parsed) {
        set({ isHydrated: true })
        return
      }

      const activeIdExists = parsed.activeTournamentId
        ? parsed.tournaments.some((t) => t.id === parsed.activeTournamentId)
        : false

      set({
        isHydrated: true,
        tournaments: parsed.tournaments,
        playerProfiles: rebuildPlayerProfiles(parsed.playerProfiles ?? {}, parsed.tournaments),
        customGames: parsed.customGames ?? [],
        customGameCovers: parsed.customGameCovers ?? {},
        gameFormatOverrides: parsed.gameFormatOverrides ?? {},
        gameBracketTypeOverrides: parsed.gameBracketTypeOverrides ?? {},
        activeTournamentId: activeIdExists ? parsed.activeTournamentId : (parsed.tournaments[0]?.id ?? null),
      })
    } catch {
      set({ isHydrated: true })
    }
  },

  toPersisted: () => ({
    version: 1,
    activeTournamentId: get().activeTournamentId,
    tournaments: get().tournaments,
    playerProfiles: get().playerProfiles,
    customGames: get().customGames,
    customGameCovers: get().customGameCovers,
    gameFormatOverrides: get().gameFormatOverrides,
    gameBracketTypeOverrides: get().gameBracketTypeOverrides,
  }),

  setActiveTournamentId: (id) => set({ activeTournamentId: id }),

  setCustomGameCover: (gameId, dataUrl) => {
    const id = gameId.trim()
    if (!id) return

    set((state) => {
      const next = { ...state.customGameCovers }
      if (!dataUrl) {
        delete next[id]
      } else {
        next[id] = dataUrl
      }
      return { customGameCovers: next }
    })
  },

  setGameFormatsForGame: (gameId, formats) => {
    const id = gameId.trim()
    if (!id) return

    const nextFormats = uniqueFormats(formats)
    if (nextFormats.length === 0) return

    set((state) => {
      const next = { ...state.gameFormatOverrides }

      const isDefault = nextFormats.length === 2 && nextFormats.includes('1v1') && nextFormats.includes('2v2')
      if (isDefault) {
        delete next[id]
      } else {
        next[id] = nextFormats
      }

      return { gameFormatOverrides: next }
    })
  },

  setGameBracketTypesForGame: (gameId, bracketTypes) => {
    const id = gameId.trim()
    if (!id) return

    const nextTypes = uniqueBracketTypes(bracketTypes)
    if (nextTypes.length === 0) return

    set((state) => {
      const next = { ...state.gameBracketTypeOverrides }

      const isDefault =
        nextTypes.length === 4 &&
        nextTypes.includes('single_elimination') &&
        nextTypes.includes('double_elimination') &&
        nextTypes.includes('swiss') &&
        nextTypes.includes('round_robin')

      if (isDefault) {
        delete next[id]
      } else {
        next[id] = nextTypes
      }

      return { gameBracketTypeOverrides: next }
    })
  },

  importBackup: (raw) => {
    const parsed = parsePersisted(raw)
    if (!parsed) return false

    const activeIdExists = parsed.activeTournamentId
      ? parsed.tournaments.some((t) => t.id === parsed.activeTournamentId)
      : false

    set({
      isHydrated: true,
      tournaments: parsed.tournaments,
      playerProfiles: rebuildPlayerProfiles(parsed.playerProfiles ?? {}, parsed.tournaments),
      customGames: parsed.customGames ?? [],
      customGameCovers: parsed.customGameCovers ?? {},
      gameFormatOverrides: parsed.gameFormatOverrides ?? {},
      gameBracketTypeOverrides: parsed.gameBracketTypeOverrides ?? {},
      activeTournamentId: activeIdExists ? parsed.activeTournamentId : (parsed.tournaments[0]?.id ?? null),
    })

    // Persist immediately when running in Electron.
    void (async () => {
      try {
        await window.arena.appState.set(useArenaStore.getState().toPersisted())
      } catch {
        // ignore
      }
    })()

    return true
  },

  createTournament: (draft) => {
    const id = newId('tournament')
    const now = new Date().toISOString()

    const tournament: Tournament = {
      id,
      name: draft.name.trim() || 'New Tournament',
      gameId: draft.gameId,
      format: draft.format,
      bracketType: draft.bracketType,
      createdAt: now,
      rules: draft.rules,
      entrants: [],
      bracket: null,
      finance: {
        ...DEFAULT_FINANCE,
        ticketCost: Number.isFinite(draft.ticketCost) ? Math.max(0, draft.ticketCost) : 0,
        vendors: [],
        prizes: DEFAULT_FINANCE.prizes.map((p) => ({ ...p, id: newId('prize') })),
      },
    }

    set((state) => ({
      tournaments: [tournament, ...state.tournaments],
      activeTournamentId: id,
    }))

    return id
  },

  addCustomGame: (draft) => {
    const name = draft.name.trim()
    if (!name) return null

    const genre = (draft.genre ?? '').trim()
    const platforms = Array.isArray(draft.platforms) ? draft.platforms.map((p) => p.trim()).filter(Boolean) : []

    const existing = new Set<string>()
    for (const g of GAMES) existing.add(g.id)
    for (const g of get().customGames) existing.add(g.id)

    const base = slugifyId(name)
    const id = makeUniqueId(base || 'game', existing)

    const next: Game = {
      id,
      name,
      ...(genre ? { genres: [genre] } : {}),
      ...(platforms.length ? { platforms } : {}),
    }

    set((state) => ({
      customGames: [...state.customGames, next],
    }))

    return id
  },

  updateCustomGame: (gameId, draft) => {
    const id = gameId.trim()
    if (!id) return false

    const existing = get().customGames.find((g) => g.id === id)
    if (!existing) return false

    const name = draft.name.trim()
    if (!name) return false

    const genre = (draft.genre ?? '').trim()
    const platforms = Array.isArray(draft.platforms) ? draft.platforms.map((p) => p.trim()).filter(Boolean) : []

    const next: Game = {
      id,
      name,
      ...(genre ? { genres: [genre] } : {}),
      ...(platforms.length ? { platforms } : {}),
    }

    set((state) => ({
      customGames: state.customGames.map((g) => (g.id === id ? next : g)),
    }))

    return true
  },

  removeCustomGame: (gameId) => {
    const id = gameId.trim()
    if (!id) return { ok: false as const, reason: 'Invalid game id.' }

    const exists = get().customGames.some((g) => g.id === id)
    if (!exists) return { ok: false as const, reason: 'Game not found.' }

    const inUse = get().tournaments.some((t) => t.gameId === id)
    if (inUse) return { ok: false as const, reason: 'This game is used by saved tournaments.' }

    set((state) => {
      const nextCovers = { ...state.customGameCovers }
      delete nextCovers[id]

      const nextFormats = { ...state.gameFormatOverrides }
      delete nextFormats[id]

      const nextTypes = { ...state.gameBracketTypeOverrides }
      delete nextTypes[id]

      return {
        customGames: state.customGames.filter((g) => g.id !== id),
        customGameCovers: nextCovers,
        gameFormatOverrides: nextFormats,
        gameBracketTypeOverrides: nextTypes,
      }
    })

    return { ok: true as const }
  },

  addPlayerEntrant: (tournamentId, gamertag) => {
    const tag = gamertag.trim()
    if (!tag) return

    updateTournament(set, tournamentId, (t) => ({
      ...t,
      entrants: [
        ...t.entrants,
        {
          id: newId('entrant'),
          type: 'player',
          gamertag: tag,
          checkedIn: true,
        },
      ],
      bracket: null,
    }))
  },

  addTeamEntrant: (tournamentId, team) => {
    const player1 = team.player1.trim()
    const player2 = team.player2.trim()
    if (!player1 || !player2) return

    const teamEntrant: TeamEntrant = {
      id: newId('entrant'),
      type: 'team',
      teamName: team.teamName.trim(),
      player1,
      player2,
      checkedIn: true,
    }

    updateTournament(set, tournamentId, (t) => ({
      ...t,
      entrants: [...t.entrants, teamEntrant],
      bracket: null,
    }))
  },

  removeEntrant: (tournamentId, entrantId) => {
    updateTournament(set, tournamentId, (t) => ({
      ...t,
      entrants: t.entrants.filter((e) => e.id !== entrantId),
      bracket: null,
    }))
  },

  toggleCheckIn: (tournamentId, entrantId) => {
    updateTournament(set, tournamentId, (t) => ({
      ...t,
      entrants: t.entrants.map((e) => (e.id === entrantId ? { ...e, checkedIn: !e.checkedIn } : e)),
      bracket: null,
    }))
  },

  generateBracket: (tournamentId) => {
    updateTournament(set, tournamentId, (t) => {
      const checkedIn = t.entrants.filter((e) => e.checkedIn)
      const source = checkedIn.length > 0 ? checkedIn : t.entrants
      const ids = source.map((e) => e.id)

      const bracketType = t.bracketType ?? 'single_elimination'

      const bracket =
        bracketType === 'double_elimination'
          ? generateDoubleEliminationBracket(ids)
          : bracketType === 'round_robin'
          ? generateRoundRobinBracket(ids)
          : bracketType === 'swiss'
            ? generateSwissBracket(ids)
            : generateSingleEliminationBracket(ids)

      return {
        ...t,
        bracket,
      }
    })
  },

  setMatchWinner: (tournamentId, args) => {
    updateTournament(set, tournamentId, (t) => {
      if (!t.bracket) return t

      const bracketType: BracketType = t.bracket.type

      const nextBracket =
        bracketType === 'double_elimination'
          ? setDoubleElimMatchResult(t.bracket, args.roundIndex, args.matchIndex, args.winnerSlot, {
              a: args.scoreA,
              b: args.scoreB,
            })
          : bracketType === 'round_robin'
          ? setRoundRobinMatchResult(t.bracket, args.roundIndex, args.matchIndex, args.winnerSlot, {
              a: args.scoreA,
              b: args.scoreB,
            })
          : bracketType === 'swiss'
            ? setSwissMatchResult(t.bracket, args.roundIndex, args.matchIndex, args.winnerSlot, {
                a: args.scoreA,
                b: args.scoreB,
              })
            : setSingleElimMatchResult(t.bracket, args.roundIndex, args.matchIndex, args.winnerSlot, {
                a: args.scoreA,
                b: args.scoreB,
              })

      return {
        ...t,
        bracket: nextBracket,
      }
    })
  },

  updateRules: (tournamentId, nextRules) => {
    updateTournament(set, tournamentId, (t) => ({
      ...t,
      rules: nextRules,
    }))
  },

  updateFinance: (tournamentId, nextFinance) => {
    updateTournament(set, tournamentId, (t) => ({
      ...t,
      finance: nextFinance,
    }))
  },

  setTicketCost: (tournamentId, ticketCost) => {
    updateTournament(set, tournamentId, (t) => ({
      ...t,
      finance: {
        ...t.finance,
        ticketCost: Number.isFinite(ticketCost) ? Math.max(0, ticketCost) : 0,
      },
    }))
  },

  addVendor: (tournamentId, vendor) => {
    updateTournament(set, tournamentId, (t) => ({
      ...t,
      finance: {
        ...t.finance,
        vendors: [...t.finance.vendors, { ...vendor, id: newId('vendor') }],
      },
    }))
  },

  updateVendor: (tournamentId, vendor) => {
    updateTournament(set, tournamentId, (t) => ({
      ...t,
      finance: {
        ...t.finance,
        vendors: t.finance.vendors.map((v) => (v.id === vendor.id ? vendor : v)),
      },
    }))
  },

  removeVendor: (tournamentId, vendorId) => {
    updateTournament(set, tournamentId, (t) => ({
      ...t,
      finance: {
        ...t.finance,
        vendors: t.finance.vendors.filter((v) => v.id !== vendorId),
      },
    }))
  },

  addPrize: (tournamentId, prize) => {
    updateTournament(set, tournamentId, (t) => ({
      ...t,
      finance: {
        ...t.finance,
        prizes: [...t.finance.prizes, { ...prize, id: newId('prize') }],
      },
    }))
  },

  updatePrize: (tournamentId, prize) => {
    updateTournament(set, tournamentId, (t) => ({
      ...t,
      finance: {
        ...t.finance,
        prizes: t.finance.prizes.map((p) => (p.id === prize.id ? prize : p)),
      },
    }))
  },

  removePrize: (tournamentId, prizeId) => {
    updateTournament(set, tournamentId, (t) => ({
      ...t,
      finance: {
        ...t.finance,
        prizes: t.finance.prizes.filter((p) => p.id !== prizeId),
      },
    }))
  },
}))

function updateTournament(
  set: (next: (state: ArenaStoreState) => Partial<ArenaStoreState>) => void,
  tournamentId: string,
  updater: (tournament: Tournament) => Tournament,
) {
  set((state) => {
    const tournaments = state.tournaments.map((t) => (t.id === tournamentId ? updater(t) : t))

    return {
      tournaments,
      playerProfiles: rebuildPlayerProfiles(state.playerProfiles, tournaments),
    }
  })
}

function parsePersisted(raw: unknown): PersistedStateV1 | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const v = obj['version']
  if (v !== 1) return null

  const tournamentsRaw = obj['tournaments']
  const tournaments = Array.isArray(tournamentsRaw) ? sanitizeTournaments(tournamentsRaw as Tournament[]) : []
  const activeIdRaw = obj['activeTournamentId']
  const activeTournamentId = typeof activeIdRaw === 'string' ? activeIdRaw : null

  const rawCovers = obj['customGameCovers']
  const customGameCovers: Record<string, string> = {}
  if (rawCovers && typeof rawCovers === 'object') {
    for (const [key, value] of Object.entries(rawCovers as Record<string, unknown>)) {
      if (typeof value === 'string') customGameCovers[key] = value
    }
  }

  const rawFormats = obj['gameFormatOverrides']
  const gameFormatOverrides: Record<string, TournamentFormat[]> = {}
  if (rawFormats && typeof rawFormats === 'object') {
    for (const [key, value] of Object.entries(rawFormats as Record<string, unknown>)) {
      const arr = Array.isArray(value) ? (value as unknown[]) : []
      const formats = uniqueFormats(arr.filter((x): x is TournamentFormat => x === '1v1' || x === '2v2'))
      if (formats.length) gameFormatOverrides[key] = formats
    }
  }

  const rawBracketTypes = obj['gameBracketTypeOverrides']
  const gameBracketTypeOverrides: Record<string, BracketType[]> = {}
  if (rawBracketTypes && typeof rawBracketTypes === 'object') {
    for (const [key, value] of Object.entries(rawBracketTypes as Record<string, unknown>)) {
      const arr = Array.isArray(value) ? (value as unknown[]) : []
      const types = uniqueBracketTypes(
        arr.filter(
          (x): x is BracketType =>
            x === 'single_elimination' || x === 'double_elimination' || x === 'round_robin' || x === 'swiss',
        ),
      )
      if (types.length) gameBracketTypeOverrides[key] = types
    }
  }

  const rawProfiles = obj['playerProfiles']
  const playerProfiles: Record<string, PlayerProfile> = {}
  if (rawProfiles && typeof rawProfiles === 'object') {
    for (const [key, value] of Object.entries(rawProfiles as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue
      const v = value as Record<string, unknown>

      const gamertag = typeof v['gamertag'] === 'string' ? (v['gamertag'] as string) : key
      const normalized = normalizeGamertag(gamertag)
      if (!normalized) continue

      const id = typeof v['id'] === 'string' ? (v['id'] as string) : newId('profile')
      const createdAt = typeof v['createdAt'] === 'string' ? (v['createdAt'] as string) : new Date().toISOString()
      const wins = typeof v['wins'] === 'number' && Number.isFinite(v['wins']) ? Math.max(0, v['wins'] as number) : 0
      const losses =
        typeof v['losses'] === 'number' && Number.isFinite(v['losses']) ? Math.max(0, v['losses'] as number) : 0
      const points =
        typeof v['points'] === 'number' && Number.isFinite(v['points']) ? Math.max(0, v['points'] as number) : 0

      playerProfiles[normalized] = {
        id,
        gamertag: gamertag.trim() || gamertag,
        createdAt,
        wins,
        losses,
        points,
      }
    }
  }

  const customGames = sanitizeCustomGames(obj['customGames'])

  return {
    version: 1,
    tournaments,
    activeTournamentId,
    playerProfiles,
    customGames,
    customGameCovers,
    gameFormatOverrides,
    gameBracketTypeOverrides,
  }
}

function sanitizeCustomGames(raw: unknown): Game[] {
  if (!Array.isArray(raw)) return []

  const reserved = new Set<string>(GAMES.map((g) => g.id))
  const seen = new Set<string>()
  const out: Game[] = []

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const v = item as Record<string, unknown>

    const id = typeof v['id'] === 'string' ? (v['id'] as string).trim() : ''
    const name = typeof v['name'] === 'string' ? (v['name'] as string).trim() : ''
    if (!id || !name) continue
    if (seen.has(id)) continue
    if (reserved.has(id)) continue

    const genres = Array.isArray(v['genres'])
      ? (v['genres'] as unknown[])
          .filter((x): x is string => typeof x === 'string')
          .map((x) => x.trim())
          .filter(Boolean)
          .slice(0, 4)
      : []

    const platforms = Array.isArray(v['platforms'])
      ? (v['platforms'] as unknown[])
          .filter((x): x is string => typeof x === 'string')
          .map((x) => x.trim())
          .filter(Boolean)
          .slice(0, 6)
      : []

    out.push({
      id,
      name,
      ...(genres.length ? { genres } : {}),
      ...(platforms.length ? { platforms } : {}),
    })
    seen.add(id)
  }

  return out
}

function slugifyId(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 32)
}

function makeUniqueId(base: string, existing: Set<string>): string {
  let id = base
  let n = 2
  while (existing.has(id)) {
    id = `${base}${n}`
    n += 1
  }
  return id
}

function uniqueFormats(formats: TournamentFormat[]): TournamentFormat[] {
  const uniq = Array.from(new Set(formats))
  // Stable order
  const ordered: TournamentFormat[] = []
  if (uniq.includes('1v1')) ordered.push('1v1')
  if (uniq.includes('2v2')) ordered.push('2v2')
  return ordered
}

function uniqueBracketTypes(bracketTypes: BracketType[]): BracketType[] {
  const uniq = Array.from(new Set(bracketTypes))
  const ordered: BracketType[] = []
  if (uniq.includes('single_elimination')) ordered.push('single_elimination')
  if (uniq.includes('double_elimination')) ordered.push('double_elimination')
  if (uniq.includes('swiss')) ordered.push('swiss')
  if (uniq.includes('round_robin')) ordered.push('round_robin')
  return ordered
}

function sanitizeTournaments(tournaments: Tournament[]): Tournament[] {
  return tournaments.map((t) => {
    const fallbackType: BracketType = t.bracket?.type ?? 'single_elimination'

    return {
      ...t,
      bracketType: (t as Tournament).bracketType ?? fallbackType,
    }
  })
}

export function setupAutoSave() {
  let timer: number | null = null

  useArenaStore.subscribe((state, prev) => {
    if (!state.isHydrated) return
    if (!prev.isHydrated) return

    const relevantChanged =
      state.tournaments !== prev.tournaments ||
      state.activeTournamentId !== prev.activeTournamentId ||
      state.playerProfiles !== prev.playerProfiles ||
      state.customGames !== prev.customGames ||
      state.customGameCovers !== prev.customGameCovers ||
      state.gameFormatOverrides !== prev.gameFormatOverrides ||
      state.gameBracketTypeOverrides !== prev.gameBracketTypeOverrides

    if (!relevantChanged) return

    if (timer) window.clearTimeout(timer)
    timer = window.setTimeout(async () => {
      try {
        await window.arena.appState.set(useArenaStore.getState().toPersisted())
      } catch {
        // ignore
      }
    }, 300)
  })
}

export function getActiveTournament(state: Pick<ArenaStoreState, 'tournaments' | 'activeTournamentId'>): Tournament | null {
  if (!state.activeTournamentId) return null
  return state.tournaments.find((t) => t.id === state.activeTournamentId) ?? null
}

export function entrantMatchesFormat(entrant: Entrant, format: TournamentFormat): boolean {
  return (format === '1v1' && entrant.type === 'player') || (format === '2v2' && entrant.type === 'team')
}

function normalizeGamertag(value: string): string {
  return value.trim().toLowerCase()
}

function entrantGamertags(entrant: Entrant): string[] {
  if (entrant.type === 'player') return [entrant.gamertag]
  return [entrant.player1, entrant.player2]
}

function rebuildPlayerProfiles(
  prevProfiles: Record<string, PlayerProfile>,
  tournaments: Tournament[],
): Record<string, PlayerProfile> {
  const next: Record<string, PlayerProfile> = {}
  for (const [key, value] of Object.entries(prevProfiles)) {
    next[key] = { ...value }
  }
  const nowIso = new Date().toISOString()

  // Ensure a profile exists for every gamertag that appears in any tournament.
  for (const t of tournaments) {
    for (const entrant of t.entrants) {
      for (const raw of entrantGamertags(entrant)) {
        const tag = raw.trim()
        if (!tag) continue
        const key = normalizeGamertag(tag)
        if (!key) continue
        if (!next[key]) {
          next[key] = {
            id: newId('profile'),
            gamertag: tag,
            createdAt: nowIso,
            wins: 0,
            losses: 0,
            points: 0,
          }
        }
      }
    }
  }

  // Reset stats so we can recompute deterministically from saved brackets.
  for (const p of Object.values(next)) {
    p.wins = 0
    p.losses = 0
  }

  for (const t of tournaments) {
    if (!t.bracket) continue
    const entrantById = new Map<string, Entrant>()
    for (const e of t.entrants) entrantById.set(e.id, e)

    for (const round of t.bracket.rounds) {
      for (const match of round) {
        const aId = match.sides[0].entrantId
        const bId = match.sides[1].entrantId
        if (!aId || !bId) continue
        if (!match.winnerEntrantId) continue

        const winnerId = match.winnerEntrantId
        const loserId = winnerId === aId ? bId : winnerId === bId ? aId : null
        if (!loserId) continue

        const winnerEntrant = entrantById.get(winnerId)
        const loserEntrant = entrantById.get(loserId)
        if (!winnerEntrant || !loserEntrant) continue

        const winnerTags = new Set(entrantGamertags(winnerEntrant).map((x) => x.trim()).filter(Boolean))
        const loserTags = new Set(entrantGamertags(loserEntrant).map((x) => x.trim()).filter(Boolean))

        for (const tag of winnerTags) {
          const key = normalizeGamertag(tag)
          if (!key) continue
          if (!next[key]) {
            next[key] = {
              id: newId('profile'),
              gamertag: tag,
              createdAt: nowIso,
              wins: 0,
              losses: 0,
              points: 0,
            }
          }
          next[key].wins += 1
        }

        for (const tag of loserTags) {
          const key = normalizeGamertag(tag)
          if (!key) continue
          if (!next[key]) {
            next[key] = {
              id: newId('profile'),
              gamertag: tag,
              createdAt: nowIso,
              wins: 0,
              losses: 0,
              points: 0,
            }
          }
          next[key].losses += 1
        }
      }
    }
  }

  return next
}
