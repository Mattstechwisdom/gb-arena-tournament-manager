import type { Bracket, Match } from './models'
import { newId } from './id'

export function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1
  let p = 1
  while (p < n) p <<= 1
  return p
}

export function generateSingleEliminationBracket(entrantIds: string[], nowIso = new Date().toISOString()): Bracket {
  const size = nextPowerOfTwo(Math.max(1, entrantIds.length))
  const roundsCount = Math.log2(size)

  const seeded: Array<string | null> = [...entrantIds]
  while (seeded.length < size) seeded.push(null)

  const rounds: Match[][] = []

  for (let roundIndex = 0; roundIndex < roundsCount; roundIndex++) {
    const matchesInRound = size / Math.pow(2, roundIndex + 1)
    const matches: Match[] = []

    for (let matchIndex = 0; matchIndex < matchesInRound; matchIndex++) {
      const match: Match = {
        id: newId('match'),
        roundIndex,
        matchIndex,
        sides: [
          { entrantId: null, score: null },
          { entrantId: null, score: null },
        ],
        winnerEntrantId: null,
      }

      if (roundIndex === 0) {
        const a = seeded[matchIndex * 2] ?? null
        const b = seeded[matchIndex * 2 + 1] ?? null
        match.sides[0].entrantId = a
        match.sides[1].entrantId = b

        if (a && !b) match.winnerEntrantId = a
        if (!a && b) match.winnerEntrantId = b
      }

      matches.push(match)
    }

    rounds.push(matches)
  }

  const bracket: Bracket = {
    type: 'single_elimination',
    size,
    generatedAt: nowIso,
    rounds,
  }

  // Propagate auto-advances from round 0 (byes)
  recomputeDerivedRounds(bracket, 0)

  return bracket
}

export function generateRoundRobinBracket(entrantIds: string[], nowIso = new Date().toISOString()): Bracket {
  const ids = entrantIds.filter(Boolean)
  const originalCount = ids.length
  if (originalCount < 2) {
    return {
      type: 'round_robin',
      size: originalCount,
      generatedAt: nowIso,
      rounds: [],
    }
  }

  const players: Array<string | null> = [...ids]
  if (players.length % 2 === 1) players.push(null)

  const n = players.length
  const roundsCount = n - 1
  const matchesPerRound = n / 2

  // Circle method: keep first fixed, rotate the rest.
  let ring = players.slice()

  const rounds: Match[][] = []

  for (let roundIndex = 0; roundIndex < roundsCount; roundIndex++) {
    const matches: Match[] = []

    for (let i = 0; i < matchesPerRound; i++) {
      const a = ring[i] ?? null
      const b = ring[n - 1 - i] ?? null

      // Skip a pure-null pairing (shouldn't happen with at most one null).
      if (!a && !b) continue

      const match: Match = {
        id: newId('match'),
        roundIndex,
        matchIndex: matches.length,
        sides: [
          { entrantId: a, score: null },
          { entrantId: b, score: null },
        ],
        winnerEntrantId: null,
      }

      if (a && !b) match.winnerEntrantId = a
      if (!a && b) match.winnerEntrantId = b

      matches.push(match)
    }

    rounds.push(matches)

    // Rotate (except first).
    const fixed = ring[0]
    const rest = ring.slice(1)
    rest.unshift(rest.pop() ?? null)
    ring = [fixed, ...rest]
  }

  return {
    type: 'round_robin',
    size: originalCount,
    generatedAt: nowIso,
    rounds,
  }
}

export function setRoundRobinMatchResult(
  bracket: Bracket,
  roundIndex: number,
  matchIndex: number,
  winnerSlot: 0 | 1,
  scores?: { a?: number | null; b?: number | null },
): Bracket {
  if (bracket.type !== 'round_robin') return bracket

  const next = deepClone(bracket)
  const match = next.rounds[roundIndex]?.[matchIndex]
  if (!match) return bracket

  const winnerEntrantId = match.sides[winnerSlot].entrantId
  if (!winnerEntrantId) return bracket

  if (typeof scores?.a === 'number' || scores?.a === null) {
    match.sides[0].score = scores.a ?? null
  }
  if (typeof scores?.b === 'number' || scores?.b === null) {
    match.sides[1].score = scores.b ?? null
  }

  match.winnerEntrantId = winnerEntrantId
  return next
}

export function generateSwissBracket(entrantIds: string[], nowIso = new Date().toISOString()): Bracket {
  const ids = entrantIds.filter(Boolean)
  const playersCount = ids.length
  const roundsCount = recommendedSwissRounds(playersCount)
  const matchesPerRound = Math.ceil(playersCount / 2)

  if (roundsCount === 0 || matchesPerRound === 0) {
    return {
      type: 'swiss',
      size: playersCount,
      generatedAt: nowIso,
      rounds: [],
    }
  }

  const rounds: Match[][] = []
  for (let roundIndex = 0; roundIndex < roundsCount; roundIndex++) {
    const matches: Match[] = []
    for (let matchIndex = 0; matchIndex < matchesPerRound; matchIndex++) {
      matches.push({
        id: newId('match'),
        roundIndex,
        matchIndex,
        sides: [
          { entrantId: null, score: null },
          { entrantId: null, score: null },
        ],
        winnerEntrantId: null,
      })
    }
    rounds.push(matches)
  }

  const bracket: Bracket = {
    type: 'swiss',
    size: playersCount,
    generatedAt: nowIso,
    rounds,
  }

  // Seed round 1 pairings.
  seedSwissRound0(bracket, ids)
  recomputeSwissDerivedRounds(bracket, 0)

  return bracket
}

export function setSwissMatchResult(
  bracket: Bracket,
  roundIndex: number,
  matchIndex: number,
  winnerSlot: 0 | 1,
  scores?: { a?: number | null; b?: number | null },
): Bracket {
  if (bracket.type !== 'swiss') return bracket

  const next = deepClone(bracket)
  const match = next.rounds[roundIndex]?.[matchIndex]
  if (!match) return bracket

  const winnerEntrantId = match.sides[winnerSlot].entrantId
  if (!winnerEntrantId) return bracket

  if (typeof scores?.a === 'number' || scores?.a === null) {
    match.sides[0].score = scores.a ?? null
  }
  if (typeof scores?.b === 'number' || scores?.b === null) {
    match.sides[1].score = scores.b ?? null
  }

  match.winnerEntrantId = winnerEntrantId

  recomputeSwissDerivedRounds(next, roundIndex)
  return next
}

export function generateDoubleEliminationBracket(entrantIds: string[], nowIso = new Date().toISOString()): Bracket {
  const size = nextPowerOfTwo(Math.max(2, entrantIds.length))
  const roundsCount = Math.log2(size)

  const seeded: Array<string | null> = [...entrantIds]
  while (seeded.length < size) seeded.push(null)

  // Special-case: with a 2-player field there is no meaningful losers bracket.
  // Treat it as a single final match to avoid WB/LB mapping edge cases.
  if (roundsCount <= 1) {
    const a = seeded[0] ?? null
    const b = seeded[1] ?? null

    const match: Match = {
      id: newId('match'),
      roundIndex: 0,
      matchIndex: 0,
      sides: [
        { entrantId: a, score: null },
        { entrantId: b, score: null },
      ],
      winnerEntrantId: null,
    }

    if (a && !b) match.winnerEntrantId = a
    if (!a && b) match.winnerEntrantId = b

    return {
      type: 'double_elimination',
      size,
      generatedAt: nowIso,
      rounds: [[match]],
      roundLabels: ['Grand Final'],
    }
  }

  // Winners bracket rounds.
  const winnersRounds: Match[][] = []
  for (let r = 0; r < roundsCount; r++) {
    const matchesInRound = size / Math.pow(2, r + 1)
    const matches: Match[] = []

    for (let m = 0; m < matchesInRound; m++) {
      const match: Match = {
        id: newId('match'),
        roundIndex: r,
        matchIndex: m,
        sides: [
          { entrantId: null, score: null },
          { entrantId: null, score: null },
        ],
        winnerEntrantId: null,
      }

      if (r === 0) {
        const a = seeded[m * 2] ?? null
        const b = seeded[m * 2 + 1] ?? null
        match.sides[0].entrantId = a
        match.sides[1].entrantId = b

        if (a && !b) match.winnerEntrantId = a
        if (!a && b) match.winnerEntrantId = b
      }

      matches.push(match)
    }

    winnersRounds.push(matches)
  }

  // Losers bracket rounds.
  const losersRoundsCount = Math.max(0, 2 * (roundsCount - 1))
  const losersRounds: Match[][] = []
  for (let lr = 0; lr < losersRoundsCount; lr++) {
    const matchesInRound = size / (4 * Math.pow(2, Math.floor(lr / 2)))
    const matches: Match[] = []
    for (let m = 0; m < matchesInRound; m++) {
      matches.push({
        id: newId('match'),
        roundIndex: lr,
        matchIndex: m,
        sides: [
          { entrantId: null, score: null },
          { entrantId: null, score: null },
        ],
        winnerEntrantId: null,
      })
    }
    losersRounds.push(matches)
  }

  const combinedRounds: Match[][] = []
  const roundLabels: string[] = []

  function pushRound(matches: Match[], label: string) {
    combinedRounds.push(matches)
    roundLabels.push(label)
  }

  // Ordering is topological and matches common tournament flow:
  // WB1, LB1, WB2, LB2, LB3, WB3, LB4, LB5, ... , WB Final, LB Final, Grand Final.
  pushRound(winnersRounds[0] ?? [], 'Winners Round 1')
  if (losersRoundsCount > 0) pushRound(losersRounds[0] ?? [], 'Losers Round 1')

  for (let w = 1; w <= roundsCount - 2; w++) {
    pushRound(winnersRounds[w] ?? [], `Winners Round ${w + 1}`)
    const a = losersRounds[2 * w - 1]
    const b = losersRounds[2 * w]
    if (a) pushRound(a, `Losers Round ${2 * w}`)
    if (b) pushRound(b, `Losers Round ${2 * w + 1}`)
  }

  if (roundsCount > 1) {
    pushRound(winnersRounds[roundsCount - 1] ?? [], 'Winners Final')
  }
  if (losersRoundsCount > 0) {
    pushRound(losersRounds[losersRoundsCount - 1] ?? [], 'Losers Final')
  }

  const grandFinal: Match[] = [
    {
      id: newId('match'),
      roundIndex: combinedRounds.length,
      matchIndex: 0,
      sides: [
        { entrantId: null, score: null },
        { entrantId: null, score: null },
      ],
      winnerEntrantId: null,
    },
  ]

  pushRound(grandFinal, 'Grand Final')

  // Normalize indices to the combined ordering.
  for (let roundIndex = 0; roundIndex < combinedRounds.length; roundIndex++) {
    const round = combinedRounds[roundIndex]
    for (let matchIndex = 0; matchIndex < round.length; matchIndex++) {
      const match = round[matchIndex]
      if (!match) continue
      match.roundIndex = roundIndex
      match.matchIndex = matchIndex
    }
  }

  const bracket: Bracket = {
    type: 'double_elimination',
    size,
    generatedAt: nowIso,
    rounds: combinedRounds,
    roundLabels,
  }

  // Propagate auto-advances from WB round 1 (byes).
  recomputeDoubleElimDerivedRounds(bracket, 0)

  return bracket
}

export function setDoubleElimMatchResult(
  bracket: Bracket,
  roundIndex: number,
  matchIndex: number,
  winnerSlot: 0 | 1,
  scores?: { a?: number | null; b?: number | null },
): Bracket {
  if (bracket.type !== 'double_elimination') return bracket

  const next = deepClone(bracket)
  const match = next.rounds[roundIndex]?.[matchIndex]
  if (!match) return bracket

  const winnerEntrantId = match.sides[winnerSlot].entrantId
  if (!winnerEntrantId) return bracket

  if (typeof scores?.a === 'number' || scores?.a === null) {
    match.sides[0].score = scores.a ?? null
  }
  if (typeof scores?.b === 'number' || scores?.b === null) {
    match.sides[1].score = scores.b ?? null
  }

  match.winnerEntrantId = winnerEntrantId

  recomputeDoubleElimDerivedRounds(next, roundIndex)
  return next
}

export function setSingleElimMatchResult(
  bracket: Bracket,
  roundIndex: number,
  matchIndex: number,
  winnerSlot: 0 | 1,
  scores?: { a?: number | null; b?: number | null },
): Bracket {
  if (bracket.type !== 'single_elimination') return bracket

  const next = deepClone(bracket)
  const match = next.rounds[roundIndex]?.[matchIndex]
  if (!match) return bracket

  const winnerEntrantId = match.sides[winnerSlot].entrantId
  if (!winnerEntrantId) return bracket

  if (typeof scores?.a === 'number' || scores?.a === null) {
    match.sides[0].score = scores.a ?? null
  }
  if (typeof scores?.b === 'number' || scores?.b === null) {
    match.sides[1].score = scores.b ?? null
  }

  match.winnerEntrantId = winnerEntrantId

  recomputeDerivedRounds(next, roundIndex)
  return next
}

function recommendedSwissRounds(playersCount: number): number {
  if (playersCount <= 1) return 0
  return Math.ceil(Math.log2(playersCount))
}

function seedSwissRound0(bracket: Bracket, entrantIds: string[]) {
  const ids = entrantIds.slice()
  const round0 = bracket.rounds[0]
  if (!round0) return

  for (const match of round0) {
    match.sides[0].entrantId = null
    match.sides[1].entrantId = null
    match.sides[0].score = null
    match.sides[1].score = null
    match.winnerEntrantId = null
  }

  // First round: simple sequential pairing.
  let idx = 0
  for (let m = 0; m < round0.length; m++) {
    const a = ids[idx++] ?? null
    const b = ids[idx++] ?? null
    const match = round0[m]
    if (!match) continue
    match.sides[0].entrantId = a
    match.sides[1].entrantId = b
    if (a && !b) match.winnerEntrantId = a
    if (!a && b) match.winnerEntrantId = b
  }
}

type SwissRecord = {
  wins: number
  losses: number
  byes: number
  opponents: Set<string>
}

function recomputeSwissDerivedRounds(bracket: Bracket, changedRoundIndex: number) {
  // Clear rounds after the changed round; they are derived from earlier results.
  for (let r = changedRoundIndex + 1; r < bracket.rounds.length; r++) {
    for (const match of bracket.rounds[r]) {
      match.sides[0].entrantId = null
      match.sides[1].entrantId = null
      match.sides[0].score = null
      match.sides[1].score = null
      match.winnerEntrantId = null
    }
  }

  const allEntrants = getUniqueEntrants(bracket)
  if (allEntrants.length < 2) return

  // Generate pairings forward round-by-round (starting after the changed round).
  for (let r = Math.max(0, changedRoundIndex); r < bracket.rounds.length - 1; r++) {
    const currentRound = bracket.rounds[r]
    const nextRound = bracket.rounds[r + 1]
    if (!currentRound || !nextRound) break

    if (!isSwissRoundComplete(currentRound)) break

    const { records, hadBye } = computeSwissRecords(bracket, r + 1, allEntrants)
    const pairings = makeSwissPairings(allEntrants, records, hadBye)

    // Fill the next round with new pairings.
    for (const match of nextRound) {
      match.sides[0].entrantId = null
      match.sides[1].entrantId = null
      match.sides[0].score = null
      match.sides[1].score = null
      match.winnerEntrantId = null
    }

    for (let i = 0; i < Math.min(nextRound.length, pairings.length); i++) {
      const match = nextRound[i]
      if (!match) continue
      const [a, b] = pairings[i] ?? [null, null]
      match.sides[0].entrantId = a
      match.sides[1].entrantId = b
      if (a && !b) match.winnerEntrantId = a
      if (!a && b) match.winnerEntrantId = b
    }
  }
}

function isSwissRoundComplete(round: Match[]): boolean {
  for (const match of round) {
    const a = match.sides[0].entrantId
    const b = match.sides[1].entrantId

    // Unseeded placeholder match.
    if (!a && !b) continue

    // Bye match: should already be auto-advanced.
    if ((a && !b) || (!a && b)) {
      if (!match.winnerEntrantId) return false
      continue
    }

    // Normal match.
    if (!match.winnerEntrantId) return false
  }

  return true
}

function getUniqueEntrants(bracket: Bracket): string[] {
  const set = new Set<string>()
  for (const round of bracket.rounds) {
    for (const match of round) {
      const a = match.sides[0].entrantId
      const b = match.sides[1].entrantId
      if (a) set.add(a)
      if (b) set.add(b)
    }
  }
  return Array.from(set)
}

function computeSwissRecords(
  bracket: Bracket,
  upToRoundExclusive: number,
  entrants: string[],
): { records: Map<string, SwissRecord>; hadBye: Set<string> } {
  const records = new Map<string, SwissRecord>()
  const hadBye = new Set<string>()

  for (const id of entrants) {
    records.set(id, { wins: 0, losses: 0, byes: 0, opponents: new Set() })
  }

  for (let r = 0; r < Math.min(upToRoundExclusive, bracket.rounds.length); r++) {
    for (const match of bracket.rounds[r] ?? []) {
      const a = match.sides[0].entrantId
      const b = match.sides[1].entrantId

      if (!a && !b) continue

      if (a && b) {
        records.get(a)?.opponents.add(b)
        records.get(b)?.opponents.add(a)

        if (!match.winnerEntrantId) continue

        if (match.winnerEntrantId === a) {
          records.get(a)!.wins++
          records.get(b)!.losses++
        } else if (match.winnerEntrantId === b) {
          records.get(b)!.wins++
          records.get(a)!.losses++
        }

        continue
      }

      // Bye.
      const winner = a ?? b
      if (!winner) continue
      if (match.winnerEntrantId === winner) {
        records.get(winner)!.wins++
        records.get(winner)!.byes++
        hadBye.add(winner)
      }
    }
  }

  return { records, hadBye }
}

function makeSwissPairings(
  entrants: string[],
  records: Map<string, SwissRecord>,
  hadBye: Set<string>,
): Array<[string | null, string | null]> {
  // Determine bye (odd players): choose someone in the lowest score tier who hasn't had a bye yet.
  const remaining = entrants.slice()
  remaining.sort((a, b) => {
    const ra = records.get(a)?.wins ?? 0
    const rb = records.get(b)?.wins ?? 0
    if (ra !== rb) return rb - ra
    return a.localeCompare(b)
  })

  const byeMatch: Array<[string | null, string | null]> = []
  if (remaining.length % 2 === 1) {
    const asc = remaining.slice().sort((a, b) => {
      const ra = records.get(a)?.wins ?? 0
      const rb = records.get(b)?.wins ?? 0
      if (ra !== rb) return ra - rb
      return a.localeCompare(b)
    })

    const byeCandidate = asc.find((id) => !hadBye.has(id)) ?? asc[0]
    if (byeCandidate) {
      const idx = remaining.indexOf(byeCandidate)
      if (idx >= 0) remaining.splice(idx, 1)
      byeMatch.push([byeCandidate, null])
    }
  }

  // Group by wins and pair inside each tier, floating one down when needed.
  const tiers = new Map<number, string[]>()
  for (const id of remaining) {
    const w = records.get(id)?.wins ?? 0
    const list = tiers.get(w)
    if (list) list.push(id)
    else tiers.set(w, [id])
  }

  const tierKeys = Array.from(tiers.keys()).sort((a, b) => b - a)
  const pairs: Array<[string | null, string | null]> = []

  let carry: string | null = null
  for (const wins of tierKeys) {
    const list = tiers.get(wins) ?? []
    list.sort((a, b) => a.localeCompare(b))

    if (carry) {
      list.unshift(carry)
      carry = null
    }

    while (list.length >= 2) {
      const a = list.shift()!
      const aOpp = records.get(a)?.opponents ?? new Set<string>()

      let bIndex = list.findIndex((candidate) => !aOpp.has(candidate))
      if (bIndex === -1) bIndex = 0

      const b = list.splice(bIndex, 1)[0]!
      pairs.push([a, b])
    }

    if (list.length === 1) carry = list[0]!
  }

  // With an even amount after bye removal, carry should be null. If not, pair as a bye.
  if (carry) pairs.push([carry, null])

  return [...pairs, ...byeMatch]
}

type DoubleElimSection = 'wb' | 'lb' | 'gf'

type DoubleElimRoundInfo = {
  section: DoubleElimSection
  sectionRoundIndex: number
}

type MatchRef = {
  roundIndex: number
  matchIndex: number
  slot: 0 | 1
}

type MatchSource =
  | { kind: 'seed' }
  | { kind: 'winner'; fromRoundIndex: number; fromMatchIndex: number }
  | { kind: 'loser'; fromRoundIndex: number; fromMatchIndex: number }

function recomputeDoubleElimDerivedRounds(bracket: Bracket, changedRoundIndex: number) {
  if (bracket.type !== 'double_elimination') return

  const size = bracket.size
  const roundsCount = Math.log2(size)
  if (!Number.isFinite(roundsCount) || roundsCount < 1) return

  if (roundsCount <= 1) {
    const match = bracket.rounds[0]?.[0]
    if (!match) return
    if (match.winnerEntrantId) return
    const a = match.sides[0].entrantId
    const b = match.sides[1].entrantId
    if (a && !b) match.winnerEntrantId = a
    if (!a && b) match.winnerEntrantId = b
    return
  }

  // Clear rounds after the changed round; they are derived from earlier results.
  for (let r = changedRoundIndex + 1; r < bracket.rounds.length; r++) {
    for (const match of bracket.rounds[r]) {
      match.sides[0].entrantId = null
      match.sides[1].entrantId = null
      match.sides[0].score = null
      match.sides[1].score = null
      match.winnerEntrantId = null
    }
  }

  // Iteratively propagate results + auto-advances for resolved byes.
  for (let iter = 0; iter < bracket.rounds.length + 1; iter++) {
    // Propagate winners/losers forward.
    for (let r = 0; r < bracket.rounds.length; r++) {
      for (const match of bracket.rounds[r]) {
        if (!match.winnerEntrantId) continue

        const targets = doubleElimTargetsForMatch(size, r, match.matchIndex)
        if (targets.winner) {
          const dest = bracket.rounds[targets.winner.roundIndex]?.[targets.winner.matchIndex]
          if (dest) dest.sides[targets.winner.slot].entrantId = match.winnerEntrantId
        }

        if (targets.loser) {
          const loser = loserEntrantId(match)
          if (loser) {
            const dest = bracket.rounds[targets.loser.roundIndex]?.[targets.loser.matchIndex]
            if (dest) dest.sides[targets.loser.slot].entrantId = loser
          }
        }
      }
    }

    let anyNewWinner = false

    // Auto-advance byes only when both incoming sources are resolved.
    for (let r = 0; r < bracket.rounds.length; r++) {
      for (const match of bracket.rounds[r]) {
        if (match.winnerEntrantId) continue

        const a = match.sides[0].entrantId
        const b = match.sides[1].entrantId
        const hasExactlyOne = (a && !b) || (!a && b)
        if (!hasExactlyOne) continue

        const aResolved = doubleElimIsSideResolved(bracket, r, match.matchIndex, 0)
        const bResolved = doubleElimIsSideResolved(bracket, r, match.matchIndex, 1)
        if (!aResolved || !bResolved) continue

        match.winnerEntrantId = a ?? b
        anyNewWinner = true
      }
    }

    if (!anyNewWinner) break
  }
}

function loserEntrantId(match: Match): string | null {
  const a = match.sides[0].entrantId
  const b = match.sides[1].entrantId
  if (!a || !b) return null
  if (match.winnerEntrantId === a) return b
  if (match.winnerEntrantId === b) return a
  return null
}

function doubleElimTargetsForMatch(size: number, roundIndex: number, matchIndex: number): { winner?: MatchRef; loser?: MatchRef } {
  const info = doubleElimRoundInfo(size, roundIndex)
  const roundsCount = Math.log2(size)
  const losersRoundsCount = Math.max(0, 2 * (roundsCount - 1))

  const winnersFinalIndex = doubleElimCombinedIndexForWbRound(size, roundsCount - 1)
  const grandFinalIndex = winnersFinalIndex + 2

  if (info.section === 'wb') {
    const r = info.sectionRoundIndex

    const winner: MatchRef | undefined =
      r < roundsCount - 1
        ? {
            roundIndex: doubleElimCombinedIndexForWbRound(size, r + 1),
            matchIndex: Math.floor(matchIndex / 2),
            slot: (matchIndex % 2) as 0 | 1,
          }
        : {
            roundIndex: grandFinalIndex,
            matchIndex: 0,
            slot: 0,
          }

    let loser: MatchRef | undefined
    if (r === roundsCount - 1) {
      // Loser of winners final -> losers final (slot 1).
      loser = {
        roundIndex: doubleElimCombinedIndexForLbRound(size, losersRoundsCount - 1),
        matchIndex: 0,
        slot: 1,
      }
    } else if (r === 0) {
      loser = {
        roundIndex: doubleElimCombinedIndexForLbRound(size, 0),
        matchIndex: Math.floor(matchIndex / 2),
        slot: (matchIndex % 2) as 0 | 1,
      }
    } else {
      loser = {
        roundIndex: doubleElimCombinedIndexForLbRound(size, 2 * r - 1),
        matchIndex,
        slot: 1,
      }
    }

    return { winner, loser }
  }

  if (info.section === 'lb') {
    const r = info.sectionRoundIndex

    if (r === losersRoundsCount - 1) {
      return {
        winner: {
          roundIndex: grandFinalIndex,
          matchIndex: 0,
          slot: 1,
        },
      }
    }

    if (r % 2 === 0) {
      return {
        winner: {
          roundIndex: doubleElimCombinedIndexForLbRound(size, r + 1),
          matchIndex,
          slot: 0,
        },
      }
    }

    return {
      winner: {
        roundIndex: doubleElimCombinedIndexForLbRound(size, r + 1),
        matchIndex: Math.floor(matchIndex / 2),
        slot: (matchIndex % 2) as 0 | 1,
      },
    }
  }

  return {}
}

function doubleElimIsSideResolved(bracket: Bracket, roundIndex: number, matchIndex: number, sideIndex: 0 | 1): boolean {
  const src = doubleElimMatchSideSource(bracket.size, roundIndex, matchIndex, sideIndex)
  return doubleElimIsSourceResolved(bracket, src)
}

function doubleElimIsSourceResolved(bracket: Bracket, src: MatchSource): boolean {
  if (src.kind === 'seed') return true

  const match = bracket.rounds[src.fromRoundIndex]?.[src.fromMatchIndex]
  if (!match) return false

  // Both winner and loser sources are resolved once the source match has a winner.
  return Boolean(match.winnerEntrantId)
}

function doubleElimMatchSideSource(
  size: number,
  roundIndex: number,
  matchIndex: number,
  sideIndex: 0 | 1,
): MatchSource {
  const roundsCount = Math.log2(size)
  const winnersFinalIndex = doubleElimCombinedIndexForWbRound(size, roundsCount - 1)
  const losersFinalIndex = winnersFinalIndex + 1
  const grandFinalIndex = winnersFinalIndex + 2

  if (roundIndex === grandFinalIndex) {
    if (sideIndex === 0) {
      return {
        kind: 'winner',
        fromRoundIndex: winnersFinalIndex,
        fromMatchIndex: 0,
      }
    }
    return {
      kind: 'winner',
      fromRoundIndex: losersFinalIndex,
      fromMatchIndex: 0,
    }
  }

  const info = doubleElimRoundInfo(size, roundIndex)
  if (info.section === 'wb') {
    const r = info.sectionRoundIndex
    if (r === 0) return { kind: 'seed' }

    const prevRoundIndex = doubleElimCombinedIndexForWbRound(size, r - 1)
    return {
      kind: 'winner',
      fromRoundIndex: prevRoundIndex,
      fromMatchIndex: matchIndex * 2 + sideIndex,
    }
  }

  if (info.section === 'lb') {
    const r = info.sectionRoundIndex
    if (r === 0) {
      const wb0 = doubleElimCombinedIndexForWbRound(size, 0)
      return {
        kind: 'loser',
        fromRoundIndex: wb0,
        fromMatchIndex: matchIndex * 2 + sideIndex,
      }
    }

    if (r % 2 === 1) {
      if (sideIndex === 0) {
        return {
          kind: 'winner',
          fromRoundIndex: doubleElimCombinedIndexForLbRound(size, r - 1),
          fromMatchIndex: matchIndex,
        }
      }

      const wbRound = (r + 1) / 2
      return {
        kind: 'loser',
        fromRoundIndex: doubleElimCombinedIndexForWbRound(size, wbRound),
        fromMatchIndex: matchIndex,
      }
    }

    // Even round (> 0): merges two previous matches.
    return {
      kind: 'winner',
      fromRoundIndex: doubleElimCombinedIndexForLbRound(size, r - 1),
      fromMatchIndex: matchIndex * 2 + sideIndex,
    }
  }

  // Should not happen.
  return { kind: 'seed' }
}

function doubleElimRoundInfo(size: number, roundIndex: number): DoubleElimRoundInfo {
  const roundsCount = Math.log2(size)
  const loopBlocks = Math.max(0, roundsCount - 2)
  const winnersFinalIndex = 2 + loopBlocks * 3
  const losersFinalIndex = winnersFinalIndex + 1
  const grandFinalIndex = winnersFinalIndex + 2

  if (roundIndex === 0) return { section: 'wb', sectionRoundIndex: 0 }
  if (roundIndex === 1) return { section: 'lb', sectionRoundIndex: 0 }
  if (roundIndex === winnersFinalIndex) return { section: 'wb', sectionRoundIndex: roundsCount - 1 }
  if (roundIndex === losersFinalIndex) return { section: 'lb', sectionRoundIndex: 2 * roundsCount - 3 }
  if (roundIndex === grandFinalIndex) return { section: 'gf', sectionRoundIndex: 0 }

  if (roundIndex < winnersFinalIndex) {
    const offset = roundIndex - 2
    const block = Math.floor(offset / 3)
    const pos = offset % 3
    const w = block + 1

    if (pos === 0) return { section: 'wb', sectionRoundIndex: w }
    if (pos === 1) return { section: 'lb', sectionRoundIndex: 2 * w - 1 }
    return { section: 'lb', sectionRoundIndex: 2 * w }
  }

  return { section: 'gf', sectionRoundIndex: 0 }
}

function doubleElimCombinedIndexForWbRound(size: number, wbRoundIndex: number): number {
  const roundsCount = Math.log2(size)
  const loopBlocks = Math.max(0, roundsCount - 2)
  const winnersFinalIndex = 2 + loopBlocks * 3

  if (wbRoundIndex === 0) return 0
  if (wbRoundIndex >= 1 && wbRoundIndex <= roundsCount - 2) return 2 + (wbRoundIndex - 1) * 3
  return winnersFinalIndex
}

function doubleElimCombinedIndexForLbRound(size: number, lbRoundIndex: number): number {
  const roundsCount = Math.log2(size)
  const losersRoundsCount = Math.max(0, 2 * (roundsCount - 1))
  const loopBlocks = Math.max(0, roundsCount - 2)
  const winnersFinalIndex = 2 + loopBlocks * 3
  const losersFinalIndex = winnersFinalIndex + 1

  if (lbRoundIndex === 0) return 1
  if (lbRoundIndex === losersRoundsCount - 1) return losersFinalIndex

  const w = Math.ceil(lbRoundIndex / 2)
  const pos = lbRoundIndex % 2 === 1 ? 1 : 2
  return 2 + (w - 1) * 3 + pos
}

function recomputeDerivedRounds(bracket: Bracket, changedRoundIndex: number) {
  // Clear rounds after the changed round; they are derived from earlier winners.
  for (let r = changedRoundIndex + 1; r < bracket.rounds.length; r++) {
    for (const match of bracket.rounds[r]) {
      match.sides[0].entrantId = null
      match.sides[1].entrantId = null
      match.sides[0].score = null
      match.sides[1].score = null
      match.winnerEntrantId = null
    }
  }

  // Propagate winners forward.
  for (let r = 0; r < bracket.rounds.length - 1; r++) {
    for (const match of bracket.rounds[r]) {
      if (!match.winnerEntrantId) continue

      const nextRound = bracket.rounds[r + 1]
      const nextMatchIndex = Math.floor(match.matchIndex / 2)
      const nextSlot = (match.matchIndex % 2) as 0 | 1
      const nextMatch = nextRound?.[nextMatchIndex]
      if (!nextMatch) continue

      nextMatch.sides[nextSlot].entrantId = match.winnerEntrantId
    }
  }
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}
