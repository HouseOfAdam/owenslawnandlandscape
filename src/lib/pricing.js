// ============================================================
// RULES-BASED ESTIMATING ENGINE (no AI)
// All rates live in the admin's Pricing Settings (app_settings key "pricing").
// ============================================================

export const UNITS = {
  per_1000_sqft: { label: "per 1,000 sq ft", qtyLabel: "sq ft", toUnits: (q) => q / 1000, unitWord: "1,000 sq ft" },
  per_cu_yd: { label: "per cubic yard", qtyLabel: "cu yd", toUnits: (q) => q, unitWord: "cu yd" },
  per_item: { label: "per item", qtyLabel: "items", toUnits: (q) => q, unitWord: "item" },
  per_hour: { label: "per person-hour", qtyLabel: "person-hours", toUnits: (q) => q, unitWord: "person-hour" },
  flat: { label: "flat price", qtyLabel: "", toUnits: () => 1, unitWord: "job" },
};

export const FREQUENCIES = [
  { id: "once", label: "One-time" },
  { id: "weekly", label: "Weekly" },
  { id: "biweekly", label: "Every 2 weeks" },
  { id: "monthly", label: "Monthly" },
];

export const DEFAULT_PRICING = {
  version: 1,
  season: { weekly: 30, biweekly: 15, monthly: 7, months: 8 },
  customLaborRate: 65,     // $ per person-hour charged on custom/landscape work
  materialsMarkup: 25,     // % added to material cost on custom work
  mulchDepthIn: 2,
  terms: "This estimate is valid for 30 days. Final pricing may change if the scope or property conditions differ from what's described above. Recurring services are billed per visit; season totals are estimates based on a typical season and weather. Invoices are due upon receipt. Payment accepted by Venmo, check, or cash.",
  modifiers: [
    { id: "slope", label: "Slopes / hills", pct: 10 },
    { id: "obstacles", label: "Lots of beds / obstacles", pct: 10 },
    { id: "overgrown", label: "Overgrown / first cut", pct: 25 },
    { id: "access", label: "Tight gate / hard access", pct: 5 },
  ],
  services: [
    { id: "mowing", name: "Mow, trim, edge & blow", category: "Mowing", unit: "per_1000_sqft", qtySource: "lawn", base: 20, price: 3.25, min: 35, production: 10000 / 1000, setupMin: 8, materialCost: 0, defaultFreq: "weekly", usesModifiers: true },
    { id: "aeration", name: "Core aeration (double pass)", category: "Aeration & Overseeding", unit: "per_1000_sqft", qtySource: "lawn", base: 50, price: 8, min: 125, production: 15, setupMin: 15, materialCost: 0, defaultFreq: "once", usesModifiers: true },
    { id: "overseed", name: "Overseeding", category: "Aeration & Overseeding", unit: "per_1000_sqft", qtySource: "lawn", base: 0, price: 6, min: 75, production: 20, setupMin: 5, materialCost: 2.5, defaultFreq: "once", usesModifiers: false },
    { id: "fert", name: "Fertilizer & weed control", category: "Lawn Treatment", unit: "per_1000_sqft", qtySource: "lawn", base: 15, price: 4, min: 45, production: 20, setupMin: 5, materialCost: 1.5, defaultFreq: "monthly", usesModifiers: false },
    { id: "mulch", name: "Mulch installed", category: "Mulching", unit: "per_cu_yd", qtySource: "beds", base: 0, price: 85, min: 150, production: 1, setupMin: 15, materialCost: 38, defaultFreq: "once", usesModifiers: false },
    { id: "shrubs", name: "Shrub & hedge trimming", category: "Hedge & Tree Trimming", unit: "per_item", qtySource: "manual", itemLabel: "shrubs", base: 0, price: 8, min: 75, production: 10, setupMin: 10, materialCost: 0, defaultFreq: "once", usesModifiers: false },
    { id: "cleanup", name: "Spring / fall cleanup", category: "Cleanups", unit: "per_hour", qtySource: "manual", base: 0, price: 55, min: 150, production: 1, setupMin: 0, materialCost: 0, defaultFreq: "once", usesModifiers: false },
    { id: "weeding", name: "Bed weeding", category: "Weeding", unit: "per_hour", qtySource: "manual", base: 0, price: 45, min: 50, production: 1, setupMin: 0, materialCost: 0, defaultFreq: "once", usesModifiers: false },
  ],
};

export function mergePricing(saved) {
  if (!saved || typeof saved !== "object") return structuredClone(DEFAULT_PRICING);
  return {
    ...structuredClone(DEFAULT_PRICING),
    ...saved,
    season: { ...DEFAULT_PRICING.season, ...(saved.season || {}) },
    modifiers: Array.isArray(saved.modifiers) ? saved.modifiers : structuredClone(DEFAULT_PRICING.modifiers),
    services: Array.isArray(saved.services) ? saved.services : structuredClone(DEFAULT_PRICING.services),
  };
}

export const visitsPerSeason = (freq, pricing) => (freq === "once" || !freq ? 1 : Number(pricing.season?.[freq]) || 1);
export const isRecurring = (freq) => freq && freq !== "once";
export const cuYards = (bedSqft, depthIn) => (Number(bedSqft) || 0) * ((Number(depthIn) || 0) / 12) / 27;

// Default quantity for a service from the property details
export function defaultQty(svc, property, pricing) {
  if (!svc) return 0;
  if (svc.qtySource === "lawn") return Number(property.lawnSqft) || 0;
  if (svc.qtySource === "beds") return Math.round(cuYards(property.bedSqft, property.mulchDepthIn ?? pricing.mulchDepthIn) * 10) / 10;
  if (svc.unit === "flat") return 1;
  return 0;
}

const r2 = (v) => Math.round(v * 100) / 100;

// Price + cost one estimate line.
// costing: { laborRate, overheadRate, includeOverhead } from job costing.
export function priceLine(line, pricing, property, costing) {
  const svc = pricing.services.find((s) => s.id === line.serviceId);
  const crew = Math.max(1, Number(line.crew) || 1);
  const modPct = (pricing.modifiers || []).filter((m) => (property.modifiers || []).includes(m.id)).reduce((t, m) => t + (Number(m.pct) || 0), 0);
  let price, personMin, materialCost, description, qtyText;

  if (line.custom || !svc) {
    const hours = Number(line.hours) || 0;
    const materials = Number(line.materials) || 0;
    price = hours * (Number(pricing.customLaborRate) || 0) + materials * (1 + (Number(pricing.materialsMarkup) || 0) / 100);
    personMin = hours * 60;
    materialCost = materials;
    description = line.description || "Custom work";
    qtyText = hours ? `${hours} person-hr${materials ? ` + ${fmt$(materials)} materials` : ""}` : "";
  } else {
    const unit = UNITS[svc.unit] || UNITS.flat;
    const qty = Number(line.qty) || 0;
    const units = unit.toUnits(qty);
    const mod = svc.usesModifiers ? modPct : 0;
    const raw = (Number(svc.base) || 0) + units * (Number(svc.price) || 0);
    price = Math.max(Number(svc.min) || 0, raw * (1 + mod / 100));
    const workMin = svc.production > 0 ? (units / svc.production) * 60 : 0;
    personMin = (Number(svc.setupMin) || 0) + workMin * (1 + mod / 100);
    materialCost = units * (Number(svc.materialCost) || 0);
    description = line.description || svc.name;
    qtyText = svc.unit === "flat" ? "" : `${qty.toLocaleString()} ${svc.unit === "per_item" ? (svc.itemLabel || "items") : unit.qtyLabel}`;
  }

  const autoPrice = price;
  if (line.priceOverride !== undefined && line.priceOverride !== null && line.priceOverride !== "") price = Number(line.priceOverride) || 0;
  const discount = Number(line.discountPct) || 0;
  price = price * (1 - discount / 100);

  const personHours = personMin / 60;
  const crewHours = personHours / crew;
  const laborCost = personHours * (Number(costing?.laborRate) || 0);
  const overhead = costing?.includeOverhead ? crewHours * (Number(costing?.overheadRate) || 0) : 0;
  const cost = materialCost + laborCost + overhead;
  const freq = line.frequency || svc?.defaultFreq || "once";
  const visits = freq !== "once" && Number(line.visitsOverride) > 0 ? Number(line.visitsOverride) : visitsPerSeason(freq, pricing);
  if (line.detailsText !== undefined && line.detailsText !== null && line.detailsText !== "") qtyText = line.detailsText;

  return {
    ...line,
    svc,
    description,
    qtyText,
    frequency: freq,
    visits,
    autoPrice: r2(autoPrice),
    price: r2(price),
    seasonPrice: r2(price * visits),
    personMin: Math.round(personMin),
    crew,
    materialCost: r2(materialCost),
    laborCost: r2(laborCost),
    overhead: r2(overhead),
    cost: r2(cost),
    profit: r2(price - cost),
    margin: price > 0 ? (price - cost) / price : null,
    revPerPersonHour: personHours > 0 ? price / personHours : null,
    modPct: svc?.usesModifiers ? modPct : 0,
  };
}

export function priceEstimate(lines, pricing, property, costing) {
  const priced = lines.map((l) => priceLine(l, pricing, property, costing));
  const sum = (arr, k) => arr.reduce((t, x) => t + (x[k] || 0), 0);
  const recurring = priced.filter((l) => isRecurring(l.frequency));
  const once = priced.filter((l) => !isRecurring(l.frequency));
  const seasonRevenue = sum(priced, "seasonPrice");
  const seasonCost = priced.reduce((t, l) => t + l.cost * l.visits, 0);
  const seasonPersonMin = priced.reduce((t, l) => t + l.personMin * l.visits, 0);
  const recurringSeason = sum(recurring, "seasonPrice");
  return {
    lines: priced,
    oneTimeTotal: r2(sum(once, "price")),
    perVisitRecurring: r2(sum(recurring.filter((l) => l.frequency === "weekly" || l.frequency === "biweekly"), "price")),
    recurringSeason: r2(recurringSeason),
    monthlyEquivalent: r2(recurringSeason / (Number(pricing.season?.months) || 8)),
    seasonTotal: r2(seasonRevenue),
    seasonCost: r2(seasonCost),
    seasonProfit: r2(seasonRevenue - seasonCost),
    margin: seasonRevenue > 0 ? (seasonRevenue - seasonCost) / seasonRevenue : null,
    firstVisitMin: Math.round(sum(priced, "personMin")),
    seasonPersonHours: seasonPersonMin / 60,
    revPerPersonHour: seasonPersonMin > 0 ? seasonRevenue / (seasonPersonMin / 60) : null,
  };
}

function fmt$(v) { return `$${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`; }

// ── Learning from history ───────────────────────────────────
// Mowing speed (sq ft per person-hour) from customers whose lawn size is known
// and whose mowing visits have logged time.
export function calibrateMowing(customers, visits) {
  const sizeById = new Map(customers.filter((c) => Number(c.lawn_sqft) > 0).map((c) => [c.id, Number(c.lawn_sqft)]));
  const speeds = [];
  for (const v of visits) {
    if (v.status !== "completed" || !Number(v.duration_minutes) || !/mow/i.test(v.service || "")) continue;
    const size = sizeById.get(v.customer_id);
    if (!size) continue;
    const personHours = (Number(v.duration_minutes) / 60) * Math.max(1, Number(v.crew_size) || 1);
    if (personHours > 0) speeds.push(size / personHours);
  }
  if (speeds.length < 3) return { n: speeds.length, sqftPerHour: null };
  speeds.sort((a, b) => a - b);
  const median = speeds[Math.floor(speeds.length / 2)];
  return { n: speeds.length, sqftPerHour: Math.round(median), customers: new Set(visits.filter((v) => sizeById.has(v.customer_id)).map((v) => v.customer_id)).size };
}

// Win rate + accepted pricing per catalog service from saved estimates
export function estimateStats(estimates) {
  const stats = {};
  for (const e of estimates) {
    const lines = e.inputs?.lines || [];
    for (const l of lines) {
      const id = l.custom ? "custom" : l.serviceId;
      if (!id) continue;
      const s = (stats[id] ||= { sent: 0, accepted: 0, declined: 0, acceptedPrices: [] });
      if (e.status === "sent" || e.status === "accepted" || e.status === "declined") s.sent += 1;
      if (e.status === "accepted") { s.accepted += 1; if (l.unitPrice) s.acceptedPrices.push(l.unitPrice); }
      if (e.status === "declined") s.declined += 1;
    }
  }
  for (const s of Object.values(stats)) {
    const decided = s.accepted + s.declined;
    s.winRate = decided ? s.accepted / decided : null;
    s.avgAcceptedUnitPrice = s.acceptedPrices.length ? s.acceptedPrices.reduce((a, b) => a + b, 0) / s.acceptedPrices.length : null;
  }
  return stats;
}

// Plain-language nudges per service based on history
export function pricingAdvice(svc, history, stats, targetHourly) {
  const tips = [];
  if (history && history.revPerPersonHour && history.loggedJobs >= 3) {
    const gap = history.revPerPersonHour / targetHourly - 1;
    if (gap < -0.1) tips.push({ tone: "amber", text: `Your completed ${svc.category} jobs earn ${fmt$(Math.round(history.revPerPersonHour))}/person-hr, below your ${fmt$(targetHourly)} target. Consider raising rates about ${Math.round(-gap * 100)}%.` });
    else if (gap > 0.25) tips.push({ tone: "green", text: `Completed ${svc.category} jobs earn ${fmt$(Math.round(history.revPerPersonHour))}/person-hr, well above target.` });
    else tips.push({ tone: "gray", text: `Completed ${svc.category} jobs earn ${fmt$(Math.round(history.revPerPersonHour))}/person-hr (target ${fmt$(targetHourly)}).` });
  }
  if (stats && stats.accepted + stats.declined >= 5) {
    if (stats.winRate >= 0.85) tips.push({ tone: "amber", text: `You win ${Math.round(stats.winRate * 100)}% of ${svc.name.toLowerCase()} estimates. That often means room to charge more.` });
    else if (stats.winRate <= 0.3) tips.push({ tone: "amber", text: `Only ${Math.round(stats.winRate * 100)}% of ${svc.name.toLowerCase()} estimates are accepted. Pricing may be high for your area.` });
  }
  return tips;
}
