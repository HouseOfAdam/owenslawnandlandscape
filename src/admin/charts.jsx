import { useEffect, useRef, useState } from "react";
import { fmtCompact, fmtMoney, fmtPct } from "../lib/profitability";

export const CHART_COLORS = {
  revenue: "#34d399", // emerald-400
  expense: "#f87171", // red-400
  profit: "#fbbf24",  // amber-400
  grid: "#292524",    // stone-800
  axis: "#78716c",    // stone-500
  text: "#d6d3d1",    // stone-300
};

// Track an element's rendered width so SVG text stays crisp at any size
function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    setWidth(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

// Round the axis to friendly steps ($1k, $2.5k, $5k…) with 4 gridlines
function niceScale(v, ticks = 4) {
  if (v < 100) return { max: 100 * ticks, step: 100 };
  const raw = v / ticks;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((x) => x >= raw);
  return { max: step * ticks, step };
}

// ── Grouped monthly Revenue vs Expenses bars, every bar labelled ──
export function MonthlyRevExpChart({ rows, height = 300 }) {
  const [ref, width] = useWidth();
  const [active, setActive] = useState(null);
  const n = rows.length || 1;

  const padL = 44, padR = 8, padT = 26, padB = 50;
  const plotW = Math.max(0, width - padL - padR);
  const plotH = height - padT - padB;
  const gw = plotW / n;
  const narrow = gw < 72;
  const bw = Math.max(8, Math.min(34, gw * (narrow ? 0.3 : 0.32)));
  const { max: maxV, step } = niceScale(Math.max(1, ...rows.map((r) => Math.max(r.revenue, r.expenses))) * (narrow ? 1.18 : 1.08));
  const y = (v) => padT + plotH - (v / maxV) * plotH;
  const ticks = [0, 1, 2, 3, 4].map((t) => t * step);

  const a = active !== null ? rows[active] : null;

  return (
    <div ref={ref} className="relative w-full select-none" onMouseLeave={() => setActive(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Monthly revenue and expenses">
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke={CHART_COLORS.grid} strokeWidth="1" />
              <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill={CHART_COLORS.axis}>{fmtCompact(t)}</text>
            </g>
          ))}
          {rows.map((r, i) => {
            const cx = padL + gw * i + gw / 2;
            const rx = cx - bw - 1.5;
            const ex = cx + 1.5;
            const rh = Math.max(r.revenue > 0 ? 2 : 0, padT + plotH - y(r.revenue));
            const eh = Math.max(r.expenses > 0 ? 2 : 0, padT + plotH - y(r.expenses));
            const dim = active !== null && active !== i;
            const labelFor = (v, x, top, color) => {
              if (!v) return null;
              if (narrow) {
                const tx = x + bw / 2 + 3.5;
                return (
                  <text x={tx} y={top - 4} transform={`rotate(-90 ${tx} ${top - 4})`} fontSize="10" fontWeight="700" fill={color}>{fmtCompact(v)}</text>
                );
              }
              return <text x={x + bw / 2} y={top - 5} textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>{fmtCompact(v)}</text>;
            };
            return (
              <g key={r.month} opacity={dim ? 0.35 : 1} style={{ transition: "opacity 120ms" }}>
                <rect x={rx} y={padT + plotH - rh} width={bw} height={rh} rx="3" fill={CHART_COLORS.revenue} />
                <rect x={ex} y={padT + plotH - eh} width={bw} height={eh} rx="3" fill={CHART_COLORS.expense} />
                {labelFor(r.revenue, rx, padT + plotH - rh, CHART_COLORS.revenue)}
                {labelFor(r.expenses, ex, padT + plotH - eh, CHART_COLORS.expense)}
                <text x={cx} y={padT + plotH + 16} textAnchor="middle" fontSize="11" fontWeight="600" fill={CHART_COLORS.text}>{r.month}</text>
                {(r.revenue || r.expenses) ? (
                  <text x={cx} y={padT + plotH + 33} textAnchor="middle" fontSize={narrow ? 9.5 : 11} fontWeight="700" fill={r.net >= 0 ? CHART_COLORS.profit : CHART_COLORS.expense}>
                    {r.net >= 0 ? "+" : ""}{fmtCompact(r.net)}
                  </text>
                ) : null}
                <rect x={padL + gw * i} y={padT} width={gw} height={plotH + padB} fill="transparent"
                  onMouseEnter={() => setActive(i)} onClick={() => setActive(active === i ? null : i)} style={{ cursor: "pointer" }} />
              </g>
            );
          })}
          <line x1={padL} x2={width - padR} y1={padT + plotH} y2={padT + plotH} stroke={CHART_COLORS.axis} strokeWidth="1" />
        </svg>
      )}
      {a && (
        <div className="absolute top-0 right-0 bg-stone-950/95 border border-stone-700 rounded-xl px-3 py-2 text-xs shadow-xl pointer-events-none min-w-[170px]">
          <div className="font-bold text-stone-200 mb-1">{a.month}</div>
          <div className="flex justify-between gap-4"><span className="text-stone-400">Revenue</span><span className="font-bold" style={{ color: CHART_COLORS.revenue }}>{fmtMoney(a.revenue)}</span></div>
          <div className="flex justify-between gap-4"><span className="text-stone-400">Expenses</span><span className="font-bold" style={{ color: CHART_COLORS.expense }}>{fmtMoney(a.expenses)}</span></div>
          <div className="flex justify-between gap-4 border-t border-stone-800 mt-1 pt-1"><span className="text-stone-400">Net</span><span className="font-bold" style={{ color: a.net >= 0 ? CHART_COLORS.profit : CHART_COLORS.expense }}>{fmtMoney(a.net)}</span></div>
          <div className="flex justify-between gap-4"><span className="text-stone-400">Margin</span><span className="text-stone-200">{fmtPct(a.margin)}</span></div>
          <div className="flex justify-between gap-4"><span className="text-stone-400">Jobs done</span><span className="text-stone-200">{a.jobs}</span></div>
        </div>
      )}
    </div>
  );
}

export function ChartLegend({ items }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-400">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5">
          <span className="inline-block rounded-sm" style={{ width: 10, height: 10, background: it.color }} />
          {it.label}
        </div>
      ))}
    </div>
  );
}

// ── Horizontal bars: revenue with the profit share highlighted ──
export function ProfitBars({ rows, onSelect, valueKey = "revenue" }) {
  const max = Math.max(1, ...rows.map((r) => r[valueKey]));
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const w = (r[valueKey] / max) * 100;
        const pw = r.revenue > 0 ? Math.max(0, Math.min(1, r.profit / r.revenue)) * w : 0;
        return (
          <button key={r.key} type="button" onClick={onSelect ? () => onSelect(r.key) : undefined}
            className={`w-full text-left ${onSelect ? "hover:bg-stone-800/40 cursor-pointer" : "cursor-default"} rounded-lg -mx-1 px-1 py-0.5 transition-colors`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm mb-1">
              <span className="font-semibold text-stone-200 truncate">{r.key}{r.incompleteJobs > 0 && <span className="ml-1.5 text-[10px] font-normal text-amber-400/80" title="Jobs with no logged time and no linked costs count as pure profit until you add them">⚠ {r.incompleteJobs} missing costs</span>}</span>
              <span className="text-xs text-stone-400">
                <span className="text-stone-200 font-bold">{fmtMoney(r.revenue)}</span> rev · <span className="font-bold" style={{ color: r.profit >= 0 ? CHART_COLORS.profit : CHART_COLORS.expense }}>{fmtMoney(r.profit)}</span> profit · {fmtPct(r.margin)}
              </span>
            </div>
            <div className="relative h-2.5 bg-stone-800 rounded-full overflow-hidden">
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${w}%`, background: "#065f46" }} />
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pw}%`, background: CHART_COLORS.revenue }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
