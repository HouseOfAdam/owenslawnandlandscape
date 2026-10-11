// ============================================================
// RULES-BASED ESTIMATING ENGINE (no AI)
// All rates live in the admin's Pricing Settings (app_settings key "pricing").
// Defaults come from the OLL Master Pricing Guide (Residential tier).
// ============================================================

export const UNITS = {
  per_1000_sqft: { label: "per 1,000 sq ft", qtyLabel: "sq ft", toUnits: (q) => q / 1000, unitWord: "1,000 sq ft" },
  per_sqft: { label: "per sq ft", qtyLabel: "sq ft", toUnits: (q) => q, unitWord: "sq ft" },
  per_cu_yd: { label: "per cubic yard", qtyLabel: "cu yd", toUnits: (q) => q, unitWord: "cu yd" },
  per_ft: { label: "per linear ft", qtyLabel: "linear ft", toUnits: (q) => q, unitWord: "ft" },
  per_inch: { label: "per inch (diameter)", qtyLabel: "inches", toUnits: (q) => q, unitWord: "inch" },
  per_item: { label: "per item", qtyLabel: "items", toUnits: (q) => q, unitWord: "item" },
  per_hour: { label: "per person-hour", qtyLabel: "hours", toUnits: (q) => q, unitWord: "hour" },
  material: { label: "material cost × multiplier", qtyLabel: "your material cost $", toUnits: (q) => q, unitWord: "$ of material" },
  flat: { label: "flat price", qtyLabel: "", toUnits: () => 1, unitWord: "job" },
};

export const FREQUENCIES = [
  { id: "once", label: "One-time" },
  { id: "weekly", label: "Weekly" },
  { id: "biweekly", label: "Every 2 weeks" },
  { id: "monthly", label: "Monthly" },
];

export const SERVICE_GROUPS = [
  "Mowing & Lawn", "Aeration, Seed & Fertilizer", "Mulching & Beds", "Rocking", "Spring & Fall Cleanup",
  "Drainage", "Hardscape & Walls", "Irrigation", "Sod", "Tree & Shrub", "Snow & Ice", "Landscape Lighting", "Power Washing", "Other",
];

// Small helper so the catalog below stays readable
const S = (id, group, name, category, unit, o = {}) => ({
  id, group, name, category, unit,
  mode: "rate", rate: 0, base: 0, includedUnits: 0, min: 0, minHours: 0, rateTier: "",
  materialCost: 0, materialMultiplier: 0, production: 0, setupMin: 0,
  defaultFreq: "once", usesModifiers: false,
  qtySource: unit === "per_1000_sqft" ? "lawn" : "manual",
  itemLabel: "", guide: "", proposalText: "", defaultOptional: false,
  ...o,
});

export const DEFAULT_PRICING = {
  version: 3,
  source: "OLL Master Pricing Guide — Residential",
  season: { weekly: 30, biweekly: 15, monthly: 7, months: 8 },
  laborTiers: {
    skilled: { label: "Skilled (hedges, hardscape, drainage, trees)", rate: 110, guide: "$100–$120/hr" },
    mid: { label: "Mid (landscaping, sod, sprinkler, boulder edging)", rate: 80, guide: "$70–$90/hr" },
    unskilled: { label: "Unskilled (cleanup, leaf/debris removal)", rate: 50, guide: "$40–$60/hr" },
    mowing: { label: "Mowing labor", rate: 80, guide: "$60–$100/hr" },
  },
  // Markup on your material cost for custom-job materials (by total material cost)
  materialMarkupTiers: [
    { upTo: 50, pct: 100 },
    { upTo: 1000, pct: 30 },
    { upTo: null, pct: 20 },
  ],
  mulchDepthIn: 2,
  terms: "This estimate is valid for 30 days. Final pricing may change if the scope or property conditions differ from what's described above. Recurring services are billed per visit; season totals are estimates based on a typical season and weather. Invoices are due upon receipt. Payment accepted by Venmo, check, or cash.",
  modifiers: [
    { id: "slope", label: "Slopes / hills", pct: 10 },
    { id: "obstacles", label: "Lots of beds / obstacles", pct: 10 },
    { id: "overgrown", label: "Overgrown / first cut", pct: 25 },
    { id: "access", label: "Tight gate / hard access", pct: 5 },
  ],
  services: [
    // Mowing & Lawn — labor $60–100/hr + $5 flat overhead, $45 minimum
    S("mowing", "Mowing & Lawn", "Lawn Mowing", "Mowing", "per_1000_sqft", { proposalText: "Mow, edge, trim, and blow front and back lawn.", mode: "time", rateTier: "mowing", base: 5, min: 45, production: 12, setupMin: 5, defaultFreq: "weekly", usesModifiers: true, guide: "Labor $60–$100/hr + $5 overhead · $45 minimum" }),

    // Aeration, Seed & Fertilizer
    S("aeration", "Aeration, Seed & Fertilizer", "Double Pass Core Aeration", "Aeration & Overseeding", "per_1000_sqft", { proposalText: "Double pass aeration throughout the entire yard. Aeration relieves soil compaction, allowing water, oxygen, and nutrients to reach the roots more effectively for a thicker, healthier lawn.", base: 120, includedUnits: 8, rate: 15, min: 120, production: 15, setupMin: 10, usesModifiers: true, guide: "$120 up to 8,000 sq ft + $15 each additional 1,000" }),
    S("seed", "Aeration, Seed & Fertilizer", "Overseeding", "Aeration & Overseeding", "per_1000_sqft", { proposalText: "High performance tall fescue seed (GT TF Maxx). Material and application.", defaultOptional: true, rate: 17, materialCost: 9, production: 20, setupMin: 5, guide: "$14–$20 per 1,000 sq ft (seed rule: material × 1.7–2.0)" }),
    S("starter", "Aeration, Seed & Fertilizer", "Starter Fertilizer Application", "Aeration & Overseeding", "per_1000_sqft", { proposalText: "10-20-8 granular starter fertilizer application.", defaultOptional: true, rate: 10, materialCost: 3.88, production: 25, setupMin: 5, guide: "$8–$12 per 1,000 sq ft (material × 2–3)" }),
    S("flagging", "Aeration, Seed & Fertilizer", "Flagging", "Aeration & Overseeding", "flat", { rate: 15, setupMin: 20, defaultOptional: true, proposalText: "Obstacle flagging for aeration provided by Owen’s Lawn & Landscape (takes place approximately 1 week before aeration; homeowner must be present).", guide: "$15 flat (from aeration template)" }),
    S("topdress", "Aeration, Seed & Fertilizer", "Topsoil topdress (¼\"–1\")", "Aeration & Overseeding", "per_cu_yd", { rate: 100, materialCost: 35, production: 1, setupMin: 10, guide: "$80–$120 per yard, material & laying" }),
    S("seed_mat", "Aeration, Seed & Fertilizer", "Seed — priced from material cost", "Aeration & Overseeding", "material", { materialMultiplier: 1.85, guide: "Material × 1.7–2.0" }),
    S("fert_mat", "Aeration, Seed & Fertilizer", "Starter fertilizer — priced from material cost", "Aeration & Overseeding", "material", { materialMultiplier: 2.5, guide: "Material × 2–3" }),

    // Mulching & Beds
    S("mulch_mat", "Mulching & Beds", "Mulch (material)", "Mulching", "material", { materialMultiplier: 1.3, guide: "Material × 1.3" }),
    S("mulch_lay", "Mulching & Beds", "Mulch Installation", "Mulching", "per_cu_yd", { proposalText: "Mulch spread evenly to a consistent depth in all beds, with clean, crisp bed edges.", qtySource: "beds", rate: 55, production: 1.5, setupMin: 10, guide: "$40–$70 per yard" }),
    S("weed_prev", "Mulching & Beds", "Weed prevention (Preen, spray, fabric)", "Mulching", "material", { materialMultiplier: 1.5, guide: "Material × 1.4–1.6" }),
    S("edging_mat", "Mulching & Beds", "Edging (material)", "Landscaping", "material", { materialMultiplier: 1.3, guide: "Material × 1.2–1.4" }),
    S("plants", "Mulching & Beds", "Plants + ½ bag compost each (material & install)", "Landscaping", "material", { materialMultiplier: 2, guide: "Material × 2 (rock beds: × 2–2.5)" }),
    S("bed_cleanout", "Mulching & Beds", "Bed cleanout (weeding, old mulch, sculpting)", "Weeding", "per_hour", { rateTier: "unskilled", production: 1, guide: "Unskilled labor rate" }),
    S("bed_prep", "Mulching & Beds", "Bed prep (sculpting, weed prevention, fabric)", "Landscaping", "per_hour", { rateTier: "mid", production: 1, guide: "Mid labor rate" }),
    S("plant_removal", "Mulching & Beds", "Plant removal (with root ball)", "Landscaping", "per_item", { rate: 40, itemLabel: "plants", production: 4, guide: "$10–$100 each — adjust per plant size" }),
    S("natural_edge", "Mulching & Beds", "Natural edging", "Landscaping", "per_ft", { rate: 1.75, production: 60, guide: "$1.00–$2.50 per ft" }),
    S("metal_edge", "Mulching & Beds", "Metal edging install (labor only)", "Landscaping", "per_ft", { rate: 2.5, production: 40, guide: "$2.00–$3.00 per ft + edging material × 1.2–1.4" }),
    S("paver_edge", "Mulching & Beds", "Paver landscape edging install", "Landscaping", "per_hour", { rateTier: "skilled", production: 1, guide: "Skilled labor rate" }),
    S("boulder_edge", "Mulching & Beds", "Boulder edging install", "Landscaping", "per_hour", { rateTier: "mid", production: 1, guide: "Mid labor rate" }),
    S("boulders", "Mulching & Beds", "Decorative accent boulders (material & install)", "Landscaping", "material", { materialMultiplier: 2, guide: "Material × 2" }),
    S("haul", "Mulching & Beds", "Haul away", "Landscaping", "per_item", { rate: 25, itemLabel: "loads", production: 2, guide: "$25 per load" }),

    // Rocking
    S("rock_mat", "Rocking", "Rock (material)", "Landscaping", "material", { materialMultiplier: 1.3, guide: "Material × 1.3" }),
    S("rock_lay", "Rocking", "Laying rock (labor)", "Landscaping", "per_cu_yd", { qtySource: "beds", rate: 100, production: 0.75, setupMin: 10, guide: "$80–$120 per yard" }),

    // Spring & Fall Cleanup
    S("leaf_cleanup", "Spring & Fall Cleanup", "Leaf & Debris Removal", "Cleanups", "per_hour", { proposalText: "Leaves and debris removed from lawn and beds and hauled away.", rateTier: "unskilled", min: 100, production: 1, guide: "$40–$60/hr · $100 minimum" }),
    S("annuals", "Spring & Fall Cleanup", "Annuals, compost & fertilization (material & install)", "Landscaping", "material", { materialMultiplier: 2.5, guide: "Material × 2–3" }),
    S("gutters", "Spring & Fall Cleanup", "Gutter cleaning", "Cleanups", "per_ft", { rate: 1.25, production: 100, setupMin: 10, guide: "$1.25 per linear ft" }),
    S("two_story", "Spring & Fall Cleanup", "Two-story / high-pitch roof (gutters)", "Cleanups", "flat", { rate: 50, setupMin: 20, guide: "$50 flat" }),

    // Drainage
    S("pipe_mat", "Drainage", "Pipe & fittings (material)", "Landscaping", "material", { materialMultiplier: 1.6, guide: "Material × 1.4–1.8" }),
    S("gravel_mat", "Drainage", "Gravel & topsoil (material)", "Landscaping", "material", { materialMultiplier: 1.2, guide: "Material × 1.2" }),
    S("trenching", "Drainage", "Trenching (haul off & labor)", "Landscaping", "per_cu_yd", { rate: 120, production: 0.5, guide: "$120 per yard" }),
    S("french_drain", "Drainage", "French drain install", "Landscaping", "per_ft", { rate: 20, production: 8, setupMin: 30, guide: "$20 per linear ft" }),
    S("downspout", "Drainage", "Downspout extension", "Landscaping", "per_ft", { rate: 16, production: 15, setupMin: 15, guide: "$16 per linear ft" }),
    S("regrading", "Drainage", "Regrading (material & install)", "Landscaping", "per_cu_yd", { rate: 90, materialCost: 30, production: 1, guide: "$90 per yard" }),
    S("reseed_mat", "Drainage", "Reseeding (material & install)", "Aeration & Overseeding", "material", { materialMultiplier: 2, guide: "Material × 2" }),

    // Hardscape & Walls
    S("paver_patio", "Hardscape & Walls", "Paver patio install (material & labor)", "Landscaping", "per_sqft", { rate: 21, materialCost: 8, production: 8, setupMin: 60, guide: "$18–$24 per sq ft" }),
    S("retaining_wall", "Hardscape & Walls", "Retaining wall, block (per sq ft of face)", "Landscaping", "per_sqft", { rate: 45, materialCost: 15, production: 4, setupMin: 60, guide: "$35–$55 per sq ft of face" }),
    S("walkway", "Hardscape & Walls", "Walkway install", "Landscaping", "per_sqft", { rate: 19, materialCost: 7, production: 10, setupMin: 45, guide: "$16–$22 per sq ft" }),
    S("fire_pit", "Hardscape & Walls", "Fire pit install (standard kit)", "Landscaping", "flat", { rate: 1350, materialCost: 650, setupMin: 480, guide: "$1,350 flat" }),

    // Irrigation
    S("irrigation_sub", "Irrigation", "Irrigation / sprinkler (subcontracted)", "Landscaping", "material", { materialMultiplier: 1.3, itemLabel: "sub's bid $", guide: "2nd-cheapest sub bid × 1.3" }),

    // Sod
    S("grading", "Sod", "Grading", "Landscaping", "per_hour", { rateTier: "mid", production: 1, guide: "Mid labor rate" }),
    S("sod_topsoil", "Sod", "Topsoil (material & install)", "Landscaping", "per_cu_yd", { rate: 100, materialCost: 35, production: 1, guide: "$80–$120 per yard" }),
    S("sod_mat", "Sod", "Sod (material)", "Landscaping", "material", { materialMultiplier: 1.35, guide: "Material × 1.2–1.5" }),
    S("sod_install", "Sod", "Sod install (labor)", "Landscaping", "per_sqft", { rate: 0.5, production: 250, setupMin: 20, guide: "$0.50 per sq ft" }),

    // Tree & Shrub
    S("hedge", "Tree & Shrub", "Hedge & Shrub Trimming", "Hedge & Tree Trimming", "per_hour", { proposalText: "Hand and power trimming of hedges and shrubs to a clean, natural shape; all clippings removed.", rateTier: "skilled", minHours: 1, production: 1, guide: "Skilled labor rate, 1 hr minimum" }),
    S("tree_trim", "Tree & Shrub", "Tree trimming (up to 20 ft)", "Hedge & Tree Trimming", "per_item", { rate: 250, itemLabel: "trees", production: 0.4, guide: "$150–$350 per tree" }),
    S("tree_removal", "Tree & Shrub", "Tree removal (up to 40 ft, no stump)", "Hedge & Tree Trimming", "per_item", { rate: 1000, itemLabel: "trees", production: 0.15, guide: "$600–$1,500 per tree" }),
    S("stump", "Tree & Shrub", "Stump grinding", "Hedge & Tree Trimming", "per_inch", { rate: 3.5, production: 15, setupMin: 20, guide: "$3.50 per inch of diameter" }),
    S("deep_root", "Tree & Shrub", "Plant health injection / deep root feed", "Lawn Treatment", "per_item", { rate: 50, materialCost: 10, itemLabel: "trees", production: 4, guide: "$50 per tree" }),

    // Snow & Ice
    S("plowing", "Snow & Ice", "Driveway plowing", "Snow Removal", "per_hour", { rate: 80, min: 40, production: 1, defaultFreq: "once", guide: "$80/hr · $40 minimum per push" }),
    S("shovel", "Snow & Ice", "Sidewalk shoveling", "Snow Removal", "per_ft", { rate: 0.25, production: 300, guide: "$0.25 per linear ft" }),
    S("ice_melt", "Snow & Ice", "Ice melt (material & application)", "Snow Removal", "material", { materialMultiplier: 2.1, guide: "Material × 2.1" }),

    // Landscape Lighting
    S("light_fixture", "Landscape Lighting", "Lighting fixture install (material & labor)", "Landscaping", "per_item", { rate: 95, materialCost: 40, itemLabel: "fixtures", production: 2, guide: "$95 per fixture" }),
    S("transformer", "Landscape Lighting", "Transformer & wiring setup", "Landscaping", "flat", { rate: 250, materialCost: 120, setupMin: 120, guide: "$250 flat" }),

    // Power Washing
    S("wash_flat", "Power Washing", "Power wash driveway / patio / walkway", "Other", "per_sqft", { rate: 0.22, production: 400, setupMin: 20, guide: "$0.22 per sq ft" }),
    S("wash_siding", "Power Washing", "Power wash house / siding", "Other", "per_sqft", { rate: 0.30, production: 300, setupMin: 20, guide: "$0.30 per sq ft" }),
  ],
};

export function mergePricing(saved) {
  const d = structuredClone(DEFAULT_PRICING);
  if (!saved || typeof saved !== "object") return d;
  return {
    ...d,
    ...saved,
    season: { ...d.season, ...(saved.season || {}) },
    laborTiers: { ...d.laborTiers, ...(saved.laborTiers || {}) },
    materialMarkupTiers: Array.isArray(saved.materialMarkupTiers) ? saved.materialMarkupTiers : d.materialMarkupTiers,
    modifiers: Array.isArray(saved.modifiers) ? saved.modifiers : d.modifiers,
    services: Array.isArray(saved.services) ? saved.services.map((s) => ({ ...S(s.id, s.group || "Other", s.name, s.category, s.unit), ...s })) : d.services,
  };
}

export const visitsPerSeason = (freq, pricing) => (freq === "once" || !freq ? 1 : Number(pricing.season?.[freq]) || 1);
export const isRecurring = (freq) => freq && freq !== "once";
export const cuYards = (bedSqft, depthIn) => (Number(bedSqft) || 0) * ((Number(depthIn) || 0) / 12) / 27;
export const tierRate = (pricing, tier) => Number(pricing.laborTiers?.[tier]?.rate) || 0;

// Tiered markup on material cost (e.g. 100% under $50, 30% to $1,000, 20% above)
export function materialMarkupPct(pricing, cost) {
  const tiers = pricing.materialMarkupTiers || [];
  for (const t of tiers) if (t.upTo === null || t.upTo === "" || t.upTo === undefined || cost < Number(t.upTo)) return Number(t.pct) || 0;
  return 0;
}

// The rate a service actually charges per unit (labor tiers override the typed rate)
export function effectiveRate(svc, pricing) {
  if (svc.rateTier && (svc.unit === "per_hour" || svc.mode === "time")) return tierRate(pricing, svc.rateTier);
  if (svc.unit === "material") return Number(svc.materialMultiplier) || 0;
  return Number(svc.rate) || 0;
}

// Default quantity for a service from the property details
export function defaultQty(svc, property, pricing) {
  if (!svc) return 0;
  if (svc.qtySource === "lawn") return Number(property.lawnSqft) || 0;
  if (svc.qtySource === "beds") return Math.round(cuYards(property.bedSqft, property.mulchDepthIn ?? pricing.mulchDepthIn) * 10) / 10;
  if (svc.unit === "flat") return 1;
  if (svc.unit === "per_hour" && Number(svc.minHours) > 0) return Number(svc.minHours);
  return 0;
}

const r2 = (v) => Math.round(v * 100) / 100;

// Price + cost one estimate line.
// costing: { laborRate, overheadRate, includeOverhead } from job costing.
export function priceLine(line, pricing, property, costing) {
  const svc = line.custom ? null : pricing.services.find((s) => s.id === line.serviceId);
  const crew = Math.max(1, Number(line.crew) || 1);
  const modPct = (pricing.modifiers || []).filter((m) => (property.modifiers || []).includes(m.id)).reduce((t, m) => t + (Number(m.pct) || 0), 0);
  let price, personMin, materialCost, description, qtyText;

  if (line.custom || !svc) {
    const hours = Number(line.hours) || 0;
    const materials = Number(line.materials) || 0;
    const tier = line.tier || "mid";
    const markup = line.markupPct !== undefined && line.markupPct !== null && line.markupPct !== "" ? Number(line.markupPct) : materialMarkupPct(pricing, materials);
    price = hours * tierRate(pricing, tier) + materials * (1 + markup / 100);
    personMin = hours * 60;
    materialCost = materials;
    description = line.description || "Custom work";
    qtyText = [hours ? `${hours} hr ${pricing.laborTiers?.[tier]?.label?.split(" (")[0]?.toLowerCase() || ""} labor` : "", materials ? `materials` : ""].filter(Boolean).join(" + ");
  } else {
    const unit = UNITS[svc.unit] || UNITS.flat;
    const qty = Number(line.qty) || 0;
    const units = unit.toUnits(qty);
    const mod = svc.usesModifiers ? modPct : 0;
    const rate = effectiveRate(svc, pricing);
    const workMin = svc.production > 0 ? (units / svc.production) * 60 : 0;
    const timeMin = (Number(svc.setupMin) || 0) + workMin;
    let raw;
    if (svc.unit === "material") {
      raw = qty * rate;                          // your material cost × multiplier
      materialCost = qty;
      personMin = Number(svc.setupMin) || 0;
    } else if (svc.mode === "time") {
      raw = (Number(svc.base) || 0) + (timeMin / 60) * rate; // e.g. mowing: hours × labor rate + overhead fee
      materialCost = units * (Number(svc.materialCost) || 0);
      personMin = timeMin;
    } else if (svc.unit === "flat") {
      raw = Number(svc.rate) || 0;
      materialCost = Number(svc.materialCost) || 0;
      personMin = timeMin;
    } else {
      const billable = Math.max(0, units - (Number(svc.includedUnits) || 0));
      raw = (Number(svc.base) || 0) + billable * rate + units * (Number(svc.materialCost) || 0) * (Number(svc.materialMultiplier) || 0);
      materialCost = units * (Number(svc.materialCost) || 0);
      personMin = svc.unit === "per_hour" ? units * 60 : timeMin;
    }
    const minimum = Math.max(Number(svc.min) || 0, (Number(svc.minHours) || 0) * (svc.unit === "per_hour" ? rate : 0));
    price = Math.max(minimum, raw * (1 + mod / 100));
    personMin = personMin * (1 + mod / 100);
    description = line.description || svc.name;
    const word = svc.unit === "per_item" ? (svc.itemLabel || "items") : unit.qtyLabel;
    qtyText = svc.unit === "flat" || svc.unit === "material" ? "" : `${Number(qty).toLocaleString()} ${word}`;
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
  const customDetail = line.detailsText !== undefined && line.detailsText !== null && line.detailsText !== "";
  const proposalText = customDetail ? line.detailsText : [svc?.proposalText, qtyText ? `(${qtyText})` : ""].filter(Boolean).join(" ");
  if (customDetail) qtyText = line.detailsText;

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
    optional: !!line.optional,
    proposalText,
  };
}

export function priceEstimate(lines, pricing, property, costing) {
  const all = lines.map((l) => priceLine(l, pricing, property, costing));
  // Optional lines are shown (customer signs to add them) but don't count toward totals
  const priced = all.filter((l) => !l.optional);
  const optionalTotal = all.filter((l) => l.optional).reduce((t, l) => t + l.seasonPrice, 0);
  const sum = (arr, k) => arr.reduce((t, x) => t + (x[k] || 0), 0);
  const recurring = priced.filter((l) => isRecurring(l.frequency));
  const once = priced.filter((l) => !isRecurring(l.frequency));
  const seasonRevenue = sum(priced, "seasonPrice");
  const seasonCost = priced.reduce((t, l) => t + l.cost * l.visits, 0);
  const seasonPersonMin = priced.reduce((t, l) => t + l.personMin * l.visits, 0);
  const recurringSeason = sum(recurring, "seasonPrice");
  return {
    lines: all,
    optionalTotal: r2(optionalTotal),
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
    const picked = Array.isArray(e.selection) ? e.selection : [];
    for (const l of lines) {
      const id = l.custom ? "custom" : l.serviceId;
      if (!id) continue;
      const s = (stats[id] ||= { sent: 0, accepted: 0, declined: 0, acceptedPrices: [] });
      if (e.status === "sent" || e.status === "approved" || e.status === "declined") s.sent += 1;
      // An optional item the customer left unchecked counts as declined for that service
      const won = e.status === "approved" && (!l.optional || picked.includes(l.key));
      if (won) { s.accepted += 1; if (l.unitPrice) s.acceptedPrices.push(l.unitPrice); }
      else if (e.status === "declined" || e.status === "approved") s.declined += 1;
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
