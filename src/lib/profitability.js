// ============================================================
// JOB COSTING & PROFITABILITY ENGINE
// Pure functions: no React, no Supabase. Everything the dashboard and
// Job Profitability tab show is computed here from the raw tables.
// ============================================================

export const DEFAULT_COSTING_SETTINGS = {
  laborRate: 20,        // $ per person-hour used when no actual pay is linked to a job
  targetHourly: 60,     // revenue goal per person-hour
  includeOverhead: true // spread fuel, equipment, insurance, etc. across jobs by time
};

// Expense categories that belong to a specific job. Everything else is overhead.
export const DIRECT_COST_CATEGORIES = ["Materials", "Wages", "Contract Labor"];
export const LABOR_CATEGORIES = ["Wages", "Contract Labor"];

export const SERVICE_CATEGORIES = [
  "Mowing",
  "Aeration & Overseeding",
  "Lawn Treatment",
  "Landscaping",
  "Mulching",
  "Hedge & Tree Trimming",
  "Cleanups",
  "Weeding",
  "Service Plans",
  "Snow Removal",
  "Other",
];

export const CUSTOMER_SOURCES = [
  "Website",
  "Referral",
  "Returning (2025)",
  "Word of mouth",
  "Facebook",
  "Nextdoor",
  "Google",
  "Yard sign / Flyer",
  "Neighbor of client",
  "Manual entry",
  "Other",
];

// ── Helpers ─────────────────────────────────────────────────
export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Dates are stored as "YYYY-MM-DD". Parse the string directly so the
// month never shifts because of the browser's time zone.
export const yearOf = (d) => Number(String(d || "").slice(0, 4));
export const monthOf = (d) => Number(String(d || "").slice(5, 7)) - 1;
const dayNum = (d) => {
  const [y, m, dd] = String(d || "").slice(0, 10).split("-").map(Number);
  return Date.UTC(y, (m || 1) - 1, dd || 1) / 86400000;
};

const num = (v) => (v === null || v === undefined || v === "" ? 0 : Number(v) || 0);

export const fmtMoney = (v, { cents = false } = {}) => {
  const n = Number(v) || 0;
  const s = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
  return `${n < 0 ? "-" : ""}$${s}`;
};

// $850, $4.2k, $12k
export const fmtCompact = (v) => {
  const n = Number(v) || 0;
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a < 1000) return `${sign}$${Math.round(a)}`;
  if (a < 10000) return `${sign}$${(a / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${sign}$${Math.round(a / 1000)}k`;
};

export const fmtPct = (v) => (v === null || v === undefined || !isFinite(v) ? "—" : `${(v * 100).toFixed(1)}%`);

export const fmtHours = (minutes) => {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};

// Margin colour bands used everywhere
export const marginTone = (m) => {
  if (m === null || m === undefined || !isFinite(m)) return "gray";
  if (m >= 0.5) return "green";
  if (m >= 0.3) return "yellow";
  return "red";
};

// "Ronnie Whittemore" → "Whittemore"; businesses keep their full name
export function jobLabelName(name = "") {
  const clean = String(name).trim().replace(/\s+/g, " ");
  if (!clean) return "Unknown";
  if (/\b(assoc|association|llc|inc|condo|condos|hoa|church|company|co\.|properties|dental|school|apartments)\b/i.test(clean)) return clean;
  const parts = clean.split(" ");
  return parts.length > 1 ? parts[parts.length - 1] : clean;
}

// ── Service categorisation ─────────────────────────────────
// The visit's service field wins; "Other" (or anything unknown) is read from the notes.
export function categorizeService(service = "", notes = "") {
  const s = String(service || "").toLowerCase();
  const n = String(notes || "").toLowerCase();
  // Contract mowing billed as a monthly fee (e.g. condo associations)
  if (/monthly (service|fee|invoice)|service charge|mowing invoice/.test(n) && !/treat|weed/.test(n)) return "Mowing";
  if (/mow/.test(s)) return "Mowing";
  // Weed work often gets logged under "Spring/Fall Cleanup"
  if (/clean/.test(s) && /weed|spray/.test(n) && !/clean|bed|leaf|leaves|brush|shrub/.test(n)) return "Weeding";
  if (/aerat|overseed|seeding/.test(s)) return "Aeration & Overseeding";
  if (/treat|fertil/.test(s)) return "Lawn Treatment";
  if (/mulch/.test(s)) return "Mulching";
  if (/hedge|tree|shrub|bush/.test(s)) return "Hedge & Tree Trimming";
  if (/clean|leaf|leaves/.test(s)) return "Cleanups";
  if (/weed/.test(s)) return "Weeding";
  if (/snow/.test(s)) return "Snow Removal";
  if (/landscap|hardscape|install|paver/.test(s)) return "Landscaping";

  const t = String(notes || "").toLowerCase();
  if (/aerat|overseed/.test(t)) return "Aeration & Overseeding";
  if (/retaining|paver|gravel|hardscape|install|landscap|rock|pump|railroad|edging install/.test(t)) return "Landscaping";
  if (/mulch/.test(t)) return "Mulching";
  if (/treat|fertil|blanket|spot|pre-?emergent|quinclorac|step \d|\d+-\d+-\d+|conditioner|grub/.test(t)) return "Lawn Treatment";
  if (/hedge|tree|bradford|shrub|bush/.test(t)) return "Hedge & Tree Trimming";
  if (/clean|leaf|leaves/.test(t)) return "Cleanups";
  if (/mow|trimming ?& ?edging|edging/.test(t)) return "Mowing";
  if (/weed/.test(t)) return "Weeding";
  if (/monthly (service|fee)|service charge|monthly fee|plan/.test(t)) return "Service Plans";
  if (/snow/.test(t)) return "Snow Removal";
  return "Other";
}

// ── Monthly P&L ─────────────────────────────────────────────
export function monthlyFinancials({ visits = [], expenses = [], year }) {
  const rows = MONTHS.map((m, i) => ({ month: m, index: i, revenue: 0, expenses: 0, net: 0, jobs: 0 }));
  for (const v of visits) {
    if (v.status !== "completed" || yearOf(v.date) !== year) continue;
    const r = rows[monthOf(v.date)];
    if (!r) continue;
    r.revenue += num(v.amount);
    r.jobs += 1;
  }
  for (const e of expenses) {
    if (yearOf(e.date) !== year) continue;
    const r = rows[monthOf(e.date)];
    if (r) r.expenses += num(e.amount);
  }
  for (const r of rows) {
    r.net = r.revenue - r.expenses;
    r.margin = r.revenue > 0 ? r.net / r.revenue : null;
  }
  return rows;
}

// Months worth drawing: first month with activity through the later of
// the last active month and the current month (for the current year).
export function activeMonthRange(rows, year) {
  const active = rows.filter((r) => r.revenue || r.expenses).map((r) => r.index);
  const now = new Date();
  if (!active.length) return year === now.getFullYear() ? rows.slice(0, now.getMonth() + 1) : rows;
  let lo = Math.min(...active);
  let hi = Math.max(...active);
  if (year === now.getFullYear()) hi = Math.max(hi, now.getMonth());
  return rows.slice(lo, hi + 1);
}

// ── Time estimation ────────────────────────────────────────
// Average logged minutes for this customer + service category, then for the
// category overall. Used only to fill gaps; always labelled as an estimate.
function buildTimeEstimator(visits) {
  const byCustCat = new Map();
  const byCat = new Map();
  const add = (map, key, mins) => {
    const cur = map.get(key) || { total: 0, n: 0 };
    cur.total += mins; cur.n += 1;
    map.set(key, cur);
  };
  for (const v of visits) {
    if (v.status !== "completed" || !num(v.duration_minutes)) continue;
    const cat = categorizeService(v.service, v.notes);
    add(byCustCat, `${v.customer_id}|${cat}`, num(v.duration_minutes));
    add(byCat, cat, num(v.duration_minutes));
  }
  return (customerId, cat) => {
    const c = byCustCat.get(`${customerId}|${cat}`);
    if (c && c.n >= 1) return { minutes: Math.round(c.total / c.n), basis: `this customer's avg of ${c.n} logged visit${c.n === 1 ? "" : "s"}`, n: c.n };
    const g = byCat.get(cat);
    if (g && g.n >= 2) return { minutes: Math.round(g.total / g.n), basis: `${cat} avg of ${g.n} logged jobs`, n: g.n };
    return null;
  };
}

// ── Main job-costing build ─────────────────────────────────
export function buildJobCosting({
  visits = [],
  expenses = [],
  allocations = [],
  customers = [],
  settings = {},
  year,
}) {
  const s = { ...DEFAULT_COSTING_SETTINGS, ...(settings || {}) };
  const custById = new Map(customers.map((c) => [c.id, c]));
  const expById = new Map(expenses.map((e) => [e.id, e]));

  const allocByVisit = new Map();
  const allocatedByExpense = new Map();
  for (const a of allocations) {
    const e = expById.get(a.expense_id);
    if (!e) continue;
    if (!allocByVisit.has(a.visit_id)) allocByVisit.set(a.visit_id, []);
    allocByVisit.get(a.visit_id).push({ ...a, expense: e });
    allocatedByExpense.set(a.expense_id, (allocatedByExpense.get(a.expense_id) || 0) + num(a.amount));
  }

  const estimate = buildTimeEstimator(visits);
  const yearVisits = visits.filter((v) => v.status === "completed" && yearOf(v.date) === year);

  // First pass: revenue, time, direct costs
  const jobs = yearVisits.map((v) => {
    const cust = custById.get(v.customer_id) || {};
    const name = cust.name || v.customers?.name || "Unknown";
    const category = categorizeService(v.service, v.notes);
    const crew = Math.max(1, num(v.crew_size) || 1);

    let minutes = num(v.duration_minutes) || null;
    let timeSource = minutes ? "logged" : null;
    let timeBasis = null;
    if (!minutes) {
      const est = estimate(v.customer_id, category);
      if (est) { minutes = est.minutes; timeSource = "estimate"; timeBasis = est.basis; }
    }
    const crewHours = minutes ? minutes / 60 : 0;
    const personHours = crewHours * crew;

    const costItems = (allocByVisit.get(v.id) || []).map((a) => ({
      allocationId: a.id,
      expenseId: a.expense_id,
      amount: num(a.amount),
      category: a.expense.category,
      description: a.expense.description,
      date: a.expense.date,
      isLabor: LABOR_CATEGORIES.includes(a.expense.category),
      split: num(a.amount) < num(a.expense.amount) - 0.005,
    }));
    const laborActual = costItems.filter((c) => c.isLabor).reduce((t, c) => t + c.amount, 0);
    const directCosts = costItems.filter((c) => !c.isLabor).reduce((t, c) => t + c.amount, 0);

    let laborCost = 0;
    let laborSource = null;
    if (laborActual > 0) { laborCost = laborActual; laborSource = "actual"; }
    else if (personHours > 0) { laborCost = personHours * s.laborRate; laborSource = timeSource === "logged" ? "rate" : "rate-estimate"; }

    return {
      id: v.id,
      visit: v,
      date: v.date,
      month: monthOf(v.date),
      customerId: v.customer_id,
      customerName: name,
      label: jobLabelName(name),
      source: cust.source || "Unknown",
      category,
      service: v.service,
      notes: v.notes || "",
      revenue: num(v.amount),
      minutes,
      timeSource,
      timeBasis,
      crew,
      crewHours,
      personHours,
      costItems,
      directCosts,
      laborActual,
      laborCost,
      laborSource,
    };
  });

  // Overhead pool: everything that isn't a job cost, minus anything allocated to jobs
  const yearExpenses = expenses.filter((e) => yearOf(e.date) === year);
  let overheadPool = 0;
  const unassigned = [];
  for (const e of yearExpenses) {
    const remaining = num(e.amount) - (allocatedByExpense.get(e.id) || 0);
    if (remaining <= 0.005) continue;
    const isDirect = DIRECT_COST_CATEGORIES.includes(e.category) && !e.is_overhead;
    if (isDirect) unassigned.push({ ...e, remaining, allocated: allocatedByExpense.get(e.id) || 0 });
    else overheadPool += remaining;
  }
  const totalCrewHours = jobs.reduce((t, j) => t + j.crewHours, 0);
  const overheadRate = totalCrewHours > 0 ? overheadPool / totalCrewHours : 0;

  // Second pass: overhead share + totals
  for (const j of jobs) {
    j.overhead = s.includeOverhead ? j.crewHours * overheadRate : 0;
    j.totalCost = j.directCosts + j.laborCost + j.overhead;
    j.profit = j.revenue - j.totalCost;
    j.margin = j.revenue > 0 ? j.profit / j.revenue : null;
    j.revPerPersonHour = j.personHours > 0 ? j.revenue / j.personHours : null;
    j.needsTime = j.timeSource !== "logged";
    // No time (logged or estimated) and no tagged expenses: the margin isn't meaningful yet
    j.incomplete = !j.timeSource && j.costItems.length === 0 && j.revenue > 0;
  }
  jobs.sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.id - a.id);

  return {
    settings: s,
    jobs,
    overheadPool,
    overheadRate,
    totalCrewHours,
    unassigned: unassigned.sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    totals: rollupJobs(jobs, s),
  };
}

// ── Rollups ────────────────────────────────────────────────
export function rollupJobs(jobs, settings = DEFAULT_COSTING_SETTINGS) {
  const r = {
    jobs: jobs.length, revenue: 0, directCosts: 0, laborCost: 0, overhead: 0, totalCost: 0, profit: 0,
    loggedJobs: 0, timedJobs: 0, incompleteJobs: 0, personHoursTimed: 0, revenueTimed: 0, loggedPersonHours: 0, customers: new Set(),
  };
  for (const j of jobs) {
    r.revenue += j.revenue;
    r.directCosts += j.directCosts;
    r.laborCost += j.laborCost;
    r.overhead += j.overhead || 0;
    r.totalCost += j.totalCost || 0;
    r.profit += j.profit || 0;
    r.customers.add(j.customerId);
    if (j.incomplete) r.incompleteJobs += 1;
    if (j.timeSource === "logged") { r.loggedJobs += 1; r.loggedPersonHours += j.personHours; }
    if (j.personHours > 0) { r.timedJobs += 1; r.personHoursTimed += j.personHours; r.revenueTimed += j.revenue; }
  }
  r.customerCount = r.customers.size;
  delete r.customers;
  r.margin = r.revenue > 0 ? r.profit / r.revenue : null;
  r.avgTicket = r.jobs ? r.revenue / r.jobs : 0;
  r.revPerPersonHour = r.personHoursTimed > 0 ? r.revenueTimed / r.personHoursTimed : null;
  r.avgPersonHours = r.timedJobs ? r.personHoursTimed / r.timedJobs : null;
  r.timeCoverage = r.jobs ? r.loggedJobs / r.jobs : 0;
  // Price that would hit the target $/person-hour, based on typical time
  if (r.avgPersonHours && settings.targetHourly) {
    r.targetTicket = r.avgPersonHours * settings.targetHourly;
    r.priceGap = r.avgTicket > 0 ? r.targetTicket / r.avgTicket - 1 : null;
  } else {
    r.targetTicket = null;
    r.priceGap = null;
  }
  return r;
}

export function rollupBy(jobs, keyFn, settings) {
  const groups = new Map();
  for (const j of jobs) {
    const k = keyFn(j);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(j);
  }
  return [...groups.entries()]
    .map(([key, list]) => ({ key, ...rollupJobs(list, settings) }))
    .sort((a, b) => b.revenue - a.revenue);
}

// ── Smart matching of unassigned costs to jobs ─────────────
const MATERIAL_HINTS = [
  { re: /mulch|compost|soil|perennial|plant|flower/, cats: ["Mulching", "Landscaping"] },
  { re: /seed|fert|aerat|starter/, cats: ["Aeration & Overseeding", "Lawn Treatment"] },
  { re: /pre-?emergent|treat|spray|rm43|preen|insect|weed|herbicide|quinclorac/, cats: ["Lawn Treatment", "Weeding"] },
  { re: /paver|block|rock|gravel|stone|edging|railroad|tie|wall|screw|pvc|pipe|base/, cats: ["Landscaping"] },
];

function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 99;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

function nameMatches(description, customerName) {
  const words = String(description || "").toLowerCase().match(/[a-z]{3,}/g) || [];
  const tokens = String(customerName || "").toLowerCase().match(/[a-z]{3,}/g) || [];
  for (const t of tokens) {
    for (const w of words) {
      if (w === t) return true;
      if (t.length >= 6 && editDistance(w, t) <= 2) return true;
    }
  }
  return false;
}

// Returns up to `limit` jobs most likely to be the one this expense was for.
export function suggestJobsForExpense(expense, jobs, limit = 3) {
  const desc = String(expense.description || "").toLowerCase();
  const isLabor = LABOR_CATEGORIES.includes(expense.category);
  const hint = MATERIAL_HINTS.filter((h) => h.re.test(desc)).flatMap((h) => h.cats);
  const scored = [];
  for (const j of jobs) {
    const diff = dayNum(j.date) - dayNum(expense.date); // job after purchase is positive
    const named = nameMatches(desc, j.customerName);
    if (!named && (diff < -7 || diff > 21)) continue;
    let score = 0;
    if (named) score += 100;
    score += 20 - Math.min(20, Math.abs(diff));
    if (diff >= 0 && diff <= 7) score += 5;
    if (hint.includes(j.category)) score += 25;
    if (j.category !== "Mowing") score += isLabor ? 8 : 15;
    if (isLabor && diff === 0) score += 10;
    score += Math.min(15, j.revenue / 100);
    scored.push({ job: j, score, named, diff });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
