import { useEffect, useMemo, useState } from "react";
import * as db from "../lib/db";
import {
  SERVICE_CATEGORIES, CUSTOMER_SOURCES, MONTHS,
  fmtMoney, fmtPct, fmtHours, marginTone, rollupBy, monthOf, jobLabelName,
} from "../lib/profitability";
import { ProfitBars } from "./charts";

import { Pill, MarginPill, Panel, Tile, Modal, inputCls, btn, btnPrimary, btnGhost } from "./ui";

const shortDate = (d) => {
  if (!d) return "";
  const m = monthOf(d);
  return `${MONTHS[m] || ""} ${Number(String(d).slice(8, 10))}`;
};
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const TIME_CHIPS = [[30, "30m"], [45, "45m"], [60, "1h"], [90, "1.5h"], [120, "2h"], [180, "3h"], [240, "4h"], [480, "8h"]];
const COST_CATEGORIES = ["Materials", "Wages", "Contract Labor", "Equipment", "Automobile Fuel", "Other"];

const timePill = (j) => {
  if (j.timeSource === "logged") return <Pill tone="green">⏱ {fmtHours(j.minutes)}{j.crew > 1 ? ` × ${j.crew}` : ""}</Pill>;
  if (j.timeSource === "estimate") return <Pill tone="gray">~{fmtHours(j.minutes)} est.</Pill>;
  return <Pill tone="yellow">No time</Pill>;
};

// ============================================================
// MAIN TAB
// ============================================================
export default function JobProfitabilityTab({
  costing, customers, serviceVisits, serviceTypes = [], year,
  onRefreshVisits, onRefreshExpenses, onRefreshCustomers, onRefreshAllocations, onSaveSettings,
  initialView = "jobs", initialCategory = "", onOpenExpenses,
}) {
  const [view, setView] = useState(initialView);
  const [filters, setFilters] = useState({ q: "", category: initialCategory, source: "", month: "", needsTime: false, sort: "date" });
  const [openJobId, setOpenJobId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showStartTimer, setShowStartTimer] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => { setView(initialView); }, [initialView]);
  useEffect(() => { if (initialCategory) setFilters((f) => ({ ...f, category: initialCategory })); }, [initialCategory]);

  const { jobs, totals, settings, unassigned } = costing;
  const byService = useMemo(() => rollupBy(jobs, (j) => j.category, settings), [jobs, settings]);
  const bySource = useMemo(() => rollupBy(jobs, (j) => j.source, settings), [jobs, settings]);
  const needsTimeCount = jobs.filter((j) => j.timeSource !== "logged").length;
  const openJob = jobs.find((j) => j.id === openJobId) || null;
  const refreshAll = async () => { await Promise.all([onRefreshVisits(), onRefreshExpenses(), onRefreshAllocations()]); };

  const goToService = (cat) => { setFilters((f) => ({ ...f, category: cat, source: "" })); setView("jobs"); };
  const goToSource = (src) => { setFilters((f) => ({ ...f, source: src, category: "" })); setView("jobs"); };

  const views = [
    { id: "jobs", label: "Jobs", count: jobs.length },
    { id: "services", label: "By service" },
    { id: "sources", label: "By source" },
    { id: "time", label: "Log time", count: needsTimeCount, alert: needsTimeCount > 0 },
  ];

  return (
    <div>
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-extrabold">Job Profitability</h1>
          <p className="text-stone-500 text-sm">{year} season · what every job earned after materials, labor time, and overhead</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowStartTimer(true)} className={btnPrimary}>▶ Start job timer</button>
          <button onClick={() => setShowSettings(true)} className={btnGhost}>⚙ Rates</button>
          <button onClick={() => setShowHelp((s) => !s)} className={btnGhost}>How it's calculated</button>
        </div>
      </div>

      {showHelp && <HowItWorks settings={settings} costing={costing} />}

      <RunningTimers serviceVisits={serviceVisits} customers={customers} onChanged={onRefreshVisits} />

      {unassigned.length > 0 && onOpenExpenses && (
        <button onClick={onOpenExpenses} className="w-full mb-5 text-left text-sm bg-amber-950/40 border border-amber-800/50 text-amber-200 rounded-2xl px-4 py-3 hover:bg-amber-950/60">
          {unassigned.length} material/helper-pay expense{unassigned.length === 1 ? "" : "s"} ({fmtMoney(unassigned.reduce((t, e) => t + e.remaining, 0))}) don't have a job tag yet, so those jobs look more profitable than they are. <span className="font-semibold">Tag them in the Expense Tracker →</span>
        </button>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <Tile label="Job revenue" value={fmtMoney(totals.revenue)} sub={`${totals.jobs} completed jobs`} />
        <Tile label="Job costs" value={fmtMoney(totals.totalCost)} sub={`${fmtMoney(totals.directCosts)} materials · ${fmtMoney(totals.laborCost)} labor · ${fmtMoney(totals.overhead)} overhead`} tone="text-red-400" />
        <Tile label="Job profit" value={fmtMoney(totals.profit)} sub={`${fmtPct(totals.margin)} margin`} tone={totals.profit >= 0 ? "text-amber-400" : "text-red-400"} />
        <Tile label="Revenue / person-hr" value={totals.revPerPersonHour ? `${fmtMoney(totals.revPerPersonHour)}` : "—"}
          sub={`Target ${fmtMoney(settings.targetHourly)}/hr`} tone={totals.revPerPersonHour && totals.revPerPersonHour >= settings.targetHourly ? "text-emerald-400" : "text-amber-400"} />
        <Tile label="Time logged" value={`${Math.round(totals.timeCoverage * 100)}%`} sub={`${totals.loggedJobs} of ${totals.jobs} jobs · ${needsTimeCount} need time`} tone="text-blue-400" />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 -mx-1 px-1">
        {views.map((v) => (
          <button key={v.id} onClick={() => setView(v.id)}
            className={`px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${view === v.id ? "bg-emerald-900/50 text-emerald-300 border border-emerald-700/50" : "bg-stone-900 text-stone-400 border border-stone-800 hover:text-stone-200"}`}>
            {v.label}{v.count !== undefined && <span className={`ml-1.5 text-xs ${v.alert ? "text-amber-400" : "text-stone-500"}`}>{v.count}</span>}
          </button>
        ))}
      </div>

      {view === "jobs" && <JobsView jobs={jobs} filters={filters} setFilters={setFilters} onOpen={setOpenJobId} settings={settings} />}
      {view === "services" && <ServicesView rows={byService} settings={settings} onSelect={goToService} />}
      {view === "sources" && <SourcesView rows={bySource} onSelect={goToSource} />}
      {view === "time" && <LogTimeView jobs={jobs} onSaved={onRefreshVisits} onOpen={setOpenJobId} />}

      {openJob && (
        <JobDrawer job={openJob} costing={costing} customers={customers}
          onClose={() => setOpenJobId(null)}
          onChanged={refreshAll}
          onCustomerChanged={onRefreshCustomers} />
      )}
      {showSettings && <SettingsModal settings={settings} onClose={() => setShowSettings(false)} onSave={async (s) => { await onSaveSettings(s); setShowSettings(false); }} />}
      {showStartTimer && (
        <StartTimerModal customers={customers} serviceVisits={serviceVisits} serviceTypes={serviceTypes}
          onClose={() => setShowStartTimer(false)} onStarted={async () => { await onRefreshVisits(); setShowStartTimer(false); }} />
      )}
    </div>
  );
}

// ============================================================
// HOW IT WORKS
// ============================================================
function HowItWorks({ settings, costing }) {
  return (
    <Panel className="mb-5 text-sm text-stone-300 leading-relaxed">
      <p className="font-bold text-stone-100 mb-2">How each job's profit is calculated</p>
      <ul className="space-y-1.5 list-disc pl-5 text-stone-400">
        <li><span className="text-stone-200">Revenue</span> is the amount on the completed service visit.</li>
        <li><span className="text-stone-200">Materials & job costs</span> are expenses carrying that job's tag in the Expense Tracker (mulch, seed, a sub's bill). A receipt tagged to several jobs is split by job size.</li>
        <li><span className="text-stone-200">Labor</span> is helper pay tagged to the job. If none is linked, it's time on site × crew size × {fmtMoney(settings.laborRate)}/hr (your labor rate).</li>
        <li><span className="text-stone-200">Overhead</span> {settings.includeOverhead ? <>spreads fuel, equipment, insurance, marketing and other general costs ({fmtMoney(costing.overheadPool)} so far) across jobs by time on site — about <span className="text-stone-200">{fmtMoney(costing.overheadRate, { cents: true })} per crew-hour</span>.</> : "is turned off, so margins are before general business costs."}</li>
        <li>Jobs without logged time borrow that customer's (or that service's) average time and are marked <span className="text-stone-200">est.</span> Logging real time makes every number sharper.</li>
      </ul>
    </Panel>
  );
}

// ============================================================
// RUNNING TIMERS
// ============================================================
function RunningTimers({ serviceVisits, customers, onChanged }) {
  const running = serviceVisits.filter((v) => v.timer_started_at);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(null);
  useEffect(() => {
    if (!running.length) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running.length]);
  if (!running.length) return null;
  const custName = (id) => customers.find((c) => c.id === id)?.name || "Customer";

  const stop = async (v) => {
    setBusy(v.id);
    const mins = Math.max(1, Math.round((Date.now() - new Date(v.timer_started_at).getTime()) / 60000));
    await db.updateServiceVisit(v.id, { status: "completed", duration_minutes: mins, timer_started_at: null });
    await onChanged();
    setBusy(null);
  };
  const cancel = async (v) => {
    if (!window.confirm("Cancel this timer? The job stays on the schedule, no time is saved.")) return;
    setBusy(v.id);
    await db.updateServiceVisit(v.id, { timer_started_at: null });
    await onChanged();
    setBusy(null);
  };

  return (
    <div className="space-y-2 mb-5">
      {running.map((v) => {
        const ms = now - new Date(v.timer_started_at).getTime();
        const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
        return (
          <div key={v.id} className="flex flex-wrap items-center gap-3 bg-emerald-950/60 border border-emerald-700/60 rounded-2xl px-4 py-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div className="flex-1 min-w-[150px]">
              <div className="font-bold text-stone-100">{jobLabelName(custName(v.customer_id))} · {v.service}</div>
              <div className="text-xs text-stone-400">Started {new Date(v.timer_started_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{(v.crew_size || 1) > 1 ? ` · crew of ${v.crew_size}` : ""} · {fmtMoney(v.amount)}</div>
            </div>
            <div className="font-mono text-2xl font-black text-emerald-300 tabular-nums">{h}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</div>
            <button disabled={busy === v.id} onClick={() => stop(v)} className={btnPrimary}>■ Stop & save</button>
            <button disabled={busy === v.id} onClick={() => cancel(v)} className={btnGhost}>Cancel</button>
          </div>
        );
      })}
    </div>
  );
}

function StartTimerModal({ customers, serviceVisits, serviceTypes, onClose, onStarted }) {
  const today = todayStr();
  const scheduledToday = serviceVisits.filter((v) => v.status === "scheduled" && v.date === today && !v.timer_started_at);
  const active = [...customers].filter((c) => c.status === "Active").sort((a, b) => a.name.localeCompare(b.name));
  const [form, setForm] = useState({ customer_id: "", service: "Mowing", amount: "", crew_size: 1 });
  const [busy, setBusy] = useState(false);

  const pickCustomer = (id) => {
    const c = customers.find((x) => String(x.id) === String(id));
    setForm((f) => ({ ...f, customer_id: id, service: c?.service && serviceTypes.includes(c.service) ? c.service : f.service, amount: c?.price ? String(c.price) : f.amount }));
  };
  const startExisting = async (v) => {
    setBusy(true);
    await db.updateServiceVisit(v.id, { timer_started_at: new Date().toISOString(), crew_size: form.crew_size });
    await onStarted();
  };
  const startNew = async () => {
    if (!form.customer_id) return;
    setBusy(true);
    await db.createServiceVisit({
      customer_id: Number(form.customer_id), date: today, service: form.service, amount: Number(form.amount) || 0,
      status: "scheduled", notes: "", crew_size: form.crew_size, timer_started_at: new Date().toISOString(),
    });
    await onStarted();
  };

  return (
    <Modal title="Start a job timer" onClose={onClose}>
      <p className="text-stone-400 text-sm mb-4">The timer keeps running even if you close the app or switch phones. Tap <span className="text-stone-200">Stop & save</span> when you're done and the job is logged as completed with its time.</p>
      <label className="block text-xs text-stone-500 mb-1">Crew on this job</label>
      <div className="flex gap-2 mb-5">
        {[1, 2, 3, 4].map((n) => (
          <button key={n} onClick={() => setForm((f) => ({ ...f, crew_size: n }))}
            className={`${btn} flex-1 ${form.crew_size === n ? "bg-emerald-800 text-white" : "bg-stone-800 text-stone-400 border border-stone-700"}`}>{n} {n === 1 ? "person" : "people"}</button>
        ))}
      </div>
      {scheduledToday.length > 0 && (
        <div className="mb-5">
          <div className="text-xs text-stone-500 mb-2 uppercase tracking-wider font-semibold">On today's schedule</div>
          <div className="space-y-2">
            {scheduledToday.map((v) => (
              <button key={v.id} disabled={busy} onClick={() => startExisting(v)} className="w-full flex items-center justify-between bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-xl px-3 py-2.5 text-left">
                <span className="text-sm"><span className="font-bold text-stone-100">{customers.find((c) => c.id === v.customer_id)?.name}</span> <span className="text-stone-400">· {v.service}</span></span>
                <span className="text-emerald-400 text-sm font-bold">▶ Start</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="text-xs text-stone-500 mb-2 uppercase tracking-wider font-semibold">{scheduledToday.length ? "Or a new job" : "Job"}</div>
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <select value={form.customer_id} onChange={(e) => pickCustomer(e.target.value)} className={inputCls}>
          <option value="">Customer…</option>
          {active.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={form.service} onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))} className={inputCls}>
          {serviceTypes.map((s) => <option key={s}>{s}</option>)}
        </select>
        <input type="number" min="0" step="0.01" placeholder="Price ($)" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className={inputCls} />
      </div>
      <button disabled={busy || !form.customer_id} onClick={startNew} className={`${btnPrimary} w-full py-3`}>▶ Start timer</button>
    </Modal>
  );
}

// ============================================================
// JOBS LIST
// ============================================================
function JobsView({ jobs, filters, setFilters, onOpen, settings }) {
  const [limit, setLimit] = useState(60);
  const sources = [...new Set(jobs.map((j) => j.source))].sort();
  const months = [...new Set(jobs.map((j) => j.month))].sort((a, b) => a - b);
  const set = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setLimit(60); };

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    let list = jobs.filter((j) =>
      (!filters.category || j.category === filters.category) &&
      (!filters.source || j.source === filters.source) &&
      (filters.month === "" || j.month === Number(filters.month)) &&
      (!filters.needsTime || j.timeSource !== "logged") &&
      (!q || `${j.customerName} ${j.service} ${j.notes} ${j.category}`.toLowerCase().includes(q)));
    const sorters = {
      date: (a, b) => b.date.localeCompare(a.date),
      profit: (a, b) => b.profit - a.profit,
      marginLow: (a, b) => (a.margin ?? 9) - (b.margin ?? 9),
      marginHigh: (a, b) => (b.margin ?? -9) - (a.margin ?? -9),
      revenue: (a, b) => b.revenue - a.revenue,
      hourly: (a, b) => (b.revPerPersonHour ?? -1) - (a.revPerPersonHour ?? -1),
    };
    return [...list].sort(sorters[filters.sort] || sorters.date);
  }, [jobs, filters]);

  const sum = filtered.reduce((t, j) => ({ rev: t.rev + j.revenue, cost: t.cost + j.totalCost, profit: t.profit + j.profit }), { rev: 0, cost: 0, profit: 0 });
  const anyFilter = filters.q || filters.category || filters.source || filters.month !== "" || filters.needsTime;

  return (
    <Panel>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3">
        <input value={filters.q} onChange={(e) => set("q", e.target.value)} placeholder="Search name or note…" className={`${inputCls} col-span-2`} />
        <select value={filters.category} onChange={(e) => set("category", e.target.value)} className={inputCls}>
          <option value="">All services</option>
          {SERVICE_CATEGORIES.filter((c) => jobs.some((j) => j.category === c)).map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={filters.source} onChange={(e) => set("source", e.target.value)} className={inputCls}>
          <option value="">All sources</option>
          {sources.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={filters.month} onChange={(e) => set("month", e.target.value)} className={inputCls}>
          <option value="">All months</option>
          {months.map((m) => <option key={m} value={m}>{MONTHS[m]}</option>)}
        </select>
        <select value={filters.sort} onChange={(e) => set("sort", e.target.value)} className={inputCls}>
          <option value="date">Newest first</option>
          <option value="profit">Most profit</option>
          <option value="marginLow">Lowest margin</option>
          <option value="marginHigh">Highest margin</option>
          <option value="revenue">Biggest jobs</option>
          <option value="hourly">Best $/hour</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs">
        <label className="flex items-center gap-2 text-stone-400 cursor-pointer">
          <input type="checkbox" checked={filters.needsTime} onChange={(e) => set("needsTime", e.target.checked)} className="accent-emerald-600" />
          Only jobs missing logged time
        </label>
        <div className="text-stone-400">
          <span className="text-stone-200 font-semibold">{filtered.length}</span> jobs · <span className="text-emerald-400 font-semibold">{fmtMoney(sum.rev)}</span> rev · <span className="text-red-400 font-semibold">{fmtMoney(sum.cost)}</span> exp · <span className="text-amber-400 font-semibold">{fmtMoney(sum.profit)}</span> profit · {fmtPct(sum.rev ? sum.profit / sum.rev : null)}
          {anyFilter && <button onClick={() => setFilters({ q: "", category: "", source: "", month: "", needsTime: false, sort: filters.sort })} className="ml-2 text-emerald-500 hover:text-emerald-400">Clear filters</button>}
        </div>
      </div>

      <div className="hidden md:grid grid-cols-[minmax(0,1fr)_88px_88px_88px_80px_92px_72px] gap-3 px-3 py-2 text-[11px] uppercase tracking-wider text-stone-500 font-semibold border-b border-stone-800">
        <div>Job</div><div className="text-right">Revenue</div><div className="text-right">Expenses</div><div className="text-right">Profit</div><div className="text-right">Margin</div><div className="text-right">Time</div><div className="text-right">$/hr</div>
      </div>
      <div className="divide-y divide-stone-800/60">
        {filtered.slice(0, limit).map((j) => <JobRow key={j.id} job={j} onOpen={onOpen} settings={settings} />)}
      </div>
      {filtered.length === 0 && <p className="text-center text-stone-500 text-sm py-10">No jobs match these filters.</p>}
      {filtered.length > limit && (
        <button onClick={() => setLimit((l) => l + 100)} className={`${btnGhost} w-full mt-3`}>Show more ({filtered.length - limit} left)</button>
      )}
    </Panel>
  );
}

function JobRow({ job: j, onOpen, settings }) {
  const hourlyTone = j.revPerPersonHour == null ? "text-stone-600" : j.revPerPersonHour >= settings.targetHourly ? "text-emerald-400" : "text-amber-400";
  return (
    <button type="button" onClick={() => onOpen(j.id)} className="w-full text-left hover:bg-stone-800/40 transition-colors rounded-lg px-3 py-3 md:grid md:grid-cols-[minmax(0,1fr)_88px_88px_88px_80px_92px_72px] md:gap-3 md:items-center">
      <div className="min-w-0">
        <div className="text-sm text-stone-100 truncate"><span className="font-bold">{j.label}</span> <span className="text-stone-300">{j.category === "Other" ? (j.notes || j.service) : j.category}</span></div>
        <div className="text-xs text-stone-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{shortDate(j.date)}</span><span>·</span><span>{j.source}</span>
          {j.category !== "Other" && j.notes && <><span>·</span><span className="truncate max-w-[220px]">{j.notes}</span></>}
          {j.costItems.length > 0 && <Pill tone="blue">{j.costItems.length} tagged expense{j.costItems.length > 1 ? "s" : ""}</Pill>}
        </div>
      </div>
      {/* Mobile summary line */}
      <div className="md:hidden mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="text-stone-400">Rev <span className="text-emerald-400 font-bold">{fmtMoney(j.revenue)}</span></span>
        <span className="text-stone-400">Exp <span className="text-red-400 font-bold">{fmtMoney(j.totalCost)}</span></span>
        <MarginPill job={j} />
        {timePill(j)}
        {j.revPerPersonHour != null && <span className={`font-bold ${hourlyTone}`}>{fmtMoney(j.revPerPersonHour)}/hr</span>}
      </div>
      <div className="hidden md:block text-right text-sm font-bold text-emerald-400">{fmtMoney(j.revenue)}</div>
      <div className="hidden md:block text-right text-sm font-bold text-red-400">{fmtMoney(j.totalCost)}</div>
      <div className={`hidden md:block text-right text-sm font-bold ${j.profit >= 0 ? "text-amber-400" : "text-red-400"}`}>{fmtMoney(j.profit)}</div>
      <div className="hidden md:block text-right"><MarginPill job={j} /></div>
      <div className="hidden md:block text-right">{timePill(j)}</div>
      <div className={`hidden md:block text-right text-sm font-bold ${hourlyTone}`}>{j.revPerPersonHour != null ? fmtMoney(j.revPerPersonHour) : "—"}</div>
    </button>
  );
}

// ============================================================
// JOB DETAIL
// ============================================================
function JobDrawer({ job, costing, customers, onClose, onChanged, onCustomerChanged }) {
  const [minutes, setMinutes] = useState(job.timeSource === "logged" ? String(job.minutes) : "");
  const [crew, setCrew] = useState(job.crew || 1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [newCost, setNewCost] = useState({ category: "Materials", description: "", amount: "" });
  const cust = customers.find((c) => c.id === job.customerId);
  const [source, setSource] = useState(cust?.source || "");

  useEffect(() => {
    setMinutes(job.timeSource === "logged" ? String(job.minutes) : "");
    setCrew(job.crew || 1);
  }, [job.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(""), 2500); };
  const saveTime = async () => {
    setBusy(true);
    await db.updateServiceVisit(job.id, { duration_minutes: minutes ? Math.round(Number(minutes)) : null, crew_size: crew });
    await onChanged();
    setBusy(false); flash("Time saved");
  };
  const saveSource = async (val) => {
    setSource(val);
    if (!cust) return;
    await db.updateCustomer(cust.id, { source: val });
    await onCustomerChanged();
    flash(`Source updated for all of ${cust.name}'s jobs`);
  };
  const addCost = async () => {
    const amt = Number(newCost.amount);
    if (!amt) return;
    setBusy(true);
    const exp = await db.createExpense({ date: job.date, category: newCost.category, description: `${job.label} – ${newCost.description || newCost.category}`, amount: amt });
    if (exp) await db.upsertExpenseAllocation(exp.id, job.id, amt);
    await onChanged();
    setNewCost({ category: "Materials", description: "", amount: "" });
    setBusy(false); flash("Cost added to the Expense Tracker with this job's tag");
  };
  const unlink = async (allocationId) => {
    setBusy(true);
    await db.deleteExpenseAllocation(allocationId);
    await onChanged();
    setBusy(false);
  };

  const Line = ({ label, value, tone = "text-stone-200", sub }) => (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-stone-400 text-sm">{label}{sub && <span className="block text-[11px] text-stone-600">{sub}</span>}</span>
      <span className={`font-bold ${tone}`}>{value}</span>
    </div>
  );
  const laborSub = job.laborSource === "actual" ? "tagged helper pay"
    : job.laborSource ? `${fmtHours(job.minutes)} × ${job.crew} ${job.crew > 1 ? "people" : "person"} × ${fmtMoney(costing.settings.laborRate)}/hr${job.timeSource === "estimate" ? " (estimated time)" : ""}`
    : "no time logged yet";

  return (
    <Modal title={`${job.label} · ${job.category}`} onClose={onClose} wide>
      <div className="text-xs text-stone-500 -mt-2 mb-4">{job.customerName} · {shortDate(job.date)} · {job.service}{job.notes ? ` · ${job.notes}` : ""}</div>
      {msg && <div className="mb-3 text-sm bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-lg px-3 py-2">{msg}</div>}

      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <div className="bg-stone-950/60 border border-stone-800 rounded-xl px-4 py-2">
            <Line label="Revenue" value={fmtMoney(job.revenue)} tone="text-emerald-400" />
            <Line label="Materials & job costs" value={`-${fmtMoney(job.directCosts)}`} tone="text-red-400" />
            <Line label="Labor" value={`-${fmtMoney(job.laborCost)}`} tone="text-red-400" sub={laborSub} />
            {costing.settings.includeOverhead && <Line label="Overhead share" value={`-${fmtMoney(job.overhead)}`} tone="text-red-400" sub={job.crewHours ? `${fmtHours(job.crewHours * 60)} × ${fmtMoney(costing.overheadRate, { cents: true })}/crew-hr` : "needs time"} />}
            <div className="border-t border-stone-800 mt-1" />
            <Line label="Profit" value={fmtMoney(job.profit)} tone={job.profit >= 0 ? "text-amber-400" : "text-red-400"} />
            <div className="flex items-center justify-between py-1.5">
              <span className="text-stone-400 text-sm">Margin</span><Pill tone={marginTone(job.margin)}>{fmtPct(job.margin)}</Pill>
            </div>
            <Line label="Revenue per person-hour" value={job.revPerPersonHour != null ? fmtMoney(job.revPerPersonHour) : "—"} tone={job.revPerPersonHour != null && job.revPerPersonHour >= costing.settings.targetHourly ? "text-emerald-400" : "text-amber-400"} sub={`target ${fmtMoney(costing.settings.targetHourly)}`} />
          </div>

          <div className="mt-4">
            <label className="block text-xs text-stone-500 mb-1 uppercase tracking-wider font-semibold">Where this customer came from</label>
            <select value={source} onChange={(e) => saveSource(e.target.value)} className={`${inputCls} w-full`}>
              <option value="">Unknown</option>
              {[...new Set([...CUSTOMER_SOURCES, source].filter(Boolean))].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <div className="text-xs text-stone-500 mb-2 uppercase tracking-wider font-semibold">Time on site</div>
            {job.timeSource === "estimate" && <p className="text-xs text-stone-500 mb-2">Using ~{fmtHours(job.minutes)} from {job.timeBasis}. Enter the real time to replace it.</p>}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {TIME_CHIPS.map(([m, l]) => (
                <button key={m} onClick={() => setMinutes(String(m))} className={`${btn} py-1 px-2.5 text-xs ${Number(minutes) === m ? "bg-emerald-800 text-white" : "bg-stone-800 text-stone-400 border border-stone-700"}`}>{l}</button>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <input type="number" min="1" placeholder="Minutes" value={minutes} onChange={(e) => setMinutes(e.target.value)} className={`${inputCls} w-28`} />
              <span className="text-stone-500 text-sm">min ×</span>
              <select value={crew} onChange={(e) => setCrew(Number(e.target.value))} className={inputCls}>
                {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} {n === 1 ? "person" : "people"}</option>)}
              </select>
              <button disabled={busy} onClick={saveTime} className={btnPrimary}>Save</button>
            </div>
          </div>

          <div>
            <div className="text-xs text-stone-500 mb-2 uppercase tracking-wider font-semibold">Expenses tagged to this job</div>
            {job.costItems.length === 0 && <p className="text-xs text-stone-500 mb-2">None yet.</p>}
            <div className="space-y-1.5 mb-3">
              {job.costItems.map((c) => (
                <div key={c.allocationId} className="flex items-center justify-between gap-2 bg-stone-800/60 rounded-lg px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="text-stone-200 truncate">{c.description || c.category}</div>
                    <div className="text-[11px] text-stone-500">{c.category} · {shortDate(c.date)}{c.split ? " · split" : ""}</div>
                  </div>
                  <span className="text-red-400 font-bold">{fmtMoney(c.amount, { cents: true })}</span>
                  <button disabled={busy} onClick={() => unlink(c.allocationId)} className="text-stone-500 hover:text-red-400 text-xs">Remove tag</button>
                </div>
              ))}
            </div>
            <div className="text-[11px] text-stone-500 mb-1">Add a cost for this job (it's saved in the Expense Tracker with this job's tag). To tag an expense you already entered, use the Job tag column in the Expense Tracker.</div>
            <div className="grid grid-cols-[110px_1fr_80px_auto] gap-2">
              <select value={newCost.category} onChange={(e) => setNewCost((c) => ({ ...c, category: e.target.value }))} className={inputCls}>
                {COST_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input placeholder="e.g. 4 yds mulch" value={newCost.description} onChange={(e) => setNewCost((c) => ({ ...c, description: e.target.value }))} className={`${inputCls} min-w-0`} />
              <input type="number" min="0" step="0.01" placeholder="$" value={newCost.amount} onChange={(e) => setNewCost((c) => ({ ...c, amount: e.target.value }))} className={inputCls} />
              <button disabled={busy || !Number(newCost.amount)} onClick={addCost} className={btnGhost}>Add</button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// BY SERVICE
// ============================================================
function ServicesView({ rows, settings, onSelect }) {
  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
          <h3 className="font-bold">Profit by service type</h3>
          <span className="text-xs text-stone-500">Bright = profit, dark = costs. Tap a service to see its jobs.</span>
        </div>
        <ProfitBars rows={rows} onSelect={onSelect} />
      </Panel>
      <Panel>
        <h3 className="font-bold mb-3">Service rollup</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="border-b border-stone-800 text-[11px] uppercase tracking-wider text-stone-500">
                {["Service", "Jobs", "Revenue", "Costs", "Profit", "Margin", "Avg job", "Avg time", "$/person-hr", "Pricing check"].map((h, i) => (
                  <th key={h} className={`py-2 px-2 font-semibold ${i === 0 || i === 9 ? "text-left" : "text-right"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {rows.map((r) => (
                <tr key={r.key} className="hover:bg-stone-800/30 cursor-pointer" onClick={() => onSelect(r.key)}>
                  <td className="py-2.5 px-2 font-semibold text-stone-100">{r.key}</td>
                  <td className="py-2.5 px-2 text-right text-stone-300">{r.jobs}</td>
                  <td className="py-2.5 px-2 text-right text-emerald-400 font-bold">{fmtMoney(r.revenue)}</td>
                  <td className="py-2.5 px-2 text-right text-red-400">{fmtMoney(r.totalCost)}</td>
                  <td className={`py-2.5 px-2 text-right font-bold ${r.profit >= 0 ? "text-amber-400" : "text-red-400"}`}>{fmtMoney(r.profit)}</td>
                  <td className="py-2.5 px-2 text-right"><Pill tone={marginTone(r.margin)}>{fmtPct(r.margin)}</Pill></td>
                  <td className="py-2.5 px-2 text-right text-stone-300">{fmtMoney(r.avgTicket)}</td>
                  <td className="py-2.5 px-2 text-right text-stone-300">{r.avgPersonHours ? fmtHours(r.avgPersonHours * 60) : "—"}<div className="text-[10px] text-stone-600">{r.loggedJobs}/{r.jobs} logged</div></td>
                  <td className={`py-2.5 px-2 text-right font-bold ${r.revPerPersonHour == null ? "text-stone-600" : r.revPerPersonHour >= settings.targetHourly ? "text-emerald-400" : "text-amber-400"}`}>{r.revPerPersonHour != null ? fmtMoney(r.revPerPersonHour) : "—"}</td>
                  <td className="py-2.5 px-2 text-xs"><PriceCheck r={r} settings={settings} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-stone-600 mt-3">$/person-hr = revenue ÷ (time on site × crew). Pricing check compares it to your {fmtMoney(settings.targetHourly)}/hr target using the average time for that service.</p>
      </Panel>
    </div>
  );
}

function PriceCheck({ r, settings }) {
  if (r.revPerPersonHour == null) return <span className="text-stone-500">Log time to check</span>;
  if (r.loggedJobs === 0) return <span className="text-stone-500">Based on estimates only</span>;
  if (r.revPerPersonHour >= settings.targetHourly) return <span className="text-emerald-400">On target</span>;
  return (
    <span className="text-amber-300">Avg {fmtMoney(r.avgTicket)} → ~{fmtMoney(r.targetTicket)} to hit target{r.priceGap ? ` (+${Math.round(r.priceGap * 100)}%)` : ""}</span>
  );
}

// ============================================================
// BY SOURCE
// ============================================================
function SourcesView({ rows, onSelect }) {
  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
          <h3 className="font-bold">Profit by where customers came from</h3>
          <span className="text-xs text-stone-500">Set a customer's source from any of their jobs.</span>
        </div>
        <ProfitBars rows={rows} onSelect={onSelect} />
      </Panel>
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[620px]">
            <thead>
              <tr className="border-b border-stone-800 text-[11px] uppercase tracking-wider text-stone-500">
                {["Source", "Customers", "Jobs", "Revenue", "Profit", "Margin", "Revenue / customer"].map((h, i) => (
                  <th key={h} className={`py-2 px-2 font-semibold ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {rows.map((r) => (
                <tr key={r.key} className="hover:bg-stone-800/30 cursor-pointer" onClick={() => onSelect(r.key)}>
                  <td className="py-2.5 px-2 font-semibold text-stone-100">{r.key}</td>
                  <td className="py-2.5 px-2 text-right text-stone-300">{r.customerCount}</td>
                  <td className="py-2.5 px-2 text-right text-stone-300">{r.jobs}</td>
                  <td className="py-2.5 px-2 text-right text-emerald-400 font-bold">{fmtMoney(r.revenue)}</td>
                  <td className={`py-2.5 px-2 text-right font-bold ${r.profit >= 0 ? "text-amber-400" : "text-red-400"}`}>{fmtMoney(r.profit)}</td>
                  <td className="py-2.5 px-2 text-right"><Pill tone={marginTone(r.margin)}>{fmtPct(r.margin)}</Pill></td>
                  <td className="py-2.5 px-2 text-right text-stone-300">{fmtMoney(r.customerCount ? r.revenue / r.customerCount : 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

// ============================================================
// LOG TIME — fast entry queue for jobs missing time
// ============================================================
function LogTimeView({ jobs, onSaved, onOpen }) {
  const [category, setCategory] = useState("");
  const [drafts, setDrafts] = useState({});
  const [savedIds, setSavedIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(40);

  const queue = jobs.filter((j) => j.timeSource !== "logged" && !savedIds.includes(j.id) && (!category || j.category === category));
  const cats = SERVICE_CATEGORIES.filter((c) => jobs.some((j) => j.category === c && j.timeSource !== "logged"));
  const draftOf = (j) => ({ minutes: "", crew: j.crew || 1, ...(drafts[j.id] || {}) });
  const setDraft = (j, patch) => setDrafts((d) => ({ ...d, [j.id]: { minutes: "", crew: j.crew || 1, ...(d[j.id] || {}), ...patch } }));
  const ready = queue.filter((j) => Number(draftOf(j).minutes) > 0);

  const saveAll = async () => {
    setBusy(true);
    for (const j of ready) {
      const d = draftOf(j);
      await db.updateServiceVisit(j.id, { duration_minutes: Math.round(Number(d.minutes)), crew_size: d.crew });
    }
    setSavedIds((s) => [...s, ...ready.map((j) => j.id)]);
    setDrafts({});
    await onSaved();
    setBusy(false);
  };

  // Group by date so a whole day's route can be filled in at once
  const visible = queue.slice(0, limit);
  const groups = [];
  for (const j of visible) {
    const g = groups[groups.length - 1];
    if (g && g.date === j.date) g.jobs.push(j); else groups.push({ date: j.date, jobs: [j] });
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold">Log time on past jobs</h3>
          <p className="text-xs text-stone-500">Tap a time chip or type minutes, set the crew, then save everything at once. Estimates shown in grey come from your logged history.</p>
        </div>
        <div className="flex gap-2">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
            <option value="">All services</option>
            {cats.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button disabled={busy || ready.length === 0} onClick={saveAll} className={btnPrimary}>Save {ready.length || ""} {ready.length === 1 ? "job" : "jobs"}</button>
        </div>
      </div>
      {queue.length === 0 && <p className="text-center text-stone-500 text-sm py-10">Every job has time logged. 🎉</p>}
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.date}>
            <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1.5">{shortDate(g.date)}</div>
            <div className="divide-y divide-stone-800/60 border border-stone-800 rounded-xl">
              {g.jobs.map((j) => {
                const d = draftOf(j);
                return (
                  <div key={j.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                    <button onClick={() => onOpen(j.id)} className="flex-1 min-w-[160px] text-left">
                      <div className="text-sm"><span className="font-bold text-stone-100">{j.label}</span> <span className="text-stone-400">{j.category}</span></div>
                      <div className="text-xs text-stone-500">{fmtMoney(j.revenue)}{j.timeSource === "estimate" ? ` · usually ~${fmtHours(j.minutes)}` : ""}</div>
                    </button>
                    <div className="flex flex-wrap gap-1">
                      {TIME_CHIPS.slice(0, 6).map(([m, l]) => (
                        <button key={m} onClick={() => setDraft(j, { minutes: String(m) })}
                          className={`text-xs px-2 py-1 rounded-md font-semibold ${Number(d.minutes) === m ? "bg-emerald-800 text-white" : "bg-stone-800 text-stone-400 border border-stone-700 hover:text-stone-200"}`}>{l}</button>
                      ))}
                    </div>
                    <input type="number" min="1" placeholder={j.timeSource === "estimate" ? String(j.minutes) : "min"} value={d.minutes}
                      onChange={(e) => setDraft(j, { minutes: e.target.value })} className={`${inputCls} w-20 py-1.5`} />
                    <select value={d.crew} onChange={(e) => setDraft(j, { crew: Number(e.target.value) })} className={`${inputCls} py-1.5`} title="Crew size">
                      {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} 👤</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {queue.length > limit && <button onClick={() => setLimit((l) => l + 60)} className={`${btnGhost} w-full mt-4`}>Show more ({queue.length - limit} left)</button>}
    </Panel>
  );
}

// ============================================================
// SETTINGS
// ============================================================
function SettingsModal({ settings, onClose, onSave }) {
  const [s, setS] = useState({ ...settings });
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Job costing rates" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-stone-200 mb-1">Labor rate ($ per person-hour)</label>
          <p className="text-xs text-stone-500 mb-2">What an hour of anyone's time on a job costs you, including your own. Used when no actual helper pay is linked to the job.</p>
          <input type="number" min="0" step="0.5" value={s.laborRate} onChange={(e) => setS({ ...s, laborRate: Number(e.target.value) })} className={`${inputCls} w-32`} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-stone-200 mb-1">Target revenue per person-hour</label>
          <p className="text-xs text-stone-500 mb-2">Your pricing goal. Jobs and services below it are flagged, and the pricing check suggests what to charge.</p>
          <input type="number" min="0" step="1" value={s.targetHourly} onChange={(e) => setS({ ...s, targetHourly: Number(e.target.value) })} className={`${inputCls} w-32`} />
        </div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={!!s.includeOverhead} onChange={(e) => setS({ ...s, includeOverhead: e.target.checked })} className="accent-emerald-600 mt-1" />
          <span>
            <span className="block text-sm font-semibold text-stone-200">Include overhead in job margins</span>
            <span className="block text-xs text-stone-500">Spreads fuel, equipment, insurance, marketing and other general costs across jobs by time on site.</span>
          </span>
        </label>
        <button disabled={busy} onClick={async () => { setBusy(true); await onSave(s); }} className={`${btnPrimary} w-full py-3`}>Save rates</button>
      </div>
    </Modal>
  );
}

