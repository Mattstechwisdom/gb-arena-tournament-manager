import type { Game } from '../lib/models'

import gamesJson from './games.json'

// Note: Covers are custom-generated SVGs (no copyrighted assets bundled).
export const GAMES: Game[] = gamesJson as unknown as Game[]

export function getAllGames(customGames: Game[] = []): Game[] {
  if (!customGames.length) return GAMES

  const byId = new Map<string, Game>()
  for (const g of GAMES) byId.set(g.id, g)
  for (const g of customGames) {
    if (!g?.id) continue
    if (byId.has(g.id)) continue
    byId.set(g.id, g)
  }
  return Array.from(byId.values())
}

export function getGameById(id: string, customGames: Game[] = []): Game | undefined {
  const trimmed = id.trim()
  if (!trimmed) return undefined
  return GAMES.find((g) => g.id === trimmed) ?? customGames.find((g) => g.id === trimmed)
}
