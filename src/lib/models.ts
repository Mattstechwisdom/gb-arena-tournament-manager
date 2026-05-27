export type TournamentFormat = '1v1' | '2v2'
export type BracketType = 'single_elimination' | 'double_elimination' | 'round_robin' | 'swiss'

export interface Game {
  id: string
  name: string
  platforms?: string[]
  genres?: string[]
}

export interface Rules {
  bestOf: 1 | 3 | 5
  timerMinutes: number | null
  stageList: string
  characterBansEnabled: boolean
  bannedCharacters: string[]
  notes: string
}

export interface PlayerEntrant {
  id: string
  type: 'player'
  gamertag: string
  checkedIn: boolean
}

export interface TeamEntrant {
  id: string
  type: 'team'
  teamName: string
  player1: string
  player2: string
  checkedIn: boolean
}

export type Entrant = PlayerEntrant | TeamEntrant

export interface MatchSide {
  entrantId: string | null
  score: number | null
}

export interface Match {
  id: string
  roundIndex: number
  matchIndex: number
  sides: [MatchSide, MatchSide]
  winnerEntrantId: string | null
}

export interface Bracket {
  type: BracketType
  size: number
  generatedAt: string
  rounds: Match[][]
  roundLabels?: string[]
}

export type VendorShareType = 'fixed' | 'percent'

export interface VendorShare {
  id: string
  name: string
  type: VendorShareType
  /**
   * `fixed` => currency value
   * `percent` => 0..100
   */
  value: number
}

export interface PrizePlacement {
  id: string
  placement: number
  label: string
  amount: number
}

export interface Finance {
  ticketCost: number
  vendors: VendorShare[]
  prizes: PrizePlacement[]
}

export interface Tournament {
  id: string
  name: string
  gameId: string
  format: TournamentFormat
  bracketType: BracketType
  createdAt: string
  rules: Rules
  entrants: Entrant[]
  bracket: Bracket | null
  finance: Finance
}

export interface PlayerProfile {
  id: string
  gamertag: string
  createdAt: string
  wins: number
  losses: number
  points: number
}

export interface PersistedStateV1 {
  version: 1
  activeTournamentId: string | null
  tournaments: Tournament[]
  playerProfiles?: Record<string, PlayerProfile>
  /** User-added games that extend the built-in catalog. */
  customGames?: Game[]
  customGameCovers?: Record<string, string>
  gameFormatOverrides?: Record<string, TournamentFormat[]>
  gameBracketTypeOverrides?: Record<string, BracketType[]>
}

export function entrantDisplayName(entrant: Entrant): string {
  if (entrant.type === 'player') return entrant.gamertag
  const name = entrant.teamName.trim()
  if (name) return name
  return `${entrant.player1} + ${entrant.player2}`
}

export function placementLabel(placement: number): string {
  if (placement === 1) return '1st'
  if (placement === 2) return '2nd'
  if (placement === 3) return '3rd'
  return `${placement}th`
}
