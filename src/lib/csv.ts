import type { Tournament } from './models'
import { computeTournamentReport } from './reporting'

function esc(value: string): string {
  const needsQuotes = /[\n\r,"]/g.test(value)
  const escaped = value.replace(/"/g, '""')
  return needsQuotes ? `"${escaped}"` : escaped
}

export function tournamentReportToCsv(tournament: Tournament, gameName: string): string {
  const report = computeTournamentReport(tournament)

  const lines: string[][] = []

  lines.push(['Tournament', tournament.name])
  lines.push(['Game', gameName])
  lines.push(['Format', tournament.format])
  lines.push(['Created At', tournament.createdAt])
  lines.push([])

  lines.push(['Entrants (Total)', String(report.entrantsCount)])
  lines.push(['Entrants (Checked-in)', String(report.checkedInCount)])
  lines.push(['Billable Entrants', String(report.billableCount)])
  lines.push(['Ticket Cost', String(report.ticketCost)])
  lines.push(['Revenue', String(report.revenue)])
  lines.push(['Vendor Payouts Total', String(report.vendorTotal)])
  lines.push(['Prize Payouts Total', String(report.prizesTotal)])
  lines.push(['Net Profit', String(report.netProfit)])
  lines.push([])

  lines.push(['Vendors'])
  lines.push(['Name', 'Type', 'Value', 'Payout'])
  for (const v of tournament.finance.vendors) {
    const payout = report.vendorPayouts.find((p) => p.vendorId === v.id)?.amount ?? 0
    lines.push([v.name, v.type, String(v.value), String(payout)])
  }
  lines.push([])

  lines.push(['Prizes'])
  lines.push(['Placement', 'Label', 'Amount'])
  for (const p of tournament.finance.prizes.slice().sort((a, b) => a.placement - b.placement)) {
    lines.push([String(p.placement), p.label, String(p.amount)])
  }

  return lines.map((row) => row.map((cell) => esc(cell ?? '')).join(',')).join('\n')
}
