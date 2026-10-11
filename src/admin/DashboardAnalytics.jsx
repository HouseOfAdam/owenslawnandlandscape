import { useMemo, useState } from "react";
import {
  MONTHS, fmtMoney, fmtPct, marginTone, rollupBy, activeMonthRange, monthOf,
} from "../lib/profitability";
import { MonthlyRevExpChart, ChartLegend, ProfitBars, CHART_COLORS } from "./charts";
import { Pill, MarginPill, Panel, Tile } from "./ui";

const shortDate = (d) => (d ? `${MONTHS[monthOf(d)]} ${Number(String(d).slice(8, 10))}` : "");

export default function DashboardAnalytics({ monthly, year, costing, customers, expenses, projectedSeasonRevenue, onOpenProfit, onOpenExpenses }) {
  const [showTable, setShowTable] = useState(true);
  const rows = activeMonthRange(monthly, year);
  const tot = monthly.reduce((t, r) => ({ revenue: t.revenue + r.revenue, expenses: t.expenses + r.expenses, jobs: t.jobs + r.jobs }), { revenue: 0, expenses: 0, jobs: 0 });
  const net = tot.revenue - tot.expenses;
  const nowM = new Date().getMonth();
  const isCurrentYear = year === new Date().getFullYear();
  const thisMonth = isCurrentYear ? monthly[nowM] : null;
  const lastMonth = isCurrentYear && nowM > 0 ? monthly[nowM - 1] : null;
  const best = rows.reduce((b, r) => (r.net > (b?.net ?? -Infinity) ? r : b), null);

  const { jobs, totals, settings } = costing;
  const byService = useMemo(() => rollupBy(jobs, (j) => j.category, settings), [jobs, settings]);
  const bySource = useMemo(() => rollupBy(jobs, (j) => j.source, settings), [jobs, settings]);
  const meaningful = jobs.filter((j) => j.revenue > 0 && j.timeSource);
  const topJobs = [...jobs].filter((j) => !j.incomplete).sort((a, b) => b.profit - a.profit).slice(0, 5);
  const lowJobs = [...meaningful].filter((j) => j.revenue >= 50).sort((a, b) => (a.margin ?? 9) - (b.margin ?? 9)).slice(0, 5);

  const expByCat = useMemo(() => {
    const m = new Map();
    for (const e of expenses) {
      if (Number(String(e.date).slice(0, 4)) !== year) continue;
      m.set(e.category, (m.get(e.category) || 0) + Number(e.amount || 0));
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses, year]);
  const expMax = Math.max(1, ...expByCat.map(([, v]) => v));

  const JobLine = ({ j }) => (
    <button type="button" onClick={() => onOpenProfit("jobs")} className="w-full text-left flex flex-wrap sm:flex-nowrap items-center justify-between gap-x-3 gap-y-1 py-2 hover:bg-stone-800/40 rounded-lg px-2 -mx-2">
      <div className="min-w-0">
        <div className="text-sm text-stone-100 truncate"><span className="font-bold">{j.label}</span> <span className="text-stone-300">{j.category === "Other" ? (j.notes || j.service) : j.category}</span></div>
        <div className="text-[11px] text-stone-500">{shortDate(j.date)} · {j.source}</div>
      </div>
      <div className="text-xs text-right shrink-0">
        <span className="text-stone-500">Rev </span><span className="text-emerald-400 font-bold">{fmtMoney(j.revenue)}</span>
        <span className="text-stone-600"> | </span>
        <span className="text-stone-500">Exp </span><span className="text-red-400 font-bold">{fmtMoney(j.totalCost)}</span>
        <span className="ml-2"><MarginPill job={j} /></span>
      </div>
    </button>
  );

  return (
    <div className="space-y-5 mb-5">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Tile label="Revenue" value={fmtMoney(tot.revenue)} sub={thisMonth ? `${fmtMoney(thisMonth.revenue)} this month · ${tot.jobs} jobs` : `${tot.jobs} jobs completed`} />
        <Tile label="Expenses" value={fmtMoney(tot.expenses)} sub={thisMonth ? `${fmtMoney(thisMonth.expenses)} this month` : `${year} total`} tone="text-red-400" />
        <Tile label="Net profit" value={fmtMoney(net)} sub={`${fmtPct(tot.revenue ? net / tot.revenue : null)} margin`} tone={net >= 0 ? "text-amber-400" : "text-red-400"} />
        <Tile label="Revenue / person-hr" value={totals.revPerPersonHour ? fmtMoney(totals.revPerPersonHour) : "—"} sub={`target ${fmtMoney(settings.targetHourly)} · ${Math.round(totals.timeCoverage * 100)}% of jobs timed`}
          tone={totals.revPerPersonHour && totals.revPerPersonHour >= settings.targetHourly ? "text-emerald-400" : "text-amber-400"} />
        <Tile label="Active clients" value={customers.filter((c) => c.status === "Active").length}
          sub={projectedSeasonRevenue ? `${fmtMoney(projectedSeasonRevenue)} recurring season value` : `of ${customers.length} total`} tone="text-blue-400" />
      </div>

      {/* Monthly chart */}
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-bold text-stone-100">Revenue vs. Expenses by Month</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {best && best.net > 0 ? <>Best month: <span className="text-stone-300">{best.month}</span> ({fmtMoney(best.net)} net). </> : null}
              {lastMonth && (lastMonth.revenue || thisMonth?.revenue) ? <>{MONTHS[nowM]} so far: {fmtMoney(thisMonth.revenue)} vs {fmtMoney(lastMonth.revenue)} in {MONTHS[nowM - 1]}.</> : null}
            </p>
          </div>
          <ChartLegend items={[
            { label: "Revenue", color: CHART_COLORS.revenue },
            { label: "Expenses", color: CHART_COLORS.expense },
            { label: "Net profit (under each month)", color: CHART_COLORS.profit },
          ]} />
        </div>
        <MonthlyRevExpChart rows={rows} />
        <div className="flex justify-end mt-1">
          <button onClick={() => setShowTable((s) => !s)} className="text-xs text-emerald-500 hover:text-emerald-400">{showTable ? "Hide" : "Show"} monthly table</button>
        </div>
        {showTable && (
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="border-b border-stone-800 text-[11px] uppercase tracking-wider text-stone-500">
                  {["Month", "Revenue", "Expenses", "Net", "Margin", "Jobs"].map((h, i) => <th key={h} className={`py-2 px-2 font-semibold ${i ? "text-right" : "text-left"}`}>{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60">
                {rows.map((r) => (
                  <tr key={r.month}>
                    <td className="py-2 px-2 text-stone-300 font-semibold">{r.month}</td>
                    <td className="py-2 px-2 text-right font-bold" style={{ color: CHART_COLORS.revenue }}>{fmtMoney(r.revenue)}</td>
                    <td className="py-2 px-2 text-right font-bold" style={{ color: CHART_COLORS.expense }}>{fmtMoney(r.expenses)}</td>
                    <td className="py-2 px-2 text-right font-bold" style={{ color: r.net >= 0 ? CHART_COLORS.profit : CHART_COLORS.expense }}>{fmtMoney(r.net)}</td>
                    <td className="py-2 px-2 text-right"><Pill tone={marginTone(r.margin)}>{fmtPct(r.margin)}</Pill></td>
                    <td className="py-2 px-2 text-right text-stone-400">{r.jobs}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-stone-700">
                  <td className="py-2 px-2 text-stone-100 font-bold">Total</td>
                  <td className="py-2 px-2 text-right font-black" style={{ color: CHART_COLORS.revenue }}>{fmtMoney(tot.revenue)}</td>
                  <td className="py-2 px-2 text-right font-black" style={{ color: CHART_COLORS.expense }}>{fmtMoney(tot.expenses)}</td>
                  <td className="py-2 px-2 text-right font-black" style={{ color: net >= 0 ? CHART_COLORS.profit : CHART_COLORS.expense }}>{fmtMoney(net)}</td>
                  <td className="py-2 px-2 text-right"><Pill tone={marginTone(tot.revenue ? net / tot.revenue : null)}>{fmtPct(tot.revenue ? net / tot.revenue : null)}</Pill></td>
                  <td className="py-2 px-2 text-right text-stone-300 font-bold">{tot.jobs}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Service + jobs */}
      <div className="grid lg:grid-cols-2 gap-5">
        <Panel>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-stone-100">Profit by Service</h3>
            <button onClick={() => onOpenProfit("services")} className="text-xs text-emerald-500 hover:text-emerald-400">Full rollup →</button>
          </div>
          <ProfitBars rows={byService.slice(0, 7)} onSelect={(cat) => onOpenProfit("jobs", cat)} />
          <p className="text-[11px] text-stone-600 mt-3">Bright green = profit after materials, labor time and overhead. Tap a service to see its jobs.</p>
        </Panel>
        <Panel>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-stone-100">Job Profitability</h3>
            <button onClick={() => onOpenProfit("jobs")} className="text-xs text-emerald-500 hover:text-emerald-400">All jobs →</button>
          </div>
          <div className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold mt-2">Most profitable</div>
          <div className="divide-y divide-stone-800/60">{topJobs.map((j) => <JobLine key={j.id} j={j} />)}</div>
          <div className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold mt-4">Lowest margin (jobs $50+)</div>
          <div className="divide-y divide-stone-800/60">{lowJobs.map((j) => <JobLine key={j.id} j={j} />)}</div>
          {(costing.unassigned.length > 0 || totals.timeCoverage < 0.6) && (
            <button onClick={() => (costing.unassigned.length > 0 && onOpenExpenses ? onOpenExpenses() : onOpenProfit("time"))} className="mt-4 w-full text-left text-xs bg-amber-950/40 border border-amber-800/50 text-amber-200 rounded-xl px-3 py-2.5 hover:bg-amber-950/60">
              Sharpen these numbers: {costing.unassigned.length > 0 ? `${costing.unassigned.length} material/wage expenses need a job tag` : ""}{costing.unassigned.length > 0 && totals.timeCoverage < 0.6 ? " and " : ""}{totals.timeCoverage < 0.6 ? `${totals.jobs - totals.loggedJobs} jobs have no logged time` : ""} →
            </button>
          )}
        </Panel>
      </div>

      {/* Source + expense mix */}
      <div className="grid lg:grid-cols-2 gap-5">
        <Panel>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-stone-100">Revenue by Customer Source</h3>
            <button onClick={() => onOpenProfit("sources")} className="text-xs text-emerald-500 hover:text-emerald-400">Details →</button>
          </div>
          <ProfitBars rows={bySource} />
        </Panel>
        <Panel>
          <h3 className="font-bold text-stone-100 mb-4">Where the Money Goes</h3>
          <div className="space-y-2.5">
            {expByCat.map(([cat, v]) => (
              <div key={cat}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-stone-300">{cat}</span>
                  <span className="text-xs text-stone-400"><span className="font-bold text-red-400">{fmtMoney(v)}</span> · {fmtPct(tot.expenses ? v / tot.expenses : null)}</span>
                </div>
                <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(v / expMax) * 100}%`, background: CHART_COLORS.expense, opacity: 0.85 }} />
                </div>
              </div>
            ))}
            {expByCat.length === 0 && <p className="text-sm text-stone-500">No expenses logged for {year}.</p>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
