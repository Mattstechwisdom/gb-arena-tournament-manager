import type { PrizePlacement, Tournament, VendorShare } from './models'

export interface VendorPayout {
  vendorId: string
  name: string
  amount: number
}

export interface TournamentReport {
  entrantsCount: number
  checkedInCount: number
  billableCount: number
  ticketCost: number
  revenue: number
  vendorTotal: number
  prizesTotal: number
  netProfit: number
  vendorPayouts: VendorPayout[]
}

export function computeTournamentReport(tournament: Tournament): TournamentReport {
  const entrantsCount = tournament.entrants.length
  const checkedInCount = tournament.entrants.filter((e) => e.checkedIn).length
  const billableCount = checkedInCount > 0 ? checkedInCount : entrantsCount

  const ticketCost = clampNonNegative(tournament.finance.ticketCost)
  const revenue = roundMoney(ticketCost * billableCount)

  const vendorPayouts = tournament.finance.vendors.map((v) => ({
    vendorId: v.id,
    name: v.name,
    amount: roundMoney(vendorPayoutAmount(v, revenue)),
  }))

  const vendorTotal = roundMoney(vendorPayouts.reduce((sum, v) => sum + v.amount, 0))
  const prizesTotal = roundMoney(tournament.finance.prizes.reduce((sum, p) => sum + prizeAmount(p), 0))
  const netProfit = roundMoney(revenue - vendorTotal - prizesTotal)

  return {
    entrantsCount,
    checkedInCount,
    billableCount,
    ticketCost,
    revenue,
    vendorTotal,
    prizesTotal,
    netProfit,
    vendorPayouts,
  }
}

function vendorPayoutAmount(vendor: VendorShare, revenue: number): number {
  if (vendor.type === 'fixed') return clampNonNegative(vendor.value)
  const percent = clampNonNegative(vendor.value)
  return revenue * (percent / 100)
}

function prizeAmount(prize: PrizePlacement): number {
  return clampNonNegative(prize.amount)
}

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, value)
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}
