import { useMemo } from 'react'
import { computeTournamentReport } from '../lib/reporting'
import { tournamentReportToCsv } from '../lib/csv'
import { getGameById } from '../data/games'
import { getActiveTournament, useArenaStore } from '../state/arenaStore'
import { placementLabel } from '../lib/models'

export function ReportingPage() {
  const tournament = useArenaStore((s) => getActiveTournament(s))
  const customGames = useArenaStore((s) => s.customGames)

  const setTicketCost = useArenaStore((s) => s.setTicketCost)
  const addVendor = useArenaStore((s) => s.addVendor)
  const updateVendor = useArenaStore((s) => s.updateVendor)
  const removeVendor = useArenaStore((s) => s.removeVendor)

  const addPrize = useArenaStore((s) => s.addPrize)
  const updatePrize = useArenaStore((s) => s.updatePrize)
  const removePrize = useArenaStore((s) => s.removePrize)

  const gameName = useMemo(
    () => (tournament ? (getGameById(tournament.gameId, customGames)?.name ?? 'Unknown game') : ''),
    [customGames, tournament],
  )

  const report = useMemo(() => (tournament ? computeTournamentReport(tournament) : null), [tournament])

  if (!tournament || !report) {
    return (
      <div className="space-y-4">
        <div className="text-xl font-semibold">Reporting</div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
          Select or create a tournament to view reporting.
        </div>
      </div>
    )
  }

  async function exportCsv() {
    if (!tournament) return

    const csv = tournamentReportToCsv(tournament, gameName)
    const safeName = tournament.name.trim().replace(/[\\/:*?"<>|]/g, '_')
    await window.arena.files.saveTextFile({
      defaultPath: `${safeName || 'tournament'}-report.csv`,
      content: csv,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold">Reporting</div>
        <div className="text-sm text-slate-300">
          {tournament.name} • {gameName}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="text-sm font-semibold">Vendors</div>
            <div className="mt-3 space-y-3">
              {tournament.finance.vendors.map((v) => (
                <div key={v.id} className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3 md:grid-cols-[1fr_140px_140px_auto]">
                  <input
                    value={v.name}
                    onChange={(e) => updateVendor(tournament.id, { ...v, name: e.target.value })}
                    placeholder="Vendor name"
                    className="rounded-md border border-slate-800 bg-slate-950/40 px-2 py-2 text-sm"
                  />

                  <select
                    value={v.type}
                    onChange={(e) => updateVendor(tournament.id, { ...v, type: e.target.value as 'fixed' | 'percent' })}
                    className="rounded-md border border-slate-800 bg-slate-950/40 px-2 py-2 text-sm"
                  >
                    <option value="fixed">Fixed</option>
                    <option value="percent">Percent</option>
                  </select>

                  <input
                    type="number"
                    min={0}
                    step={v.type === 'percent' ? 0.5 : 1}
                    value={Number.isFinite(v.value) ? v.value : 0}
                    onChange={(e) => updateVendor(tournament.id, { ...v, value: Number(e.target.value) })}
                    className="rounded-md border border-slate-800 bg-slate-950/40 px-2 py-2 text-sm"
                  />

                  <button
                    type="button"
                    onClick={() => removeVendor(tournament.id, v.id)}
                    className="rounded-md border border-slate-800 bg-slate-950/40 px-2 py-2 text-sm hover:bg-slate-900/50"
                  >
                    Remove
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => addVendor(tournament.id, { name: 'Vendor', type: 'percent', value: 10 })}
                className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm font-semibold hover:bg-slate-900/50"
              >
                Add Vendor
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="text-sm font-semibold">Prizes</div>
            <div className="mt-3 space-y-3">
              {tournament.finance.prizes
                .slice()
                .sort((a, b) => a.placement - b.placement)
                .map((p) => (
                  <div key={p.id} className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3 md:grid-cols-[100px_1fr_160px_auto]">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={p.placement}
                      onChange={(e) => {
                        const placement = Math.max(1, Number(e.target.value))
                        updatePrize(tournament.id, { ...p, placement, label: placementLabel(placement) })
                      }}
                      className="rounded-md border border-slate-800 bg-slate-950/40 px-2 py-2 text-sm"
                    />
                    <input
                      value={p.label}
                      onChange={(e) => updatePrize(tournament.id, { ...p, label: e.target.value })}
                      className="rounded-md border border-slate-800 bg-slate-950/40 px-2 py-2 text-sm"
                    />
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={Number.isFinite(p.amount) ? p.amount : 0}
                      onChange={(e) => updatePrize(tournament.id, { ...p, amount: Number(e.target.value) })}
                      className="rounded-md border border-slate-800 bg-slate-950/40 px-2 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removePrize(tournament.id, p.id)}
                      className="rounded-md border border-slate-800 bg-slate-950/40 px-2 py-2 text-sm hover:bg-slate-900/50"
                    >
                      Remove
                    </button>
                  </div>
                ))}

              <button
                type="button"
                onClick={() => {
                  const placement = (tournament.finance.prizes.reduce((m, p) => Math.max(m, p.placement), 0) || 0) + 1
                  addPrize(tournament.id, {
                    placement,
                    label: placementLabel(placement),
                    amount: 0,
                  })
                }}
                className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm font-semibold hover:bg-slate-900/50"
              >
                Add Placement
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="text-sm font-semibold">Ticketing</div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-slate-300">Ticket cost</label>
              <input
                type="number"
                min={0}
                step={1}
                value={Number.isFinite(tournament.finance.ticketCost) ? tournament.finance.ticketCost : 0}
                onChange={(e) => setTicketCost(tournament.id, Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950/40 px-2 py-2 text-sm"
              />
              <div className="mt-2 text-xs text-slate-400">Revenue uses checked-in entrants when available.</div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="text-sm font-semibold">Summary</div>
            <div className="mt-3 space-y-2 text-sm">
              <Row label="Entrants (total)" value={report.entrantsCount} />
              <Row label="Checked-in" value={report.checkedInCount} />
              <Row label="Billable" value={report.billableCount} />
              <Row label="Ticket" value={money(report.ticketCost)} />
              <div className="h-px bg-slate-800" />
              <Row label="Revenue" value={money(report.revenue)} />
              <Row label="Vendors" value={money(report.vendorTotal)} />
              <Row label="Prizes" value={money(report.prizesTotal)} />
              <div className="h-px bg-slate-800" />
              <Row label="Net Profit" value={money(report.netProfit)} strong />
            </div>

            <button
              type="button"
              onClick={exportCsv}
              className="mt-4 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: number | string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-slate-300">{label}</div>
      <div className={['tabular-nums', strong ? 'font-semibold text-slate-100' : 'text-slate-100'].join(' ')}>{value}</div>
    </div>
  )
}

function money(value: number): string {
  return `$${(Number.isFinite(value) ? value : 0).toFixed(2)}`
}
