import { useEffect, useMemo, useRef, useState } from "react";
import { MONTHS, monthOf, jobLabelName, categorizeService, suggestJobsForExpense, fmtMoney, DIRECT_COST_CATEGORIES } from "../lib/profitability";

const shortDate = (d) => (d ? `${MONTHS[monthOf(d)]} ${Number(String(d).slice(8, 10))}` : "");

// Every non-skipped service visit becomes a taggable job
export function buildJobTagOptions(serviceVisits, customers) {
  const byId = new Map(customers.map((c) => [c.id, c]));
  return serviceVisits
    .filter((v) => v.status !== "skipped")
    .map((v) => {
      const name = byId.get(v.customer_id)?.name || v.customers?.name || "Unknown";
      const category = categorizeService(v.service, v.notes);
      return {
        id: v.id, date: v.date, customerName: name, label: jobLabelName(name), category,
        revenue: Number(v.amount) || 0, status: v.status, notes: v.notes || "",
        text: `${jobLabelName(name)} · ${category === "Other" && v.notes ? v.notes : category} · ${shortDate(v.date)}`,
      };
    })
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

// Split an amount across tagged jobs, weighted by job size (falls back to even)
export function splitAmount(total, jobs) {
  if (!jobs.length) return [];
  const rev = jobs.reduce((t, j) => t + j.revenue, 0);
  const raw = jobs.map((j) => (rev > 0 ? (total * j.revenue) / rev : total / jobs.length));
  const out = raw.map((v) => Math.round(v * 100) / 100);
  out[out.length - 1] = Math.round((total - out.slice(0, -1).reduce((a, b) => a + b, 0)) * 100) / 100;
  return out;
}

export const tagText = (o) => `${o.text}${o.revenue ? ` · ${fmtMoney(o.revenue)}` : ""}${o.status === "scheduled" ? " · upcoming" : ""}`;

// Searchable multi-select of job tags. `expense` drives the suggestions.
export function JobTagSelect({ expense, options, value = [], onChange, autoFocus = false }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(autoFocus);
  const boxRef = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const selected = value.map((id) => byId.get(id)).filter(Boolean);

  const suggestions = useMemo(() => {
    if (!expense?.date) return [];
    return suggestJobsForExpense({ date: expense.date, description: expense.description, category: expense.category }, options, 5)
      .filter((s) => !value.includes(s.job.id));
  }, [expense?.date, expense?.description, expense?.category, options, value]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return options.filter((o) => !value.includes(o.id) && `${o.customerName} ${o.category} ${o.notes} ${o.date}`.toLowerCase().includes(t)).slice(0, 25);
  }, [q, options, value]);

  const add = (id) => { onChange([...value, id]); setQ(""); };
  const remove = (id) => onChange(value.filter((x) => x !== id));
  const amounts = splitAmount(Number(expense?.amount) || 0, selected);
  const list = q.trim() ? results.map((o) => ({ job: o })) : suggestions;

  return (
    <div ref={boxRef} className="relative">
      <div className="flex flex-wrap gap-1.5 bg-stone-800 border border-stone-700 rounded-xl px-2 py-1.5 focus-within:border-emerald-600" onClick={() => setOpen(true)}>
        {selected.map((o, i) => (
          <span key={o.id} className="inline-flex items-center gap-1 bg-blue-900/50 border border-blue-700/50 text-blue-200 rounded-full pl-2.5 pr-1 py-0.5 text-xs">
            {o.text}{selected.length > 1 && Number(expense?.amount) > 0 ? <span className="text-blue-300/70"> · {fmtMoney(amounts[i], { cents: true })}</span> : null}
            <button type="button" onClick={(e) => { e.stopPropagation(); remove(o.id); }} className="w-4 h-4 rounded-full hover:bg-blue-800 text-blue-300 leading-none" aria-label="Remove tag">×</button>
          </span>
        ))}
        <input value={q} autoFocus={autoFocus} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          placeholder={selected.length ? "Add another job…" : "Search customer or service…"}
          className="flex-1 min-w-[140px] bg-transparent text-sm text-stone-200 placeholder-stone-500 py-1 px-1 focus:outline-none" />
      </div>
      {open && list.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-stone-900 border border-stone-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto py-1">
          {!q.trim() && <div className="px-3 pt-1.5 pb-1 text-[10px] uppercase tracking-wider text-stone-500 font-semibold">Suggested for this expense</div>}
          {list.map(({ job, named }) => (
            <button key={job.id} type="button" onClick={() => add(job.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-stone-800 flex items-center justify-between gap-2">
              <span className="truncate"><span className="font-semibold text-stone-100">{job.label}</span> <span className="text-stone-400">{job.category === "Other" && job.notes ? job.notes : job.category} · {shortDate(job.date)}{job.status === "scheduled" ? " · upcoming" : ""}</span></span>
              <span className="text-xs text-emerald-400 whitespace-nowrap">{named ? <span className="text-amber-300 mr-1">★</span> : null}{fmtMoney(job.revenue)}</span>
            </button>
          ))}
        </div>
      )}
      {selected.length > 1 && <p className="text-[11px] text-stone-500 mt-1">Split across {selected.length} jobs by job size.</p>}
    </div>
  );
}

// Compact tag cell for an expense row: shows tags, quick suggestions, and an editor
export function ExpenseTagCell({ expense, tags, options, onSave, onMarkOverhead, onClearOverhead }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tags.map((t) => t.visit_id));
  const [busy, setBusy] = useState(false);
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  useEffect(() => { if (!editing) setDraft(tags.map((t) => t.visit_id)); }, [tags, editing]);

  const isJobCategory = DIRECT_COST_CATEGORIES.includes(expense.category);
  const quick = useMemo(() => (tags.length || expense.is_overhead || !isJobCategory ? [] :
    suggestJobsForExpense(expense, options.filter((o) => o.status === "completed"), 2)), [tags.length, expense, options, isJobCategory]);

  const save = async (ids) => {
    setBusy(true);
    await onSave(expense, ids.map((id) => byId.get(id)).filter(Boolean));
    setBusy(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="min-w-[260px]">
        <JobTagSelect expense={expense} options={options} value={draft} onChange={setDraft} autoFocus />
        <div className="flex gap-2 mt-2">
          <button disabled={busy} onClick={() => save(draft)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-40">Save tags</button>
          <button disabled={busy} onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-800 text-stone-300 border border-stone-700">Cancel</button>
          {!expense.is_overhead && isJobCategory && (
            <button disabled={busy} onClick={async () => { setBusy(true); await onMarkOverhead(expense); setBusy(false); setEditing(false); }} className="px-2 py-1.5 text-xs text-stone-500 hover:text-stone-300">Not job-specific</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => {
        const o = byId.get(t.visit_id);
        return (
          <span key={t.id} className="inline-flex items-center bg-blue-900/40 border border-blue-800/50 text-blue-200 rounded-full px-2 py-0.5 text-[11px]">
            {o ? o.text : `Job #${t.visit_id}`}{tags.length > 1 ? <span className="text-blue-300/70 ml-1">{fmtMoney(t.amount, { cents: true })}</span> : null}
          </span>
        );
      })}
      {expense.is_overhead && (
        <button onClick={() => onClearOverhead(expense)} title="Click to undo" className="text-[11px] text-stone-400 bg-stone-800 border border-stone-700 rounded-full px-2 py-0.5 hover:text-stone-200">Overhead ✕</button>
      )}
      {quick.map(({ job, named }) => (
        <button key={job.id} disabled={busy} onClick={() => save([job.id])} title="Tag this expense to the suggested job"
          className="text-[11px] bg-stone-800 hover:bg-emerald-900/50 border border-dashed border-stone-600 hover:border-emerald-700 text-stone-300 rounded-full px-2 py-0.5">
          + {job.text}{named ? " ★" : ""}
        </button>
      ))}
      <button onClick={() => setEditing(true)} className="text-[11px] text-emerald-500 hover:text-emerald-400 px-1">{tags.length ? "Edit" : quick.length ? "Other…" : "+ Job tag"}</button>
    </div>
  );
}
