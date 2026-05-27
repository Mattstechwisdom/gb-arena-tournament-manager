import type { Bracket, BracketType, Entrant, Finance, PersistedStateV1, Rules, Tournament, TournamentFormat } from '../lib/models'
import { placementLabel } from '../lib/models'
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
import { getGameById } from '../data/games'

type Rng = () => number

const DAY_MS = 24 * 60 * 60 * 1000

const DEMO_PLAYERS: string[] = [
  'Rumsmoke',
  'Nova',
  'Ace',
  'Blaze',
  'Cipher',
  'Luna',
  'Kairo',
  'Echo',
  'Raven',
  'Nyx',
  'Volt',
  'Ivy',
  'Orbit',
  'Pixel',
  'Sage',
  'Comet',
  'Frost',
  'Grit',
  'Jinx',
  'Mako',
  'Zen',
  'Astra',
  'Rook',
  'Bishop',
  'Knight',
  'Queen',
  'Pawn',
  'Viper',
  'Karma',
  'Drift',
]

const DEMO_RATINGS = new Map<string, number>(
  DEMO_PLAYERS.map((tag, idx) => {
    // Keep the demo interesting: a few strong players, then a gradual drop.
    const rating = Math.max(900, 1850 - idx * 35)
    return [tag, rating]
  }),
)

type DemoSeriesSpec = {
  gameId: string
  format: TournamentFormat
  bracketType: BracketType
  entrantsCount: number
  bestOf: 1 | 3 | 5
  ticketCost: number
}

const SERIES: DemoSeriesSpec[] = [
  { gameId: 'sf6', format: '1v1', bracketType: 'double_elimination', entrantsCount: 12, bestOf: 3, ticketCost: 5 },
  { gameId: 'tekken8', format: '1v1', bracketType: 'double_elimination', entrantsCount: 12, bestOf: 3, ticketCost: 5 },
  { gameId: 'ssbu', format: '1v1', bracketType: 'double_elimination', entrantsCount: 16, bestOf: 3, ticketCost: 5 },
  { gameId: 'mariokart8', format: '1v1', bracketType: 'round_robin', entrantsCount: 8, bestOf: 1, ticketCost: 3 },
  { gameId: 'chess', format: '1v1', bracketType: 'swiss', entrantsCount: 14, bestOf: 1, ticketCost: 0 },
  { gameId: 'mtga', format: '1v1', bracketType: 'swiss', entrantsCount: 12, bestOf: 3, ticketCost: 5 },
  { gameId: 'rocketleague', format: '2v2', bracketType: 'single_elimination', entrantsCount: 8, bestOf: 5, ticketCost: 10 },
  { gameId: 'overwatch2', format: '2v2', bracketType: 'single_elimination', entrantsCount: 8, bestOf: 3, ticketCost: 10 },
]

export function createDemoPersistedStateV1(): PersistedStateV1 {
  // Deterministic generator: the same demo data every time.
  const rng = mulberry32(0xdecafbad)
  const makeId = createIdFactory('demo')

  const tournaments: Tournament[] = []

  // ~32 weeks of completed tournaments ending near “now”.
  const end = new Date()
  const start = new Date(end.getTime() - 32 * 7 * DAY_MS)

  for (let i = 0; i < 32; i++) {
    const spec = SERIES[i % SERIES.length]!

    // Spread out times so sorting feels “event-like”.
    const createdAt = new Date(start.getTime() + i * 7 * DAY_MS + (i % 3) * 2 * 60 * 60 * 1000).toISOString()

    const gameName = getGameById(spec.gameId)?.name ?? spec.gameId
    const seriesIndex = Math.floor(i / SERIES.length) + 1
    const name = `GB Arena ${gameName} • Week ${seriesIndex}`

    tournaments.push(makeCompletedTournament({ makeId, rng, createdAt, name, ...spec }))
  }

  tournaments.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return {
    version: 1,
    activeTournamentId: tournaments[0]?.id ?? null,
    tournaments,
    // Derived on hydrate; keep persisted payload small.
    playerProfiles: {},
    customGameCovers: {},
    gameFormatOverrides: {},
    gameBracketTypeOverrides: {},
  }
}

function makeCompletedTournament(args: {
  makeId: (prefix: string) => string
  rng: Rng
  createdAt: string
  name: string
  gameId: string
  format: TournamentFormat
  bracketType: BracketType
  entrantsCount: number
  bestOf: 1 | 3 | 5
  ticketCost: number
}): Tournament {
  const rules = makeRules(args)
  const finance = makeFinance(args)

  const entrants =
    args.format === '2v2'
      ? makeTeamEntrants(args.makeId, args.rng, args.entrantsCount)
      : makePlayerEntrants(args.makeId, args.rng, args.entrantsCount)

  const ids = entrants.map((e) => e.id)
  const generatedAt = args.createdAt

  let bracket: Bracket | null = null

  if (args.bracketType === 'double_elimination') {
    bracket = generateDoubleEliminationBracket(ids, generatedAt)
    bracket = playDoubleElim(bracket, entrants, args.bestOf, args.rng)
  } else if (args.bracketType === 'round_robin') {
    bracket = generateRoundRobinBracket(ids, generatedAt)
    bracket = playRoundRobin(bracket, entrants, args.bestOf, args.rng)
  } else if (args.bracketType === 'swiss') {
    bracket = generateSwissBracket(ids, generatedAt)
    bracket = playSwiss(bracket, entrants, args.bestOf, args.rng)
  } else {
    bracket = generateSingleEliminationBracket(ids, generatedAt)
    bracket = playSingleElim(bracket, entrants, args.bestOf, args.rng)
  }

  return {
    id: args.makeId('tournament'),
    name: args.name,
    gameId: args.gameId,
    format: args.format,
    bracketType: args.bracketType,
    createdAt: args.createdAt,
    rules,
    entrants,
    bracket,
    finance,
  }
}

function makeRules(args: { gameId: string; bestOf: 1 | 3 | 5 }): Rules {
  const base: Rules = {
    bestOf: args.bestOf,
    timerMinutes: null,
    stageList: '',
    characterBansEnabled: false,
    bannedCharacters: [],
    notes: '',
  }

  if (args.gameId === 'ssbu') {
    return {
      ...base,
      timerMinutes: 7,
      stageList: ['Battlefield', 'Small Battlefield', 'Final Destination'].join('\n'),
      characterBansEnabled: true,
      bannedCharacters: ['Steve', 'Kazuya'],
      notes: 'Demo ruleset: stage strikes + character bans enabled.',
    }
  }

  if (args.gameId === 'sf6' || args.gameId === 'tekken8') {
    return {
      ...base,
      timerMinutes: 5,
      notes: 'Demo ruleset: standard tournament settings.',
    }
  }

  return base
}

function makeFinance(args: { makeId: (prefix: string) => string; ticketCost: number }): Finance {
  return {
    ticketCost: Math.max(0, args.ticketCost),
    vendors: [],
    prizes: [
      { id: args.makeId('prize'), placement: 1, label: placementLabel(1), amount: 50 },
      { id: args.makeId('prize'), placement: 2, label: placementLabel(2), amount: 30 },
      { id: args.makeId('prize'), placement: 3, label: placementLabel(3), amount: 20 },
    ],
  }
}

function makePlayerEntrants(makeId: (prefix: string) => string, rng: Rng, count: number): Entrant[] {
  const stars = ['Rumsmoke', 'Nova', 'Ace', 'Blaze', 'Cipher', 'Luna']
  const picked = new Set<string>()

  for (const s of stars) {
    if (picked.size >= count) break
    picked.add(s)
  }

  while (picked.size < count) {
    picked.add(DEMO_PLAYERS[Math.floor(rng() * DEMO_PLAYERS.length)]!)
  }

  return Array.from(picked).map((tag) => ({
    id: makeId('entrant'),
    type: 'player' as const,
    gamertag: tag,
    checkedIn: true,
  }))
}

function makeTeamEntrants(makeId: (prefix: string) => string, rng: Rng, teamCount: number): Entrant[] {
  // 2v2: pick 2 * teamCount unique players and pair them.
  const players = pickUnique(DEMO_PLAYERS, Math.min(DEMO_PLAYERS.length, teamCount * 2), rng)

  const teams: Entrant[] = []
  for (let i = 0; i < players.length; i += 2) {
    const p1 = players[i]!
    const p2 = players[i + 1]!
    teams.push({
      id: makeId('entrant'),
      type: 'team' as const,
      teamName: `${p1} + ${p2}`,
      player1: p1,
      player2: p2,
      checkedIn: true,
    })
  }

  return teams
}

function playSingleElim(bracket: Bracket, entrants: Entrant[], bestOf: 1 | 3 | 5, rng: Rng): Bracket {
  const ratingByEntrantId = entrantRatings(entrants)
  let next = bracket

  for (let r = 0; r < next.rounds.length; r++) {
    for (let m = 0; m < next.rounds[r]!.length; m++) {
      const match = next.rounds[r]![m]!
      if (match.winnerEntrantId) continue
      const aId = match.sides[0].entrantId
      const bId = match.sides[1].entrantId
      if (!aId || !bId) continue

      const winnerSlot = pickWinnerSlot(ratingByEntrantId.get(aId) ?? 1200, ratingByEntrantId.get(bId) ?? 1200, rng)
      const scores = scoreForBestOf(bestOf, winnerSlot, rng)
      next = setSingleElimMatchResult(next, r, match.matchIndex, winnerSlot, scores)
    }
  }

  return next
}

function playDoubleElim(bracket: Bracket, entrants: Entrant[], bestOf: 1 | 3 | 5, rng: Rng): Bracket {
  const ratingByEntrantId = entrantRatings(entrants)
  let next = bracket

  // Always pick the next playable match in bracket order.
  for (let safety = 0; safety < 10_000; safety++) {
    const ref = findNextPlayableMatch(next)
    if (!ref) break

    const match = next.rounds[ref.roundIndex]![ref.matchIndex]!
    const aId = match.sides[0].entrantId
    const bId = match.sides[1].entrantId
    if (!aId || !bId) continue

    const winnerSlot = pickWinnerSlot(ratingByEntrantId.get(aId) ?? 1200, ratingByEntrantId.get(bId) ?? 1200, rng)
    const scores = scoreForBestOf(bestOf, winnerSlot, rng)
    next = setDoubleElimMatchResult(next, ref.roundIndex, match.matchIndex, winnerSlot, scores)
  }

  return next
}

function playSwiss(bracket: Bracket, entrants: Entrant[], bestOf: 1 | 3 | 5, rng: Rng): Bracket {
  const ratingByEntrantId = entrantRatings(entrants)
  let next = bracket

  for (let r = 0; r < next.rounds.length; r++) {
    // Keep playing matches in this round until complete.
    for (let safety = 0; safety < 2_000; safety++) {
      const round = next.rounds[r]
      if (!round) break

      const pending = round.find((m) => {
        const aId = m.sides[0].entrantId
        const bId = m.sides[1].entrantId
        return Boolean(aId && bId && !m.winnerEntrantId)
      })

      if (!pending) break

      const aId = pending.sides[0].entrantId!
      const bId = pending.sides[1].entrantId!

      const winnerSlot = pickWinnerSlot(ratingByEntrantId.get(aId) ?? 1200, ratingByEntrantId.get(bId) ?? 1200, rng)
      const scores = scoreForBestOf(bestOf, winnerSlot, rng)
      next = setSwissMatchResult(next, r, pending.matchIndex, winnerSlot, scores)
    }
  }

  return next
}

function playRoundRobin(bracket: Bracket, entrants: Entrant[], bestOf: 1 | 3 | 5, rng: Rng): Bracket {
  const ratingByEntrantId = entrantRatings(entrants)
  let next = bracket

  for (let r = 0; r < next.rounds.length; r++) {
    const round = next.rounds[r]
    if (!round) continue

    for (let m = 0; m < round.length; m++) {
      const match = next.rounds[r]![m]!
      if (match.winnerEntrantId) continue
      const aId = match.sides[0].entrantId
      const bId = match.sides[1].entrantId
      if (!aId || !bId) continue

      const winnerSlot = pickWinnerSlot(ratingByEntrantId.get(aId) ?? 1200, ratingByEntrantId.get(bId) ?? 1200, rng)
      const scores = scoreForBestOf(bestOf, winnerSlot, rng)
      next = setRoundRobinMatchResult(next, r, match.matchIndex, winnerSlot, scores)
    }
  }

  return next
}

function findNextPlayableMatch(bracket: Bracket): { roundIndex: number; matchIndex: number } | null {
  for (let r = 0; r < bracket.rounds.length; r++) {
    const round = bracket.rounds[r]
    if (!round) continue

    for (let m = 0; m < round.length; m++) {
      const match = round[m]!
      if (match.winnerEntrantId) continue
      const aId = match.sides[0].entrantId
      const bId = match.sides[1].entrantId
      if (aId && bId) return { roundIndex: r, matchIndex: m }
    }
  }

  return null
}

function entrantRatings(entrants: Entrant[]): Map<string, number> {
  const byId = new Map<string, number>()

  for (const e of entrants) {
    if (e.type === 'player') {
      byId.set(e.id, DEMO_RATINGS.get(e.gamertag) ?? 1200)
    } else {
      const r1 = DEMO_RATINGS.get(e.player1) ?? 1200
      const r2 = DEMO_RATINGS.get(e.player2) ?? 1200
      byId.set(e.id, Math.round((r1 + r2) / 2))
    }
  }

  return byId
}

function pickWinnerSlot(ratingA: number, ratingB: number, rng: Rng): 0 | 1 {
  // Elo win probability.
  const pA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
  return rng() < pA ? 0 : 1
}

function scoreForBestOf(bestOf: 1 | 3 | 5, winnerSlot: 0 | 1, rng: Rng): { a?: number | null; b?: number | null } {
  const win = bestOf === 1 ? 1 : bestOf === 3 ? 2 : 3
  const maxLose = Math.max(0, win - 1)
  const lose = maxLose === 0 ? 0 : Math.floor(rng() * (maxLose + 1))

  return winnerSlot === 0 ? { a: win, b: lose } : { a: lose, b: win }
}

function pickUnique<T>(arr: T[], count: number, rng: Rng): T[] {
  const copy = arr.slice()
  shuffleInPlace(copy, rng)
  return copy.slice(0, Math.max(0, Math.min(copy.length, count)))
}

function shuffleInPlace<T>(arr: T[], rng: Rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]!
    arr[j] = tmp!
  }
}

function createIdFactory(namespace: string): (prefix: string) => string {
  let n = 0
  return (prefix: string) => {
    n += 1
    return `${namespace}_${prefix}_${String(n).padStart(5, '0')}`
  }
}

function mulberry32(seed: number): Rng {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let x = t
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}
