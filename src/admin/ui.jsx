import { useEffect } from "react";
import { fmtPct, marginTone } from "../lib/profitability";

// ── Small UI pieces (match the admin portal's dark stone/emerald style) ──
export const TONES = {
  green: "bg-emerald-900/50 text-emerald-300 border border-emerald-700/50",
  yellow: "bg-amber-900/50 text-amber-300 border border-amber-700/50",
  red: "bg-red-900/50 text-red-300 border border-red-700/50",
  blue: "bg-blue-900/50 text-blue-300 border border-blue-700/50",
  gray: "bg-stone-800 text-stone-400 border border-stone-700",
};
export const Pill = ({ tone = "gray", children, className = "" }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${TONES[tone]} ${className}`}>{children}</span>
);
export const Panel = ({ children, className = "" }) => (
  <div className={`bg-stone-900 border border-stone-800 rounded-2xl p-4 md:p-5 min-w-0 ${className}`}>{children}</div>
);
export const Tile = ({ label, value, sub, tone = "text-emerald-400" }) => (
  <Panel>
    <p className="text-stone-500 text-[11px] font-semibold uppercase tracking-wider">{label}</p>
    <p className={`text-2xl md:text-[26px] font-black mt-1 ${tone}`}>{value}</p>
    {sub && <p className="text-stone-500 text-xs mt-1 leading-snug">{sub}</p>}
  </Panel>
);
export const inputCls = "bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-200 focus:outline-none focus:border-emerald-600";
export const btn = "px-3 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40";
export const btnPrimary = `${btn} bg-emerald-700 hover:bg-emerald-600 text-white`;
export const btnGhost = `${btn} bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700`;

export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 p-0 md:p-6" onClick={onClose}>
      <div className={`bg-stone-900 border border-stone-700 w-full ${wide ? "md:max-w-3xl" : "md:max-w-xl"} max-h-[92vh] overflow-y-auto rounded-t-2xl md:rounded-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-stone-900 border-b border-stone-800 px-5 py-4 flex items-center justify-between z-10">
          <h3 className="font-bold text-stone-100">{title}</h3>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-200 text-xl leading-none px-2" aria-label="Close">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}


// Margin badge that admits when a job has no costs recorded yet
export function MarginPill({ job }) {
  if (job.incomplete) return <span title="No time logged and no expenses tagged yet, so this job shows as 100% profit" className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${TONES.gray}`}>No costs yet</span>;
  return <Pill tone={marginTone(job.margin)}>{fmtPct(job.margin)}</Pill>;
}
