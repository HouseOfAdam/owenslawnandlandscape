import { useEffect, useMemo, useState } from "react";
import * as db from "../lib/db";
import {
  UNITS, FREQUENCIES, SERVICE_GROUPS, mergePricing, priceEstimate, defaultQty, cuYards, calibrateMowing, estimateStats, pricingAdvice, visitsPerSeason,
  effectiveRate, materialMarkupPct,
} from "../lib/pricing";
import { SERVICE_CATEGORIES, rollupBy, fmtMoney, fmtPct, fmtHours, marginTone } from "../lib/profitability";
import { printEstimateV2, printEstimate } from "./printEstimate";
import { printResidentialProposal, printCommercialProposal, DEFAULT_PROPOSAL_CONTENT } from "./proposalTemplates";
import { Pill, Panel, Tile, Modal, inputCls, btn, btnPrimary, btnGhost } from "./ui";

const uid = () => Math.random().toString(36).slice(2, 9);
const estNo = (id) => (id ? `EST-${String(id).padStart(4, "0")}` : "Draft");
const STATUS_TONE = { draft: "gray", sent: "blue", approved: "green", declined: "red" };
const label = "block text-[11px] text-stone-500 uppercase tracking-wider font-semibold mb-1";

function guessServiceId(text = "", services) {
  const t = String(text).toLowerCase();
  const pick = (re, id) => (re.test(t) && services.some((s) => s.id === id) ? id : null);
  return pick(/aerat/, "aeration") || pick(/seed/, "overseed") || pick(/fert|treat/, "fert") || pick(/mulch/, "mulch")
    || pick(/hedge|shrub|trim/, "shrubs") || pick(/clean|leaf/, "cleanup") || pick(/weed/, "weeding") || pick(/mow/, "mowing") || services[0]?.id;
}
function guessFreq(text = "") {
  const t = String(text).toLowerCase();
  if (/bi-?week|every 2|every other/.test(t)) return "biweekly";
  if (/week/.test(t)) return "weekly";
  if (/month/.test(t)) return "monthly";
  return null;
}
const parseSqft = (v) => { const m = String(v || "").match(/\d[\d,]*/); const n = m ? parseInt(m[0].replace(/,/g, ""), 10) : 0; return n >= 500 ? n : ""; };

const blankEstimate = () => ({
  id: null, leadId: null, customerId: null, customerName: "", address: "", status: "draft",
  property: { lawnSqft: "", bedSqft: "", mulchDepthIn: "", modifiers: [] },
  lines: [], notes: "", internalNotes: "", terms: null,
  // Proposal template fields (blank = use the smart default shown as placeholder)
  template: "residential", projectTitle: "", pricingIntro: "", startText: "", timeOnSite: "", warranty: "", exclusions: "", notices: null,
  commercial: {},
  publicToken: null, sentAt: null, response: null,
});

const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
export const proposalUrl = (token) => `${window.location.origin}/proposal/${token}`;

const PROPOSAL_FIELDS = ["template", "projectTitle", "pricingIntro", "startText", "timeOnSite", "warranty", "exclusions", "notices", "commercial"];
const seasonWord = (d = new Date()) => { const m = d.getMonth(); return m >= 2 && m <= 4 ? "Spring" : m >= 5 && m <= 7 ? "Summer" : m >= 8 && m <= 10 ? "Fall" : "Winter"; };
const joinNice = (arr) => (arr.length <= 1 ? arr.join("") : `${arr.slice(0, -1).join(", ")}${arr.length > 2 ? "," : ""} and ${arr[arr.length - 1]}`);
// Smart defaults for the proposal, derived from the priced lines
export function proposalDefaults(result, content) {
  const req = result.lines.filter((l) => !l.optional);
  const names = req.map((l) => l.description);
  const short = names.slice(0, 2).map((n) => n.replace(/^(Double Pass Core |Lawn )/i, "")).join(" & ");
  const crewHours = req.filter((l) => l.frequency === "once").reduce((t, l) => t + l.personMin / Math.max(1, l.crew), 0) / 60
    || req.reduce((t, l) => t + l.personMin / Math.max(1, l.crew), 0) / 60;
  let timeOnSite = "";
  if (crewHours > 0) {
    if (crewHours <= 9) { const lo = Math.max(1, Math.floor(crewHours * 0.8)), hi = Math.max(lo + 1, Math.ceil(crewHours * 1.3)); timeOnSite = `${lo}-${hi} Hrs.`; }
    else { const days = crewHours / 8; const lo = Math.max(1, Math.floor(days)), hi = Math.max(lo + 1, Math.ceil(days * 1.3)); timeOnSite = `${lo}-${hi} days`; }
  }
  const hasAeration = result.lines.some((l) => l.serviceId === "aeration");
  return {
    projectTitle: `${seasonWord()} ${short || "Proposal"}`.trim(),
    pricingIntro: names.length ? `${joinNice(names.map((n, i) => (i ? n.toLowerCase() : n)))}. Price includes labor, materials, cleanup, and disposal.` : "",
    startText: content.startDefault,
    timeOnSite,
    exclusions: content.servicesExcluded,
    notices: hasAeration ? content.aerationNotice : "",
  };
}

// ============================================================
export default function EstimatorTab({ pricing: savedPricing, onSavePricing, costing, customers, serviceVisits, prefill, onRefreshCustomers, openSavedNav }) {
  const pricing = useMemo(() => mergePricing(savedPricing), [savedPricing]);
  const [view, setView] = useState("new");
  const [estimates, setEstimates] = useState([]);
  const [est, setEst] = useState(blankEstimate);
  const [msg, setMsg] = useState("");

  const refreshEstimates = async () => setEstimates(await db.fetchEstimates());
  useEffect(() => { refreshEstimates(); }, []);
  useEffect(() => { if (openSavedNav) { setView("saved"); refreshEstimates(); } }, [openSavedNav]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prefill from a CRM lead
  useEffect(() => {
    if (!prefill?.n) return;
    const svcId = guessServiceId(prefill.service || prefill.serviceType || "", pricing.services);
    const svc = pricing.services.find((s) => s.id === svcId);
    setEst({
      ...blankEstimate(),
      leadId: prefill.leadId || null,
      customerName: prefill.name || prefill.customer || "",
      address: prefill.address || "",
      property: { lawnSqft: parseSqft(prefill.lotSize || prefill.lot_size || prefill.area), bedSqft: "", mulchDepthIn: "", modifiers: [] },
      lines: svc ? [{ key: uid(), serviceId: svc.id, qty: null, frequency: guessFreq(prefill.frequency) || svc.defaultFreq, crew: 1 }] : [],
      notes: "", internalNotes: prefill.notes || "",
    });
    setView("new");
  }, [prefill?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(""), 3000); };
  const costingInputs = { laborRate: costing.settings.laborRate, overheadRate: costing.overheadRate, includeOverhead: costing.settings.includeOverhead };
  const stats = useMemo(() => estimateStats(estimates), [estimates]);
  const history = useMemo(() => Object.fromEntries(rollupBy(costing.jobs, (j) => j.category, costing.settings).map((r) => [r.key, r])), [costing]);

  const openEstimate = (e) => {
    const inp = e.inputs || {};
    if (!inp.lines) { printEstimate({ customer: e.customer_name, basePrice: e.base_price, monthlyEstimate: e.monthly_estimate, annualEstimate: e.annual_estimate, lineItems: e.line_items || [], date: e.created_at, estimateNumber: estNo(e.id) }); return; }
    setEst({
      id: e.id, leadId: e.lead_id, customerId: e.customer_id, customerName: e.customer_name, address: e.address, status: e.status,
      property: { lawnSqft: "", bedSqft: "", mulchDepthIn: "", modifiers: [], ...(inp.property || {}) },
      lines: inp.lines.map((l) => ({ ...l, key: l.key || uid() })), notes: inp.notes || "", internalNotes: inp.internalNotes || "", terms: inp.terms ?? null,
      ...Object.fromEntries(PROPOSAL_FIELDS.filter((k) => inp.proposal?.[k] !== undefined).map((k) => [k, inp.proposal[k]])),
      publicToken: e.public_token || null, sentAt: e.sent_at || null,
      response: { approvedName: e.approved_name, approvedAt: e.approved_at, decidedAt: e.decided_at, selection: e.selection || [], total: e.approval_total, recurring: e.approval_recurring, note: e.customer_note, online: e.responded_online, viewedAt: e.viewed_at, views: e.view_count },
    });
    setView("new");
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-extrabold">Estimator</h1>
          <p className="text-stone-500 text-sm">Prices come from your Pricing Settings and get sharper as you log jobs and mark estimates won or lost.</p>
        </div>
        <div className="flex gap-1.5">
          {[["new", est.id ? `Editing ${estNo(est.id)}` : "New estimate"], ["saved", `Saved (${estimates.length})`], ["settings", "Pricing settings"]].map(([id, l]) => (
            <button key={id} onClick={() => setView(id)} className={`px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap ${view === id ? "bg-emerald-900/50 text-emerald-300 border border-emerald-700/50" : "bg-stone-900 text-stone-400 border border-stone-800 hover:text-stone-200"}`}>{l}</button>
          ))}
        </div>
      </div>
      {msg && <div className="mb-4 text-sm bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-xl px-4 py-2.5">{msg}</div>}

      {view === "new" && (
        <Builder est={est} setEst={setEst} pricing={pricing} costingInputs={costingInputs} costing={costing} customers={customers}
          history={history} stats={stats}
          onSaved={async (saved, text) => { await refreshEstimates(); setEst((e) => ({ ...e, id: saved.id, status: saved.status, publicToken: saved.public_token || e.publicToken, sentAt: saved.sent_at || e.sentAt })); if (text) flash(text); }}
          onNew={() => setEst(blankEstimate())} />
      )}
      {view === "saved" && (
        <SavedList estimates={estimates} customers={customers} onOpen={openEstimate} onChanged={async (t) => { await refreshEstimates(); await onRefreshCustomers(); if (t) flash(t); }} />
      )}
      {view === "settings" && (
        <PricingSettings pricing={pricing} onSave={async (p) => { await onSavePricing(p); flash("Pricing settings saved"); }}
          customers={customers} serviceVisits={serviceVisits} history={history} stats={stats} costing={costing} onRefreshCustomers={onRefreshCustomers} />
      )}
    </div>
  );
}

// ============================================================
// BUILDER
// ============================================================
function Builder({ est, setEst, pricing, costingInputs, costing, customers, history, stats, onSaved, onNew }) {
  const [busy, setBusy] = useState(false);
  const prop = est.property;
  const setProp = (patch) => setEst((e) => ({ ...e, property: { ...e.property, ...patch } }));
  const setLine = (key, patch) => setEst((e) => ({ ...e, lines: e.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
  const removeLine = (key) => setEst((e) => ({ ...e, lines: e.lines.filter((l) => l.key !== key) }));
  const addService = (svc) => setEst((e) => ({ ...e, lines: [...e.lines, { key: uid(), serviceId: svc.id, qty: null, frequency: svc.defaultFreq, crew: 1, optional: !!svc.defaultOptional }] }));
  const addCustom = () => setEst((e) => ({ ...e, lines: [...e.lines, { key: uid(), custom: true, description: "", hours: "", materials: "", tier: "mid", markupPct: null, frequency: "once", crew: 1 }] }));
  const depth = prop.mulchDepthIn === "" || prop.mulchDepthIn == null ? pricing.mulchDepthIn : prop.mulchDepthIn;

  // Lines with no typed quantity follow the property details automatically
  const effectiveLines = est.lines.map((l) => {
    if (l.custom) return l;
    const svc = pricing.services.find((s) => s.id === l.serviceId);
    const auto = defaultQty(svc, { ...prop, mulchDepthIn: depth }, pricing);
    return { ...l, qty: l.qty === null || l.qty === undefined || l.qty === "" ? auto : l.qty, autoQty: auto };
  });
  const result = priceEstimate(effectiveLines, pricing, { ...prop, mulchDepthIn: depth }, costingInputs);
  const activeCustomers = [...customers].sort((a, b) => a.name.localeCompare(b.name));
  const target = costing.settings.targetHourly;

  const pickCustomer = (id) => {
    const c = customers.find((x) => String(x.id) === String(id));
    if (!c) { setEst((e) => ({ ...e, customerId: null })); return; }
    setEst((e) => ({ ...e, customerId: c.id, customerName: c.name, address: c.address || e.address, property: { ...e.property, lawnSqft: c.lawn_sqft || e.property.lawnSqft } }));
  };

  const locked = est.status === "approved" || est.status === "declined";
  const save = async (status, { withLink = false, quiet = false } = {}) => {
    if (!est.customerName.trim() || result.lines.length === 0) return null;
    setBusy(true);
    const linesToStore = result.lines.map((l) => {
      const unit = l.svc ? UNITS[l.svc.unit] : null;
      const units = unit ? unit.toUnits(Number(l.qty) || 0) : 0;
      return {
        key: l.key, serviceId: l.serviceId || null, custom: !!l.custom, description: est.lines.find((x) => x.key === l.key)?.description || "",
        qty: est.lines.find((x) => x.key === l.key)?.qty ?? null, frequency: l.frequency, crew: l.crew, priceOverride: l.priceOverride ?? null,
        hours: l.hours ?? null, materials: l.materials ?? null, tier: est.lines.find((x) => x.key === l.key)?.tier ?? null, markupPct: est.lines.find((x) => x.key === l.key)?.markupPct ?? null,
        detailsText: est.lines.find((x) => x.key === l.key)?.detailsText ?? null, visitsOverride: est.lines.find((x) => x.key === l.key)?.visitsOverride ?? null,
        optional: !!l.optional, workIncluded: est.lines.find((x) => x.key === l.key)?.workIncluded ?? "", acceptance: est.lines.find((x) => x.key === l.key)?.acceptance ?? "",
        // snapshot for history + learning
        price: l.price, autoPrice: l.autoPrice, unitPrice: units > 0 ? Math.round((l.price / units) * 100) / 100 : null, personMin: l.personMin, cost: l.cost, visits: l.visits,
        name: l.description,
      };
    });
    const record = {
      id: est.id || undefined,
      lead_id: est.leadId || null,
      customer_id: est.customerId || null,
      customer_name: est.customerName.trim(),
      address: est.address || "",
      status: locked ? est.status : (status || est.status || "draft"),
      inputs: { property: prop, lines: linesToStore, notes: est.notes, internalNotes: est.internalNotes, terms: est.terms ?? pricing.terms, pricingVersion: pricing.version,
        proposal: Object.fromEntries(PROPOSAL_FIELDS.map((k) => [k, est[k]])) },
      line_items: result.lines.map((l) => ({ description: `${l.description}${l.frequency !== "once" ? ` (${FREQUENCIES.find((f) => f.id === l.frequency)?.label.toLowerCase()})` : ""}`, amount: l.price })),
      base_price: result.perVisitRecurring || result.oneTimeTotal,
      monthly_estimate: result.monthlyEquivalent,
      annual_estimate: result.seasonTotal,
      one_time_total: result.oneTimeTotal,
      per_visit_total: result.perVisitRecurring,
      season_total: result.seasonTotal,
      est_minutes: result.firstVisitMin,
      est_cost: result.seasonCost,
      profit_margin: result.margin != null ? `${Math.round(result.margin * 100)}%` : "",
      recommendation: "",
      competitive_note: "",
    };
    // Customer link: create once, and refresh the customer-facing snapshot until they respond
    const token = est.publicToken || (withLink ? newToken() : null);
    if (token) record.public_token = token;
    if (token && !locked) record.snapshot = buildSnapshot();
    if ((record.status === "sent" || withLink) && !est.sentAt) record.sent_at = new Date().toISOString();
    if (locked) { delete record.status; }
    const saved = await db.saveEstimateRecord(record);
    setBusy(false);
    if (saved) await onSaved(saved, quiet ? "" : status === "sent" ? `${estNo(saved.id)} saved and marked sent` : `${estNo(saved.id)} saved${token && !locked ? " · customer link updated" : ""}`);
    return saved;
  };

  const content = { ...DEFAULT_PROPOSAL_CONTENT, ...(pricing.proposalContent || {}) };
  const defaults = proposalDefaults(result, content);
  const pv = (k) => (est[k] === null || est[k] === undefined || est[k] === "" ? defaults[k] : est[k]);
  // Customer-facing copy of the proposal (no costs, margins or internal notes)
  const buildSnapshot = () => {
    const rawLine = (k) => est.lines.find((x) => x.key === k) || {};
    return {
      template: est.template === "commercial" ? "commercial" : "residential",
      customer: est.customerName.trim(), address: est.address || "",
      projectTitle: pv("projectTitle"), pricingIntro: pv("pricingIntro"), startText: pv("startText"), timeOnSite: pv("timeOnSite"),
      warranty: est.warranty || "", exclusions: pv("exclusions"),
      notices: String(est.notices === null || est.notices === undefined ? defaults.notices || "" : est.notices).split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean),
      notes: est.notes || "", validDays: Number(content.validDays) || 90, seasonMonths: pricing.season.months,
      content: { companyName: content.companyName, contactName: content.contactName, phone: content.phone, email: content.email, whoWeAre: content.whoWeAre, reference1: content.reference1, reference2: content.reference2, commercialReference2: content.commercialReference2, depositTerms: content.depositTerms, optionalTerms: content.optionalTerms, payableBy: content.payableBy, validDays: content.validDays },
      lines: result.lines.map((l) => ({ key: l.key, description: l.description, proposalText: l.proposalText || "", price: l.price, frequency: l.frequency, visits: l.visits, seasonPrice: l.seasonPrice, optional: !!l.optional, workIncluded: rawLine(l.key).workIncluded || "", acceptance: rawLine(l.key).acceptance || "" })),
    };
  };
  const [linkOpen, setLinkOpen] = useState(false);
  const getLink = async () => {
    const saved = await save(est.status === "draft" ? "sent" : est.status, { withLink: true, quiet: true });
    if (saved) setLinkOpen(true);
  };

  const print = async () => {
    const saved = await save(est.status === "draft" ? "sent" : est.status);
    const number = estNo(saved?.id || est.id);
    if (est.template === "simple") {
      printEstimateV2({ customer: est.customerName, address: est.address, lines: result.lines.filter((l) => !l.optional), totals: result, notes: est.notes, terms: est.terms ?? pricing.terms, estimateNumber: number, property: prop });
      return;
    }
    const attachments = (await db.fetchAppSetting("proposal_attachments")) || {};
    const rawLine = (k) => est.lines.find((x) => x.key === k) || {};
    const data = {
      customer: est.customerName, address: est.address, estimateNumber: number, content,
      projectTitle: pv("projectTitle"), pricingIntro: pv("pricingIntro"), startText: pv("startText"), timeOnSite: pv("timeOnSite"),
      warranty: est.warranty, exclusions: pv("exclusions"), notices: String(est.notices === null || est.notices === undefined ? defaults.notices || "" : est.notices).split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean),
      notes: est.notes, seasonMonths: pricing.season.months, attachments, commercial: est.commercial || {},
      lines: result.lines.map((l) => ({ ...l, workIncluded: rawLine(l.key).workIncluded || "", acceptance: rawLine(l.key).acceptance || "" })),
    };
    if (est.template === "commercial") printCommercialProposal(data); else printResidentialProposal(data);
  };

  return (
    <div className="grid xl:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
      {linkOpen && est.publicToken && <LinkModal est={est} customers={customers} title={pv("projectTitle")} onClose={() => setLinkOpen(false)} />}
      <div className="space-y-5 min-w-0">
        <Panel>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold">Customer</h3>
            {(est.id || est.lines.length > 0) && <button onClick={onNew} className="text-xs text-emerald-500 hover:text-emerald-400">+ Start a new estimate</button>}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={label}>Existing customer (optional)</label>
              <select value={est.customerId || ""} onChange={(e) => pickCustomer(e.target.value)} className={`${inputCls} w-full`}>
                <option value="">New / prospect</option>
                {activeCustomers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Name on estimate</label>
              <input value={est.customerName} onChange={(e) => setEst((x) => ({ ...x, customerName: e.target.value }))} placeholder="e.g. Ronnie Whittemore" className={`${inputCls} w-full`} />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Property address</label>
              <input value={est.address} onChange={(e) => setEst((x) => ({ ...x, address: e.target.value }))} placeholder="Street, city" className={`${inputCls} w-full`} />
            </div>
          </div>
          {est.leadId && <p className="text-[11px] text-stone-500 mt-2">Linked to CRM lead #{est.leadId}</p>}
        </Panel>

        <Panel>
          <h3 className="font-bold mb-3">Property details</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <label className={label}>Lawn area (sq ft)</label>
              <input type="number" min="0" value={prop.lawnSqft} onChange={(e) => setProp({ lawnSqft: e.target.value })} placeholder="e.g. 8000" className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className={label}>Bed area (sq ft)</label>
              <input type="number" min="0" value={prop.bedSqft} onChange={(e) => setProp({ bedSqft: e.target.value })} placeholder="for mulch" className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className={label}>Mulch depth (in)</label>
              <input type="number" min="0" step="0.5" value={prop.mulchDepthIn} onChange={(e) => setProp({ mulchDepthIn: e.target.value })} placeholder={String(pricing.mulchDepthIn)} className={`${inputCls} w-full`} />
            </div>
          </div>
          {Number(prop.bedSqft) > 0 && <p className="text-[11px] text-stone-500 -mt-2 mb-3">≈ {cuYards(prop.bedSqft, depth).toFixed(1)} cu yd of mulch at {depth}" deep</p>}
          <label className={label}>Conditions (adjust lawn-service prices and time)</label>
          <div className="flex flex-wrap gap-2">
            {pricing.modifiers.map((m) => {
              const on = prop.modifiers.includes(m.id);
              return (
                <button key={m.id} onClick={() => setProp({ modifiers: on ? prop.modifiers.filter((x) => x !== m.id) : [...prop.modifiers, m.id] })}
                  className={`text-xs px-3 py-1.5 rounded-full border font-semibold ${on ? "bg-amber-900/40 border-amber-700/60 text-amber-200" : "bg-stone-800 border-stone-700 text-stone-400 hover:text-stone-200"}`}>
                  {on ? "✓ " : ""}{m.label} <span className="opacity-70">+{m.pct}%</span>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel>
          <h3 className="font-bold mb-3">Services</h3>
          {result.lines.length === 0 && <p className="text-sm text-stone-500 mb-3">Add the services this customer wants.</p>}
          <div className="space-y-3 mb-4">
            {result.lines.map((l) => (
              <LineEditor key={l.key} line={l} raw={est.lines.find((x) => x.key === l.key)} pricing={pricing} setLine={setLine} removeLine={removeLine}
                target={target} history={l.svc ? history[l.svc.category] : null} stats={stats[l.custom ? "custom" : l.serviceId]} template={est.template} />
            ))}
          </div>
          <ServicePicker pricing={pricing} onAdd={addService} onAddCustom={addCustom} />
        </Panel>

        <ProposalPanel est={est} setEst={setEst} defaults={defaults} pricing={pricing} />
      </div>

      {/* Summary */}
      <div className="space-y-4 xl:sticky xl:top-6">
        <Panel>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold">Customer price</h3>
            <Pill tone={STATUS_TONE[est.status]}>{est.id ? `${estNo(est.id)} · ${est.status}` : "unsaved"}</Pill>
          </div>
          <div className="space-y-2 mb-4">
            {result.oneTimeTotal > 0 && <Row l="One-time services" v={fmtMoney(result.oneTimeTotal, { cents: true })} big />}
            {result.perVisitRecurring > 0 && <Row l="Per visit (recurring)" v={fmtMoney(result.perVisitRecurring, { cents: true })} big />}
            {result.recurringSeason > 0 && <Row l={`Recurring for the season`} v={fmtMoney(result.recurringSeason)} sub={`≈ ${fmtMoney(result.monthlyEquivalent)}/mo over ${pricing.season.months} months`} />}
            <div className="border-t border-stone-800 pt-2"><Row l="Estimated season total" v={fmtMoney(result.seasonTotal, { cents: true })} big tone="text-emerald-400" /></div>
          </div>
          {locked && <ResponseBanner est={est} result={result} onDuplicate={() => setEst((e) => ({ ...e, id: null, status: "draft", publicToken: null, sentAt: null, response: null }))} />}
          <button disabled={busy || !est.customerName.trim() || !result.lines.length} onClick={getLink} className={`${btnPrimary} w-full py-3 mb-2`}>
            {est.publicToken ? (locked ? "View customer link" : "Update & copy customer link") : "Get customer link (approve online)"}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button disabled={busy || !est.customerName.trim() || !result.lines.length} onClick={() => save()} className={btnGhost}>Save draft</button>
            <button disabled={busy || !est.customerName.trim() || !result.lines.length} onClick={print} className={btnGhost}>{est.template === "simple" ? "Print / PDF" : "Print / PDF proposal"}</button>
          </div>
          {(!est.customerName.trim() || !result.lines.length) && <p className="text-[11px] text-stone-500 mt-2">Add a name and at least one service to save.</p>}
          <p className="text-[11px] text-stone-600 mt-2">Opens your {est.template === "commercial" ? "Commercial" : est.template === "simple" ? "one-page" : "Residential"} {est.template === "simple" ? "estimate" : "proposal template"}, filled in and ready to print or save as PDF. It also saves the estimate as sent; mark it accepted or declined under Saved so pricing advice learns.</p>
          {result.optionalTotal > 0 && <p className="text-[11px] text-amber-300/80 mt-1">+ {fmtMoney(result.optionalTotal)} in optional items the customer can sign to add (not in totals).</p>}
        </Panel>

        <Panel>
          <h3 className="font-bold mb-3">Your numbers <span className="text-stone-500 font-normal text-xs">(internal)</span></h3>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <MiniStat l="Season profit" v={fmtMoney(result.seasonProfit)} tone={result.seasonProfit >= 0 ? "text-amber-400" : "text-red-400"} />
            <MiniStat l="Margin" v={<Pill tone={marginTone(result.margin)}>{fmtPct(result.margin)}</Pill>} />
            <MiniStat l="First visit time" v={fmtHours(result.firstVisitMin)} sub="person-time" />
            <MiniStat l="$/person-hr" v={result.revPerPersonHour ? fmtMoney(result.revPerPersonHour) : "—"} tone={result.revPerPersonHour && result.revPerPersonHour >= target ? "text-emerald-400" : "text-amber-400"} sub={`target ${fmtMoney(target)}`} />
          </div>
          <div className="space-y-1.5">
            {result.lines.map((l) => (
              <div key={l.key} className="text-xs flex items-center justify-between gap-2 bg-stone-950/50 rounded-lg px-2.5 py-1.5">
                <span className="text-stone-300 truncate">{l.description}</span>
                <span className="whitespace-nowrap text-stone-400">{fmtHours(l.personMin)} · cost {fmtMoney(l.cost)} · <span className={l.margin != null && l.margin < 0.3 ? "text-red-400" : "text-stone-200"}>{fmtPct(l.margin)}</span></span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-stone-600 mt-3">Cost = materials + labor at {fmtMoney(costing.settings.laborRate)}/person-hr{costingInputs.includeOverhead ? ` + overhead ${fmtMoney(costing.overheadRate, { cents: true })}/crew-hr` : ""} (from Job Profitability rates).</p>
        </Panel>
      </div>
    </div>
  );
}

function ProposalPanel({ est, setEst, defaults, pricing }) {
  const set = (patch) => setEst((x) => ({ ...x, ...patch }));
  const setC = (patch) => setEst((x) => ({ ...x, commercial: { ...(x.commercial || {}), ...patch } }));
  const k = est.commercial || {};
  const fld = (key, lbl, rows = 1, ph) => (
    <div className={rows > 1 ? "md:col-span-2" : ""}>
      <label className={label}>{lbl}</label>
      {rows > 1
        ? <textarea rows={rows} value={est[key] ?? ""} placeholder={ph ?? defaults[key] ?? ""} onChange={(e) => set({ [key]: e.target.value })} className={`${inputCls} w-full text-xs`} />
        : <input value={est[key] ?? ""} placeholder={ph ?? defaults[key] ?? ""} onChange={(e) => set({ [key]: e.target.value })} className={`${inputCls} w-full`} />}
    </div>
  );
  const cf = (key, lbl, rows = 1, ph = "") => (
    <div className={rows > 1 ? "md:col-span-2" : ""}>
      <label className={label}>{lbl}</label>
      {rows > 1
        ? <textarea rows={rows} value={k[key] ?? ""} placeholder={ph} onChange={(e) => setC({ [key]: e.target.value })} className={`${inputCls} w-full text-xs`} />
        : <input value={k[key] ?? ""} placeholder={ph} onChange={(e) => setC({ [key]: e.target.value })} className={`${inputCls} w-full`} />}
    </div>
  );
  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="font-bold">Proposal</h3>
        <div className="flex gap-1.5">
          {[["residential", "Residential proposal"], ["commercial", "Commercial proposal"], ["simple", "Simple estimate"]].map(([id, l]) => (
            <button key={id} onClick={() => set({ template: id })} className={`text-xs px-3 py-1.5 rounded-lg font-semibold border ${est.template === id ? "bg-emerald-900/50 text-emerald-300 border-emerald-700/50" : "bg-stone-800 text-stone-400 border-stone-700 hover:text-stone-200"}`}>{l}</button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-stone-500 mb-3">Grey text is filled in automatically. Type over anything to change it for this estimate. Company sections (Who We Are, References, Payment Terms) and the insurance certificate are edited under Pricing settings → Proposal content.</p>
      {est.template === "simple" ? (
        <div className="grid md:grid-cols-2 gap-3">
          <div className="md:col-span-2"><label className={label}>Notes for the customer (printed)</label>
            <textarea rows={3} value={est.notes} onChange={(e) => set({ notes: e.target.value })} className={`${inputCls} w-full`} /></div>
          <div className="md:col-span-2"><label className={label}>Terms (printed)</label>
            <textarea rows={3} value={est.terms ?? pricing.terms} onChange={(e) => set({ terms: e.target.value })} className={`${inputCls} w-full text-xs`} /></div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {fld("projectTitle", "Project title")}
          {fld("timeOnSite", "Total time on site")}
          {fld("pricingIntro", "Pricing intro sentence", 2)}
          {fld("startText", "Start / scheduling", 2)}
          {fld("warranty", "Warranty", 2, "e.g. Plants guaranteed for one growing season with proper watering. (Leave blank to omit.)")}
          {fld("exclusions", est.template === "commercial" ? "Exclusions (one per line)" : "Services excluded", 2)}
          <div className="md:col-span-2">
            <label className={label}>Additional notices (Good to Know)</label>
            <textarea rows={est.notices || defaults.notices ? 4 : 2} value={est.notices ?? defaults.notices ?? ""} onChange={(e) => set({ notices: e.target.value })} placeholder="Anything the customer must know (flagging, pets, access…)" className={`${inputCls} w-full text-xs`} />
            {defaults.notices && est.notices == null && <p className="text-[10px] text-stone-500 mt-1">Aeration flagging notice added automatically because this estimate includes aeration.</p>}
          </div>
          <div className="md:col-span-2"><label className={label}>Extra note to customer (optional)</label>
            <textarea rows={2} value={est.notes} onChange={(e) => set({ notes: e.target.value })} className={`${inputCls} w-full text-xs`} /></div>
          {est.template === "commercial" && (<>
            <div className="md:col-span-2 border-t border-stone-800 pt-3 text-[11px] uppercase tracking-wider text-stone-500 font-semibold">Commercial details</div>
            {cf("clientCity", "Client city, state", 1, "Greenwood, IN")}
            {cf("oneLiner", "One-line scope description", 1, "Full landscape renovation and weekly maintenance program")}
            {cf("contactName", "Your contact name", 1, "Owen Scheidler")}
            {cf("contactPhone", "Contact phone", 1, "+1 (317) 868-4699")}
            {cf("broadScope", "Broad scope (letter of transmittal)", 2, "Auto: the list of services")}
            {cf("oneTimeSummary", "One-time investment summary", 1, "Uses the pricing intro if blank")}
            {cf("recurringSummary", "Recurring program description", 1, "Billed as performed.")}
            {cf("experience", "Relevant experience (one per line)", 3, "Fairways Condominiums — weekly maintenance, 17 units\nHeartland Dental — irrigation & landscape install")}
            {cf("compliance", "Compliance with plan", 2, "Confirm you've reviewed the plan/spec and priced to it (leave blank to omit)")}
            {cf("phases", "Schedule phases (one per line, e.g. Phase 1: Demo & grading)", 3, "Phase 1: …\nPhase 2: …")}
            {cf("siteAccess", "Site access & continuity", 2, "Entries and parking will never be blocked…")}
            {cf("confirmations", "Items requiring confirmation", 2)}
            {cf("siteConditions", "Site conditions & access assumptions", 2)}
            {cf("permits", "Permits", 2)}
            {cf("middlePct", "Progress payment % (optional)", 1, "0")}
            {cf("middleLabel", "Progress payment milestone", 1, "e.g. Hardscape complete")}
            {cf("paymentRecap", "Payment recap (terms)", 2, "50% due at signing; balance due upon completion and final walkthrough.")}
            {cf("invoicing", "Invoicing terms", 2, "Net 15; change orders billed separately…")}
          </>)}
        </div>
      )}
    </Panel>
  );
}

function ResponseBanner({ est, result, onDuplicate }) {
  const r = est.response || {};
  const picked = result.lines.filter((l) => l.optional && (r.selection || []).includes(l.key)).map((l) => l.description);
  const approved = est.status === "approved";
  return (
    <div className={`rounded-xl px-3 py-2.5 mb-3 text-xs ${approved ? "bg-emerald-950/60 border border-emerald-700/60 text-emerald-200" : "bg-red-950/40 border border-red-800/50 text-red-200"}`}>
      <div className="font-bold text-sm">{approved ? "✓ Approved" : "Declined / changes requested"}{r.online ? " online" : ""}{r.approvedName ? ` by ${r.approvedName}` : ""}</div>
      {(r.approvedAt || r.decidedAt) && <div className="opacity-80">{new Date(r.approvedAt || r.decidedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>}
      {approved && r.total != null && <div className="mt-1">Approved total {fmtMoney(r.total, { cents: true })}{Number(r.recurring) ? ` + ${fmtMoney(r.recurring, { cents: true })}/visit` : ""}</div>}
      {picked.length > 0 && <div className="mt-1">Optional items chosen: {picked.join(", ")}</div>}
      {r.note && <div className="mt-1 italic">"{r.note}"</div>}
      <div className="mt-2 opacity-80">Locked: edits won't change what the customer {approved ? "approved" : "saw"}. <button onClick={onDuplicate} className="underline font-semibold">Make a revised copy</button></div>
    </div>
  );
}

function LinkModal({ est, customers, title, onClose }) {
  const url = proposalUrl(est.publicToken);
  const cust = customers.find((c) => c.id === est.customerId) || {};
  const first = (est.customerName || "").split(" ")[0] || "there";
  const msg = `Hi ${first}, here's your proposal from Owen's Lawn & Landscape${title ? ` for ${title}` : ""}: ${url}\n\nYou can review it, choose any optional add-ons, and approve right from your phone. Questions? Call or text (317) 868-4699.\n\n— Owen`;
  const [copied, setCopied] = useState("");
  const copy = async (t, what) => { try { await navigator.clipboard.writeText(t); setCopied(what); setTimeout(() => setCopied(""), 2000); } catch { window.prompt("Copy this:", t); } };
  const phone = String(cust.phone || "").replace(/[^\d+]/g, "");
  return (
    <Modal title="Customer link" onClose={onClose}>
      <p className="text-sm text-stone-400 mb-3">Send this to {est.customerName}. They can review the proposal, pick optional add-ons, and approve or request changes online. You'll get an email and text when they respond.</p>
      <div className="flex gap-2 mb-4">
        <input readOnly value={url} onFocus={(e) => e.target.select()} className={`${inputCls} flex-1 min-w-0 text-xs`} />
        <button onClick={() => copy(url, "link")} className={btnPrimary}>{copied === "link" ? "Copied ✓" : "Copy link"}</button>
      </div>
      <label className={label}>Message</label>
      <textarea readOnly rows={6} value={msg} className={`${inputCls} w-full text-xs mb-3`} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button onClick={() => copy(msg, "msg")} className={btnGhost}>{copied === "msg" ? "Copied ✓" : "Copy message"}</button>
        <a href={`sms:${phone}${/iPhone|iPad|Mac/i.test(navigator.userAgent) ? "&" : "?"}body=${encodeURIComponent(msg)}`} className={`${btnGhost} text-center`}>Text</a>
        <a href={`mailto:${cust.email || ""}?subject=${encodeURIComponent(`Your proposal from Owen's Lawn & Landscape${title ? ` — ${title}` : ""}`)}&body=${encodeURIComponent(msg)}`} className={`${btnGhost} text-center`}>Email</a>
        <a href={`${url}?preview=1`} target="_blank" rel="noreferrer" className={`${btnGhost} text-center`}>Preview</a>
      </div>
      {est.response?.viewedAt && <p className="text-[11px] text-stone-500 mt-3">👁 Customer first opened it {new Date(est.response.viewedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}{est.response.views > 1 ? ` · ${est.response.views} views` : ""}</p>}
    </Modal>
  );
}

const Row = ({ l, v, sub, big, tone = "text-stone-100" }) => (
  <div className="flex items-baseline justify-between gap-3">
    <span className="text-sm text-stone-400">{l}{sub && <span className="block text-[11px] text-stone-600">{sub}</span>}</span>
    <span className={`${big ? "text-xl" : "text-base"} font-black ${tone}`}>{v}</span>
  </div>
);
const MiniStat = ({ l, v, sub, tone = "text-stone-100" }) => (
  <div className="bg-stone-950/50 rounded-xl px-3 py-2">
    <div className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold">{l}</div>
    <div className={`font-black text-lg ${tone}`}>{v}</div>
    {sub && <div className="text-[10px] text-stone-600">{sub}</div>}
  </div>
);

function rateSummary(svc, pricing) {
  const r = effectiveRate(svc, pricing);
  const tier = svc.rateTier ? pricing.laborTiers?.[svc.rateTier] : null;
  const parts = [];
  if (svc.unit === "material") parts.push(`material × ${r}`);
  else if (svc.mode === "time") parts.push(`${fmtMoney(svc.base)} + time × ${fmtMoney(r)}/hr${tier ? ` (${tier.label.split(" (")[0].toLowerCase()})` : ""}`);
  else if (svc.unit === "flat") parts.push(`${fmtMoney(svc.rate)} flat`);
  else if (svc.unit === "per_hour") parts.push(`${fmtMoney(r)}/hr${tier ? ` (${tier.label.split(" (")[0].toLowerCase()})` : ""}`);
  else {
    if (svc.base) parts.push(`${fmtMoney(svc.base)}${svc.includedUnits ? ` incl. first ${svc.includedUnits} ${UNITS[svc.unit].unitWord.replace(/^1,000 /, "×1,000 ")}` : ""}`);
    parts.push(`${fmtMoney(r, { cents: true })} ${UNITS[svc.unit].label}${svc.includedUnits ? " after that" : ""}`);
  }
  const minimum = Math.max(Number(svc.min) || 0, (Number(svc.minHours) || 0) * (svc.unit === "per_hour" ? r : 0));
  if (minimum) parts.push(`min ${fmtMoney(minimum)}`);
  return parts.join(" + ").replace(" + min", " · min");
}

function ServicePicker({ pricing, onAdd, onAddCustom }) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("Mowing & Lawn");
  const groups = SERVICE_GROUPS.filter((g) => pricing.services.some((s) => (s.group || "Other") === g));
  const t = q.trim().toLowerCase();
  const list = t ? pricing.services.filter((s) => `${s.name} ${s.group} ${s.category}`.toLowerCase().includes(t)) : pricing.services.filter((s) => (s.group || "Other") === group);
  return (
    <div className="border-t border-stone-800 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold">Add a service</div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search services…" className={`${inputCls} py-1.5 w-56`} />
      </div>
      {!t && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {groups.map((g) => (
            <button key={g} onClick={() => setGroup(g)} className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${group === g ? "bg-emerald-900/50 border-emerald-700/50 text-emerald-300" : "bg-stone-900 border-stone-700 text-stone-400 hover:text-stone-200"}`}>{g}</button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {list.map((s) => (
          <button key={s.id} onClick={() => onAdd(s)} title={s.guide || ""} className="text-xs bg-stone-800 hover:bg-emerald-900/50 hover:border-emerald-700 border border-stone-700 rounded-lg px-3 py-2 text-left text-stone-200">
            + {s.name}<span className="block text-[10px] text-stone-500">{rateSummary(s, pricing)}</span>
          </button>
        ))}
        {list.length === 0 && <span className="text-xs text-stone-500">No services match.</span>}
        <button onClick={onAddCustom} className="text-xs bg-stone-800 hover:bg-stone-700 border border-dashed border-stone-600 rounded-lg px-3 py-2 text-stone-300">+ Custom job (labor hours + materials)<span className="block text-[10px] text-stone-500">labor tier rate + tiered material markup</span></button>
      </div>
    </div>
  );
}

function LineEditor({ line: l, raw, pricing, setLine, removeLine, target, history, stats, template }) {
  const svc = l.svc;
  const unit = svc ? UNITS[svc.unit] : null;
  const qtyIsAuto = raw && (raw.qty === null || raw.qty === undefined || raw.qty === "");
  const advice = svc ? pricingAdvice(svc, history, stats, target) : [];
  return (
    <div className="border border-stone-800 rounded-xl p-3">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <input value={raw.description || ""} onChange={(e) => setLine(l.key, { description: e.target.value })}
            placeholder={l.custom ? "Describe the job (e.g. paver patio 12×14)" : (svc?.name || "Service")}
            className={`${inputCls} w-full font-semibold`} title="Name shown on the estimate" />
          {!l.custom && svc && <div className="text-[11px] text-stone-500 mt-0.5">{rateSummary(svc, pricing)}{l.modPct ? ` · +${l.modPct}% conditions` : ""}{svc.guide ? <span className="text-stone-600"> · guide: {svc.guide}</span> : null}</div>}
        </div>
        <div className="text-right">
          <div className="text-lg font-black text-emerald-400">{fmtMoney(l.price, { cents: true })}</div>
          <div className="text-[11px] text-stone-500">{l.optional ? <span className="text-amber-300">optional · </span> : null}{l.frequency !== "once" ? `per visit · ${fmtMoney(l.seasonPrice)}/season` : "one-time"}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {l.custom ? (
          <>
            <Field lbl="Labor type">
              <select value={raw.tier || "mid"} onChange={(e) => setLine(l.key, { tier: e.target.value })} className={inputCls}>
                {Object.entries(pricing.laborTiers).map(([k, t]) => <option key={k} value={k}>{t.label.split(" (")[0]} · {fmtMoney(t.rate)}/hr</option>)}
              </select>
            </Field>
            <Field lbl="Labor (person-hrs)"><input type="number" min="0" step="0.5" value={raw.hours ?? ""} onChange={(e) => setLine(l.key, { hours: e.target.value })} className={`${inputCls} w-24`} /></Field>
            <Field lbl="Your material cost ($)"><input type="number" min="0" step="1" value={raw.materials ?? ""} onChange={(e) => setLine(l.key, { materials: e.target.value })} className={`${inputCls} w-28`} /></Field>
            <Field lbl="Markup %"><input type="number" min="0" step="1" value={raw.markupPct ?? ""} placeholder={String(materialMarkupPct(pricing, Number(raw.materials) || 0))} onChange={(e) => setLine(l.key, { markupPct: e.target.value === "" ? null : e.target.value })} className={`${inputCls} w-20`} /></Field>
          </>
        ) : svc && svc.unit !== "flat" ? (
          <Field lbl={svc.unit === "material" ? (svc.itemLabel ? `Your cost (${svc.itemLabel})` : "Your material cost ($)") : `Quantity (${svc.unit === "per_item" ? svc.itemLabel || "items" : unit.qtyLabel})`}>
            <div className="flex items-center gap-1">
              <input type="number" min="0" step="any" value={qtyIsAuto ? "" : raw.qty} placeholder={qtyIsAuto ? String(l.qty || 0) : ""} onChange={(e) => setLine(l.key, { qty: e.target.value })} className={`${inputCls} w-28`} />
              {qtyIsAuto && Number(l.qty) > 0 && <span className="text-[10px] text-stone-500">auto</span>}
            </div>
          </Field>
        ) : null}
        <Field lbl="Frequency">
          <select value={l.frequency} onChange={(e) => setLine(l.key, { frequency: e.target.value })} className={inputCls}>
            {FREQUENCIES.map((f) => <option key={f.id} value={f.id}>{f.label}{f.id !== "once" ? ` (~${visitsPerSeason(f.id, pricing)})` : ""}</option>)}
          </select>
        </Field>
        <Field lbl="Crew">
          <select value={l.crew} onChange={(e) => setLine(l.key, { crew: Number(e.target.value) })} className={inputCls}>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <Field lbl="Price override">
          <input type="number" min="0" step="0.01" value={raw.priceOverride ?? ""} placeholder={String(l.autoPrice)} onChange={(e) => setLine(l.key, { priceOverride: e.target.value === "" ? null : e.target.value })} className={`${inputCls} w-28`} />
        </Field>
        {l.frequency !== "once" && (
          <Field lbl="Visits / season">
            <input type="number" min="1" value={raw.visitsOverride ?? ""} placeholder={String(visitsPerSeason(l.frequency, pricing))} onChange={(e) => setLine(l.key, { visitsOverride: e.target.value === "" ? null : e.target.value })} className={`${inputCls} w-20`} />
          </Field>
        )}
        <label className="flex items-center gap-1.5 text-xs text-stone-300 pb-2 cursor-pointer" title="Prints as *Optional with signature & date lines; not included in the total">
          <input type="checkbox" checked={!!raw.optional} onChange={(e) => setLine(l.key, { optional: e.target.checked })} className="accent-amber-500" /> Optional add-on
        </label>
        <button onClick={() => removeLine(l.key)} className="ml-auto text-xs text-stone-500 hover:text-red-400 pb-2">Remove</button>
      </div>
      <div className="mt-2">
        <div className="text-[10px] text-stone-500 mb-1">Description printed after the name</div>
        <textarea rows={2} value={raw.detailsText ?? ""} onChange={(e) => setLine(l.key, { detailsText: e.target.value })}
          placeholder={l.proposalText || "Describe the work for the customer (optional)"}
          className={`${inputCls} w-full text-xs py-1.5`} />
      </div>
      {template === "commercial" && (
        <div className="grid md:grid-cols-2 gap-2 mt-2">
          <div>
            <div className="text-[10px] text-stone-500 mb-1">Scope of work — work included (one per line)</div>
            <textarea rows={3} value={raw.workIncluded || ""} onChange={(e) => setLine(l.key, { workIncluded: e.target.value })} placeholder={"Excavate and compact base to 4\"\nInstall edge restraint\n…"} className={`${inputCls} w-full text-xs`} />
          </div>
          <div>
            <div className="text-[10px] text-stone-500 mb-1">Acceptance criteria</div>
            <textarea rows={3} value={raw.acceptance || ""} onChange={(e) => setLine(l.key, { acceptance: e.target.value })} placeholder="When this item is considered complete…" className={`${inputCls} w-full text-xs`} />
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-stone-500">
        <span>⏱ {fmtHours(l.personMin)}{l.crew > 1 ? ` (${fmtHours(l.personMin / l.crew)} on site)` : ""}</span>
        <span>Cost {fmtMoney(l.cost)}</span>
        <span className={l.revPerPersonHour && l.revPerPersonHour < target ? "text-amber-400" : ""}>{l.revPerPersonHour ? `${fmtMoney(l.revPerPersonHour)}/person-hr` : ""}</span>
        <span>Margin {fmtPct(l.margin)}</span>
      </div>
      {advice.length > 0 && (
        <div className="mt-2 space-y-1">
          {advice.map((a, i) => <div key={i} className={`text-[11px] rounded-lg px-2.5 py-1.5 ${a.tone === "amber" ? "bg-amber-950/40 text-amber-200" : a.tone === "green" ? "bg-emerald-950/40 text-emerald-300" : "bg-stone-800/60 text-stone-400"}`}>📈 {a.text}</div>)}
        </div>
      )}
    </div>
  );
}
const Field = ({ lbl, children }) => (<div><div className="text-[10px] text-stone-500 mb-1">{lbl}</div>{children}</div>);

// ============================================================
// SAVED ESTIMATES
// ============================================================
function SavedList({ estimates, customers, onOpen, onChanged }) {
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(null);
  const list = estimates.filter((e) => !filter || e.status === filter);
  const decided = estimates.filter((e) => e.status === "approved" || e.status === "declined");
  const won = estimates.filter((e) => e.status === "approved");
  const pipeline = estimates.filter((e) => e.status === "sent");
  const total = (arr) => arr.reduce((t, e) => t + Number(e.season_total || e.annual_estimate || 0), 0);

  const setStatus = async (e, status) => {
    setBusy(e.id);
    await db.saveEstimateRecord({ id: e.id, status, decided_at: status === "approved" || status === "declined" ? new Date().toISOString() : null });
    let note = `${estNo(e.id)} marked ${status}`;
    // Learning: remember the lawn size on the customer so mowing speed can be calibrated from logged times
    const lawn = Number(e.inputs?.property?.lawnSqft);
    if (status === "approved" && e.customer_id && lawn > 0) {
      const c = customers.find((x) => x.id === e.customer_id);
      if (c && !c.lawn_sqft) { await db.updateCustomer(e.customer_id, { lawn_sqft: Math.round(lawn) }); note += ` · saved ${Math.round(lawn).toLocaleString()} sq ft lawn size to ${c.name}`; }
    }
    await onChanged(note);
    setBusy(null);
  };
  const remove = async (e) => {
    if (!window.confirm(`Delete ${estNo(e.id)} for ${e.customer_name || "this customer"}?`)) return;
    setBusy(e.id); await db.deleteEstimate(e.id); await onChanged(`${estNo(e.id)} deleted`); setBusy(null);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Estimates" value={estimates.length} sub={`${pipeline.length} waiting on an answer`} tone="text-blue-400" />
        <Tile label="Open pipeline" value={fmtMoney(total(pipeline))} sub="sent, not decided" tone="text-amber-400" />
        <Tile label="Won" value={fmtMoney(total(won))} sub={`${won.length} approved`} />
        <Tile label="Win rate" value={decided.length ? `${Math.round((won.length / decided.length) * 100)}%` : "—"} sub={`${decided.length} decided`} tone="text-emerald-400" />
      </div>
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="font-bold">Saved estimates</h3>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className={inputCls}>
            <option value="">All statuses</option>
            {["draft", "sent", "approved", "declined"].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        {list.length === 0 && <p className="text-sm text-stone-500 py-8 text-center">No estimates yet.</p>}
        <div className="divide-y divide-stone-800/60">
          {list.map((e) => {
            const lines = e.inputs?.lines || e.line_items || [];
            return (
              <div key={e.id} className="py-3 flex flex-wrap items-center gap-3">
                <button onClick={() => onOpen(e)} className="flex-1 min-w-[220px] text-left">
                  <div className="text-sm"><span className="font-bold text-stone-100">{e.customer_name || (e.lead_id ? `Lead #${e.lead_id}` : "Unnamed")}</span> <span className="text-stone-500">· {estNo(e.id)} · {new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></div>
                  <div className="text-xs text-stone-500 truncate">{lines.map((l) => l.name || l.description).filter(Boolean).join(", ")}</div>
                  {e.responded_online && (e.status === "approved" || e.status === "declined") && (
                    <div className={`text-xs mt-0.5 ${e.status === "approved" ? "text-emerald-400" : "text-red-300"}`}>
                      {e.status === "approved" ? `✓ Approved online by ${e.approved_name}` : "Changes requested / declined online"} · {new Date(e.decided_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{e.customer_note ? ` · "${e.customer_note.slice(0, 80)}${e.customer_note.length > 80 ? "…" : ""}"` : ""}
                    </div>
                  )}
                  {e.public_token && !e.responded_online && <div className="text-[11px] text-stone-500 mt-0.5">{e.viewed_at ? `👁 Opened by customer ${new Date(e.viewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "🔗 Link created, not opened yet"}</div>}
                </button>
                <div className="text-right">
                  <div className="font-bold text-emerald-400">{fmtMoney(e.status === "approved" && e.approval_total != null && e.responded_online ? e.approval_total : e.season_total || e.annual_estimate)}</div>
                  <div className="text-[11px] text-stone-500">{e.profit_margin ? `${e.profit_margin} margin` : ""}</div>
                </div>
                <select disabled={busy === e.id} value={e.status} onChange={(ev) => setStatus(e, ev.target.value)} className={`${inputCls} py-1.5`}>
                  {["draft", "sent", "approved", "declined"].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
                </select>
                <button onClick={() => onOpen(e)} className="text-xs text-emerald-500 hover:text-emerald-400">{e.inputs?.lines ? "Open" : "Print"}</button>
                {e.public_token && <button onClick={() => navigator.clipboard?.writeText(proposalUrl(e.public_token))} className="text-xs text-stone-400 hover:text-stone-200" title="Copy customer link">Copy link</button>}
                <button disabled={busy === e.id} onClick={() => remove(e)} className="text-xs text-stone-600 hover:text-red-400">Delete</button>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

// ============================================================
// PRICING SETTINGS
// ============================================================
function PricingSettings({ pricing, onSave, customers, serviceVisits, history, stats, costing, onRefreshCustomers }) {
  const [p, setP] = useState(() => structuredClone(pricing));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setP(structuredClone(pricing)); }, [pricing]);
  const dirty = JSON.stringify(p) !== JSON.stringify(pricing);
  const setSvc = (id, patch) => setP((x) => ({ ...x, services: x.services.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const setMod = (id, patch) => setP((x) => ({ ...x, modifiers: x.modifiers.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  const num = (v) => (v === "" ? "" : Number(v));
  const mow = useMemo(() => calibrateMowing(customers, serviceVisits), [customers, serviceVisits]);
  const target = costing.settings.targetHourly;

  const addService = () => {
    const id = `svc_${Math.random().toString(36).slice(2, 7)}`;
    setP((x) => ({ ...x, services: [...x.services, { id, group: "Other", name: "New service", category: "Other", unit: "per_item", mode: "rate", qtySource: "manual", base: 0, rate: 50, includedUnits: 0, min: 0, minHours: 0, rateTier: "", production: 1, setupMin: 0, materialCost: 0, materialMultiplier: 0, defaultFreq: "once", usesModifiers: false, itemLabel: "", guide: "" }] }));
  };
  const save = async () => { setBusy(true); await onSave({ ...p, version: (Number(pricing.version) || 1) + 1 }); setBusy(false); };

  const cell = `${inputCls} w-full py-1.5 px-2`;
  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-stone-950/90 backdrop-blur flex items-center justify-between gap-3">
        <p className="text-sm text-stone-400">{dirty ? <span className="text-amber-300">Unsaved changes</span> : "Changes apply to new estimates. Saved estimates keep their prices."}</p>
        <div className="flex gap-2">
          {dirty && <button onClick={() => setP(structuredClone(pricing))} className={btnGhost}>Discard</button>}
          <button disabled={!dirty || busy} onClick={save} className={btnPrimary}>Save pricing</button>
        </div>
      </div>

      <Panel>
        <h3 className="font-bold mb-1">Services & rates</h3>
        <p className="text-xs text-stone-500 mb-4">Loaded from {p.source || "your pricing guide"}; ranges use the midpoint, so adjust to taste. Speed (how much one person completes per hour) drives time, labor cost and $/hour; for mowing it also drives the price.</p>
        <div className="space-y-3">
          {SERVICE_GROUPS.filter((g) => p.services.some((s) => (s.group || "Other") === g)).map((g) => {
            const items = p.services.filter((s) => (s.group || "Other") === g);
            return (
              <details key={g} className="border border-stone-800 rounded-xl" open={g === "Mowing & Lawn"}>
                <summary className="cursor-pointer select-none px-4 py-3 font-semibold text-stone-200 flex items-center justify-between">
                  <span>{g}</span><span className="text-xs text-stone-500 font-normal">{items.length} service{items.length === 1 ? "" : "s"}</span>
                </summary>
                <div className="px-3 pb-3 space-y-3">
                  {items.map((s) => (
                    <ServiceCard key={s.id} s={s} p={p} setSvc={setSvc} setP={setP} history={history} stats={stats} target={target} mow={mow} />
                  ))}
                </div>
              </details>
            );
          })}
        </div>
        <button onClick={addService} className={`${btnGhost} mt-3`}>+ Add a service</button>
      </Panel>

      <div className="grid lg:grid-cols-2 gap-5">
        <Panel>
          <h3 className="font-bold mb-1">Labor rates</h3>
          <p className="text-xs text-stone-500 mb-3">Services billed "at labor rate" and custom jobs use these. Your guide's range is shown for reference.</p>
          <div className="space-y-2">
            {Object.entries(p.laborTiers).map(([k, t]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-stone-300">{t.label}<span className="block text-[11px] text-stone-500">guide {t.guide}</span></span>
                <span className="text-stone-500 text-sm">$</span>
                <input type="number" value={t.rate} onChange={(e) => setP((x) => ({ ...x, laborTiers: { ...x.laborTiers, [k]: { ...t, rate: num(e.target.value) } } }))} className={`${inputCls} w-24 py-1.5`} />
                <span className="text-stone-500 text-sm">/hr</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <h3 className="font-bold mb-1">Material markup (custom jobs)</h3>
          <p className="text-xs text-stone-500 mb-3">Applied to your total material cost on custom-job lines. You can override it per line.</p>
          <div className="space-y-2">
            {p.materialMarkupTiers.map((t, i) => {
              const prev = i ? p.materialMarkupTiers[i - 1].upTo : 0;
              const setTier = (patch) => setP((x) => ({ ...x, materialMarkupTiers: x.materialMarkupTiers.map((y, j) => (j === i ? { ...y, ...patch } : y)) }));
              return (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-stone-400 w-44">{t.upTo === null ? `Over ${fmtMoney(prev)}` : i === 0 ? "Under" : `${fmtMoney(prev)} to`}</span>
                  {t.upTo !== null && <><span className="text-stone-500">$</span><input type="number" value={t.upTo} onChange={(e) => setTier({ upTo: num(e.target.value) })} className={`${inputCls} w-24 py-1.5`} /></>}
                  <span className="text-stone-500 ml-auto">markup</span>
                  <input type="number" value={t.pct} onChange={(e) => setTier({ pct: num(e.target.value) })} className={`${inputCls} w-20 py-1.5`} /><span className="text-stone-500">%</span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Panel>
          <h3 className="font-bold mb-3">Conditions</h3>
          <div className="space-y-2">
            {p.modifiers.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <input value={m.label} onChange={(e) => setMod(m.id, { label: e.target.value })} className={`${inputCls} flex-1 py-1.5`} />
                <input type="number" value={m.pct} onChange={(e) => setMod(m.id, { pct: num(e.target.value) })} className={`${inputCls} w-20 py-1.5`} /><span className="text-stone-500 text-sm">%</span>
                <button onClick={() => setP((x) => ({ ...x, modifiers: x.modifiers.filter((y) => y.id !== m.id) }))} className="text-xs text-stone-600 hover:text-red-400">✕</button>
              </div>
            ))}
          </div>
          <button onClick={() => setP((x) => ({ ...x, modifiers: [...x.modifiers, { id: `m_${Math.random().toString(36).slice(2, 7)}`, label: "New condition", pct: 10 }] }))} className="text-xs text-emerald-500 mt-3">+ Add condition</button>
        </Panel>
        <Panel>
          <h3 className="font-bold mb-3">Season & estimate defaults</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field lbl="Weekly visits / season"><input type="number" value={p.season.weekly} onChange={(e) => setP((x) => ({ ...x, season: { ...x.season, weekly: num(e.target.value) } }))} className={cell} /></Field>
            <Field lbl="Every-2-weeks visits"><input type="number" value={p.season.biweekly} onChange={(e) => setP((x) => ({ ...x, season: { ...x.season, biweekly: num(e.target.value) } }))} className={cell} /></Field>
            <Field lbl="Monthly visits / season"><input type="number" value={p.season.monthly} onChange={(e) => setP((x) => ({ ...x, season: { ...x.season, monthly: num(e.target.value) } }))} className={cell} /></Field>
            <Field lbl="Season length (months)"><input type="number" value={p.season.months} onChange={(e) => setP((x) => ({ ...x, season: { ...x.season, months: num(e.target.value) } }))} className={cell} /></Field>
            <Field lbl="Default mulch depth (in)"><input type="number" step="0.5" value={p.mulchDepthIn} onChange={(e) => setP((x) => ({ ...x, mulchDepthIn: num(e.target.value) }))} className={cell} /></Field>
          </div>
          <div className="mt-3"><Field lbl="Default terms printed on estimates">
            <textarea rows={4} value={p.terms || ""} onChange={(e) => setP((x) => ({ ...x, terms: e.target.value }))} className={`${inputCls} w-full text-xs`} />
          </Field></div>
        </Panel>
      </div>

      <ProposalContent p={p} setP={setP} />
      <ProposalAttachments />

      <LawnSizes customers={customers} onRefreshCustomers={onRefreshCustomers} />
    </div>
  );
}

function ProposalContent({ p, setP }) {
  const c = { ...DEFAULT_PROPOSAL_CONTENT, ...(p.proposalContent || {}) };
  const set = (k, v) => setP((x) => ({ ...x, proposalContent: { ...(x.proposalContent || {}), [k]: v } }));
  const f = (k, lbl, rows = 1) => (
    <div className={rows > 1 ? "md:col-span-2" : ""}>
      <div className="text-[10px] text-stone-500 mb-1">{lbl}</div>
      {rows > 1
        ? <textarea rows={rows} value={c[k]} onChange={(e) => set(k, e.target.value)} className={`${inputCls} w-full text-xs`} />
        : <input value={c[k]} onChange={(e) => set(k, e.target.value)} className={`${inputCls} w-full py-1.5`} />}
    </div>
  );
  return (
    <Panel>
      <details>
        <summary className="cursor-pointer select-none font-bold">Proposal content <span className="text-xs font-normal text-stone-500">: company sections printed on every proposal (from your Drive templates)</span></summary>
        <div className="grid md:grid-cols-2 gap-3 mt-4">
          {f("contactName", "Contact name")}{f("contactTitle", "Contact title")}
          {f("phone", "Phone")}{f("email", "Email")}
          {f("companyLegal", "Legal name (Prepared by)")}{f("address", "Business address")}
          {f("validDays", "Proposals valid for (days)")}{f("payableBy", "Payable by")}
          {f("whoWeAre", "Who We Are (blank line between paragraphs)", 7)}
          {f("reference1", "Reference letter 1", 6)}
          {f("reference2", "Reference letter 2 (residential)", 6)}
          {f("commercialReference2", "Reference letter 2 (commercial)", 4)}
          {f("startDefault", "Default start / scheduling sentence", 2)}
          {f("servicesExcluded", "Default services-excluded sentence", 2)}
          {f("depositTerms", "Deposit terms", 3)}
          {f("optionalTerms", "Optional line item authorization", 3)}
          {f("aerationNotice", "Aeration flagging notice (added automatically when aeration is on an estimate)", 5)}
          {f("customerServiceNote", "Customer service note (commercial)", 2)}
        </div>
        <button onClick={() => setP((x) => ({ ...x, proposalContent: {} }))} className="text-xs text-stone-500 hover:text-stone-300 mt-3">Reset to template wording</button>
      </details>
    </Panel>
  );
}

// Certificate of Insurance / W-9 images, stored admin-only and added to proposals
function ProposalAttachments() {
  const [att, setAtt] = useState(null);
  const [busy, setBusy] = useState("");
  useEffect(() => { db.fetchAppSetting("proposal_attachments").then((v) => setAtt(v || {})); }, []);
  const toJpeg = (file) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1700 / img.width);
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
      const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      resolve(cv.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Not an image"));
    img.src = URL.createObjectURL(file);
  });
  // PDFs are rendered to images in the browser (pdf.js is loaded only when needed)
  const pdfToJpegs = async (file) => {
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let i = 1; i <= Math.min(doc.numPages, 4); i++) {
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale: 1700 / page.getViewport({ scale: 1 }).width });
      const cv = document.createElement("canvas");
      cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
      const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      pages.push(cv.toDataURL("image/jpeg", 0.85));
    }
    return pages;
  };
  const upload = async (key, file) => {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf && !file.type.startsWith("image/")) { alert("Please upload a PDF or an image (PNG/JPG)."); return; }
    setBusy(key);
    try {
      const pages = isPdf ? await pdfToJpegs(file) : [await toJpeg(file)];
      const next = { ...(att || {}), [key]: pages[0], [`${key}Pages`]: pages, [`${key}UpdatedAt`]: new Date().toISOString(), [`${key}FileName`]: file.name };
      await db.saveAppSetting("proposal_attachments", next);
      setAtt(next);
    } catch (e) { alert(e.message); }
    setBusy("");
  };
  const remove = async (key) => {
    const next = { ...(att || {}) }; for (const k of [key, `${key}Pages`, `${key}UpdatedAt`, `${key}FileName`]) delete next[k];
    await db.saveAppSetting("proposal_attachments", next); setAtt(next);
  };
  const slot = (key, title, note) => (
    <div className="border border-stone-800 rounded-xl p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div><div className="font-semibold text-sm text-stone-200">{title}</div><div className="text-[11px] text-stone-500">{note}</div></div>
        {att?.[key] && <button onClick={() => remove(key)} className="text-xs text-stone-500 hover:text-red-400">Remove</button>}
      </div>
      {att?.[key]
        ? <img src={att[key]} alt={title} className="w-full max-h-48 object-contain bg-white rounded-lg" />
        : <div className="text-xs text-stone-500 bg-stone-950/50 rounded-lg px-3 py-6 text-center">Not uploaded yet</div>}
      <label className={`${btnGhost} mt-2 inline-block cursor-pointer text-xs`}>
        {busy === key ? "Uploading…" : att?.[key] ? "Replace (PDF or image)" : "Upload PDF or image"}
        <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { upload(key, e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {att?.[`${key}UpdatedAt`] && <span className="text-[10px] text-stone-600 ml-2">{att[`${key}FileName`] ? `${att[`${key}FileName`]} · ` : ""}{(att[`${key}Pages`] || []).length > 1 ? `${att[`${key}Pages`].length} pages · ` : ""}updated {new Date(att[`${key}UpdatedAt`]).toLocaleDateString()}</span>}
    </div>
  );
  return (
    <Panel>
      <h3 className="font-bold mb-1">Proposal attachments</h3>
      <p className="text-xs text-stone-500 mb-3">Added as the last page(s) of proposals. Stored privately; only signed-in admins can load them.</p>
      {att === null ? <p className="text-xs text-stone-500">Loading…</p> : (
        <div className="grid md:grid-cols-2 gap-3">
          {slot("coi", "Certificate of Insurance", "Residential + commercial proposals. Replace when your policy renews.")}
          {slot("w9", "Form W-9", "Commercial proposals only. Contains your tax ID — only upload if you want it attached.")}
        </div>
      )}
    </Panel>
  );
}

function ServiceCard({ s, p, setSvc, setP, history, stats, target, mow }) {
  const unit = UNITS[s.unit] || UNITS.flat;
  const h = history[s.category];
  const st = stats[s.id];
  const advice = pricingAdvice(s, h, st, target);
  const num = (v) => (v === "" ? "" : Number(v));
  const cell = `${inputCls} w-full py-1.5 px-2`;
  const isMat = s.unit === "material", isHour = s.unit === "per_hour", isFlat = s.unit === "flat", isTime = s.mode === "time";
  const canTime = ["per_1000_sqft", "per_sqft", "per_cu_yd", "per_ft", "per_item"].includes(s.unit);
  const tierSel = (
    <Field lbl="Labor rate">
      <select value={s.rateTier || ""} onChange={(e) => setSvc(s.id, { rateTier: e.target.value })} className={cell}>
        <option value="">Use my own rate</option>
        {Object.entries(p.laborTiers).map(([k, t]) => <option key={k} value={k}>{t.label.split(" (")[0]} ({fmtMoney(t.rate)}/hr)</option>)}
      </select>
    </Field>
  );
  return (
    <div className="bg-stone-950/40 border border-stone-800 rounded-xl p-3">
      <div className="grid grid-cols-2 md:grid-cols-12 gap-2 items-end">
        <div className="col-span-2 md:col-span-4"><Field lbl="Service name"><input value={s.name} onChange={(e) => setSvc(s.id, { name: e.target.value })} className={`${cell} font-semibold`} /></Field></div>
        <div className="md:col-span-2"><Field lbl="Section">
          <select value={s.group || "Other"} onChange={(e) => setSvc(s.id, { group: e.target.value })} className={cell}>{SERVICE_GROUPS.map((g) => <option key={g}>{g}</option>)}</select>
        </Field></div>
        <div className="md:col-span-2"><Field lbl="Job category (history)">
          <select value={s.category} onChange={(e) => setSvc(s.id, { category: e.target.value })} className={cell}>{SERVICE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        </Field></div>
        <div className="md:col-span-2"><Field lbl="Priced">
          <select value={s.unit} onChange={(e) => setSvc(s.id, { unit: e.target.value, mode: "rate", qtySource: e.target.value === "per_1000_sqft" ? "lawn" : e.target.value === "per_cu_yd" ? "beds" : "manual" })} className={cell}>
            {Object.entries(UNITS).map(([k, u]) => <option key={k} value={k}>{u.label}</option>)}
          </select>
        </Field></div>
        <div className="col-span-2 md:col-span-2"><Field lbl="Default frequency">
          <select value={s.defaultFreq} onChange={(e) => setSvc(s.id, { defaultFreq: e.target.value })} className={cell}>{FREQUENCIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
        </Field></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end mt-2">
        {isMat && <Field lbl="Multiplier on your cost"><input type="number" step="0.05" value={s.materialMultiplier} onChange={(e) => setSvc(s.id, { materialMultiplier: num(e.target.value) })} className={cell} /></Field>}
        {isMat && <Field lbl="Quantity label (optional)"><input value={s.itemLabel || ""} onChange={(e) => setSvc(s.id, { itemLabel: e.target.value })} placeholder="material $" className={cell} /></Field>}
        {isHour && tierSel}
        {isHour && !s.rateTier && <Field lbl="Rate $ / hour"><input type="number" step="1" value={s.rate} onChange={(e) => setSvc(s.id, { rate: num(e.target.value) })} className={cell} /></Field>}
        {isHour && <Field lbl="Minimum hours"><input type="number" step="0.25" value={s.minHours} onChange={(e) => setSvc(s.id, { minHours: num(e.target.value) })} className={cell} /></Field>}
        {isFlat && <Field lbl="Flat price $"><input type="number" step="1" value={s.rate} onChange={(e) => setSvc(s.id, { rate: num(e.target.value) })} className={cell} /></Field>}
        {canTime && <Field lbl="Pricing method">
          <select value={s.mode || "rate"} onChange={(e) => setSvc(s.id, { mode: e.target.value, rateTier: e.target.value === "time" ? (s.rateTier || "mid") : s.rateTier })} className={cell}>
            <option value="rate">Rate × quantity</option><option value="time">Time × labor rate</option>
          </select>
        </Field>}
        {canTime && isTime && tierSel}
        {canTime && <Field lbl={isTime ? "Flat fee per visit $" : "Base fee $"}><input type="number" step="0.5" value={s.base} onChange={(e) => setSvc(s.id, { base: num(e.target.value) })} className={cell} /></Field>}
        {canTime && !isTime && <Field lbl={`Rate $ / ${unit.unitWord}`}><input type="number" step="0.05" value={s.rate} onChange={(e) => setSvc(s.id, { rate: num(e.target.value) })} className={cell} /></Field>}
        {canTime && !isTime && <Field lbl={`Included in base (${unit.unitWord}s)`}><input type="number" step="1" value={s.includedUnits} onChange={(e) => setSvc(s.id, { includedUnits: num(e.target.value) })} className={cell} /></Field>}
        {!isMat && <Field lbl="Minimum $"><input type="number" step="1" value={s.min} onChange={(e) => setSvc(s.id, { min: num(e.target.value) })} className={cell} /></Field>}
        {s.unit === "per_item" && <Field lbl="Item name"><input value={s.itemLabel || ""} onChange={(e) => setSvc(s.id, { itemLabel: e.target.value })} placeholder="items" className={cell} /></Field>}
        {canTime && <Field lbl={`Speed: ${unit.unitWord}s / person-hr`}><input type="number" step="0.05" value={s.production} onChange={(e) => setSvc(s.id, { production: num(e.target.value) })} className={cell} /></Field>}
        {!isHour && <Field lbl="Setup / travel min"><input type="number" step="1" value={s.setupMin} onChange={(e) => setSvc(s.id, { setupMin: num(e.target.value) })} className={cell} /></Field>}
        {(canTime || isFlat) && <Field lbl={`Your material cost $ / ${unit.unitWord}`}><input type="number" step="0.1" value={s.materialCost} onChange={(e) => setSvc(s.id, { materialCost: num(e.target.value) })} className={cell} /></Field>}
      </div>
      <div className="mt-2"><input value={s.guide || ""} onChange={(e) => setSvc(s.id, { guide: e.target.value })} placeholder="Pricing guide note (e.g. $40–$70 per yard)" className={`${inputCls} w-full text-xs py-1.5`} /></div>
      <div className="flex flex-wrap items-center gap-4 mt-2 text-xs">
        {!isMat && <label className="flex items-center gap-1.5 text-stone-400 cursor-pointer"><input type="checkbox" checked={!!s.usesModifiers} onChange={(e) => setSvc(s.id, { usesModifiers: e.target.checked })} className="accent-emerald-600" /> Apply condition adjustments</label>}
        <span className="text-stone-500">Prices as: <span className="text-stone-300">{rateSummary(s, p)}</span></span>
        <span className="text-stone-500">{h ? `History: ${h.jobs} jobs · ${h.revPerPersonHour ? `${fmtMoney(h.revPerPersonHour)}/person-hr` : "no time logged"}` : ""}{st && (st.accepted + st.declined) ? ` · ${st.accepted}/${st.accepted + st.declined} estimates won` : ""}</span>
        <button onClick={() => { if (window.confirm(`Remove "${s.name}" from the catalog?`)) setP((x) => ({ ...x, services: x.services.filter((y) => y.id !== s.id) })); }} className="ml-auto text-stone-600 hover:text-red-400">Remove</button>
      </div>
      {advice.map((a, i) => <div key={i} className={`mt-2 text-[11px] rounded-lg px-2.5 py-1.5 ${a.tone === "amber" ? "bg-amber-950/40 text-amber-200" : a.tone === "green" ? "bg-emerald-950/40 text-emerald-300" : "bg-stone-800/60 text-stone-400"}`}>📈 {a.text}</div>)}
      {s.id === "mowing" && (
        <div className="mt-2 text-[11px] rounded-lg px-2.5 py-1.5 bg-blue-950/40 text-blue-200">
          {mow.sqftPerHour
            ? <>Your logged mowing times say <strong>{mow.sqftPerHour.toLocaleString()} sq ft per person-hour</strong> ({mow.n} visits, {mow.customers} customers). Settings use {(Number(s.production || 0) * 1000).toLocaleString()}.{" "}
                <button onClick={() => setSvc("mowing", { production: Math.round(mow.sqftPerHour / 100) / 10 })} className="underline font-semibold">Use my actual speed</button></>
            : <>Mowing price is time-based, so speed matters. Calibration needs lawn sizes: add them below (approved estimates fill them in automatically) and keep logging time. {mow.n} usable visits so far, 3 needed.</>}
        </div>
      )}
    </div>
  );
}

function LawnSizes({ customers, onRefreshCustomers }) {
  const active = customers.filter((c) => c.status === "Active" && /mow/i.test(c.service || "")).sort((a, b) => a.name.localeCompare(b.name));
  const [vals, setVals] = useState({});
  const [busy, setBusy] = useState(false);
  const changed = Object.entries(vals).filter(([id, v]) => String(v) !== String(customers.find((c) => String(c.id) === id)?.lawn_sqft ?? ""));
  const save = async () => {
    setBusy(true);
    for (const [id, v] of changed) await db.updateCustomer(Number(id), { lawn_sqft: v === "" ? null : Math.round(Number(v)) });
    setVals({}); await onRefreshCustomers(); setBusy(false);
  };
  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h3 className="font-bold">Lawn sizes for mowing customers</h3>
        <button disabled={busy || !changed.length} onClick={save} className={btnPrimary}>Save {changed.length || ""} size{changed.length === 1 ? "" : "s"}</button>
      </div>
      <p className="text-xs text-stone-500 mb-3">Known lawn sizes plus logged mowing times teach the estimator your real mowing speed. A rough number from Google Maps' measure tool is fine.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {active.map((c) => (
          <label key={c.id} className="flex items-center justify-between gap-2 bg-stone-950/40 rounded-lg px-3 py-1.5">
            <span className="text-sm text-stone-300 truncate">{c.name}</span>
            <span className="flex items-center gap-1"><input type="number" min="0" value={vals[c.id] ?? c.lawn_sqft ?? ""} onChange={(e) => setVals((x) => ({ ...x, [c.id]: e.target.value }))} placeholder="sq ft" className={`${inputCls} w-24 py-1 px-2`} /></span>
          </label>
        ))}
      </div>
    </Panel>
  );
}
