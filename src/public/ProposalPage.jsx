import { useEffect, useMemo, useState } from "react";
import * as db from "../lib/db";

// Public, no-login page a customer reaches from their proposal link:
// owenslawnandlandscapes.com/proposal/<token>
const GREEN = "#1a4a2e";
const money = (v) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "");
const FREQ = { weekly: "Weekly", biweekly: "Every 2 weeks", monthly: "Monthly" };
const paras = (t) => String(t || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
const lines = (t) => String(t || "").split("\n").map((x) => x.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);

export default function ProposalPage({ token }) {
  const preview = new URLSearchParams(window.location.search).has("preview");
  const [state, setState] = useState({ loading: true });
  const [selected, setSelected] = useState([]);
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [mode, setMode] = useState("approve"); // approve | decline
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showAbout, setShowAbout] = useState(false);

  const load = async () => {
    const data = await db.publicGetProposal(token, preview);
    if (!data) { setState({ loading: false, notFound: true }); return; }
    setState({ loading: false, data });
    if (Array.isArray(data.selection)) setSelected(data.selection);
  };
  useEffect(() => { load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { document.title = "Your proposal · Owen's Lawn & Landscape"; }, []);

  const d = state.data;
  const snap = d?.snapshot || {};
  const c = snap.content || {};
  const decided = d && (d.status === "approved" || d.status === "declined");
  const validDays = Number(snap.validDays || c.validDays) || 90;
  const validUntil = d ? new Date(new Date(d.issued_at).getTime() + validDays * 86400000) : null;
  const expired = validUntil && Date.now() > validUntil.getTime() && !decided;

  const allLines = snap.lines || [];
  const isIncluded = (l) => !l.optional || selected.includes(l.key);
  const totals = useMemo(() => {
    const inc = allLines.filter(isIncluded);
    const once = inc.filter((l) => !l.frequency || l.frequency === "once").reduce((t, l) => t + Number(l.price || 0), 0);
    const recurring = inc.filter((l) => l.frequency && l.frequency !== "once");
    return { once, recurringPerVisit: recurring.reduce((t, l) => t + Number(l.price || 0), 0), recurring };
  }, [allLines, selected]); // eslint-disable-line react-hooks/exhaustive-deps
  const deposit = totals.once > 2000 ? totals.once * 0.5 : 0;

  const toggle = (key) => { if (decided || expired) return; setSelected((s) => (s.includes(key) ? s.filter((x) => x !== key) : [...s, key])); };

  const submit = async () => {
    setError("");
    if (mode === "approve" && (name.trim().length < 2 || !agree)) { setError("Please type your full name and check the box to approve."); return; }
    if (mode === "decline" && !note.trim()) { setError("Please tell us what you'd like changed (or why you're declining)."); return; }
    setBusy(true);
    const res = await db.publicRespondProposal(token, mode, selected, name.trim(), note.trim());
    setBusy(false);
    if (!res?.ok) {
      const msg = { expired: "This proposal has expired. Please call or text us for an updated one.", already_approved: "This proposal was already approved.", already_declined: "A response was already submitted for this proposal.", name_required: "Please type your full name to approve." };
      setError(msg[res?.error] || "Something went wrong. Please try again, or call/text (317) 868-4699.");
      await load();
      return;
    }
    await load();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (state.loading) return <Shell><div className="py-24 text-center text-[#7a9488]">Loading your proposal…</div></Shell>;
  if (state.notFound) return (
    <Shell>
      <div className="max-w-md mx-auto text-center py-20 px-6">
        <h1 className="text-2xl font-extrabold text-[#111] mb-2">Proposal not found</h1>
        <p className="text-[#5a6e62]">This link may be incorrect or no longer active. Please call or text Owen at <a className="underline" href="tel:3178684699">(317) 868-4699</a>.</p>
      </div>
    </Shell>
  );

  return (
    <Shell phone={c.phone}>
      {preview && <div className="bg-amber-100 text-amber-900 text-sm text-center py-2 px-4 print:hidden">Preview mode. This is exactly what your customer sees. Responses here count, so don't approve while previewing.</div>}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5">
        {/* Header */}
        <div className="bg-white border border-[#e0d9cf] rounded-3xl p-6 sm:p-8">
          <div className="text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: GREEN }}>{snap.template === "commercial" ? "Commercial Proposal" : "Residential Proposal"} · {d.number}</div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111] mt-1">{snap.projectTitle || "Your Proposal"}</h1>
          <div className="grid sm:grid-cols-2 gap-4 mt-5 text-sm">
            <Info label="Prepared for" value={<>{snap.customer}<br />{snap.address}</>} />
            <Info label="Prepared by" value={<>{c.companyName || "Owen's Lawn & Landscape"}<br />{c.contactName}{c.phone ? ` · ${c.phone}` : ""}</>} />
            <Info label="Date issued" value={fmtDate(d.issued_at)} />
            <Info label="Valid until" value={fmtDate(validUntil)} />
          </div>
        </div>

        {/* Status banners */}
        {d.status === "approved" && (
          <div className="rounded-2xl p-5 text-white" style={{ background: GREEN }}>
            <div className="text-lg font-extrabold">✓ Approved. Thank you{d.approved_name ? `, ${d.approved_name.split(" ")[0]}` : ""}!</div>
            <div className="text-sm opacity-90 mt-1">Approved by {d.approved_name} on {fmtDate(d.approved_at)}. Owen has been notified and will reach out to schedule. {deposit ? `A 50% deposit of ${money(deposit)} is due to get on the schedule.` : ""}</div>
            <button onClick={() => window.print()} className="mt-3 text-sm font-bold bg-white/15 hover:bg-white/25 rounded-xl px-4 py-2 print:hidden">Print / save a copy</button>
          </div>
        )}
        {d.status === "declined" && (
          <div className="rounded-2xl p-5 bg-white border border-[#e0d9cf]">
            <div className="text-lg font-extrabold text-[#111]">Thanks for letting us know.</div>
            <div className="text-sm text-[#5a6e62] mt-1">Owen received your note and will follow up{d.customer_note ? `: "${d.customer_note}"` : "."}</div>
          </div>
        )}
        {expired && <div className="rounded-2xl p-5 bg-amber-50 border border-amber-200 text-amber-900 text-sm">This proposal expired on {fmtDate(validUntil)}. Call or text <a className="underline font-semibold" href="tel:3178684699">(317) 868-4699</a> and we'll send an updated one.</div>}

        {/* Pricing */}
        <Card title="Pricing">
          {snap.pricingIntro && <p className="text-sm text-[#5a6e62] italic mb-4">{snap.pricingIntro}</p>}
          <div className="divide-y divide-[#eee8df] border border-[#e0d9cf] rounded-2xl overflow-hidden">
            {allLines.map((l) => {
              const on = isIncluded(l);
              const recurring = l.frequency && l.frequency !== "once";
              return (
                <div key={l.key} className={`p-4 flex gap-3 ${l.optional ? (on ? "bg-[#f1f7f3]" : "bg-[#faf8f4]") : "bg-white"}`}>
                  {l.optional ? (
                    <button onClick={() => toggle(l.key)} disabled={decided || expired} aria-pressed={on}
                      className={`mt-0.5 w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center text-white text-sm font-black ${on ? "border-transparent" : "border-[#b8c4bc] bg-white"} ${decided || expired ? "opacity-70" : "cursor-pointer"}`}
                      style={on ? { background: GREEN } : {}}>{on ? "✓" : ""}</button>
                  ) : <div className="mt-0.5 w-6 h-6 shrink-0 rounded-md flex items-center justify-center text-sm" style={{ color: GREEN }}>●</div>}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[#111]">{l.description}{l.optional && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 rounded-full px-2 py-0.5 align-middle">Optional</span>}</div>
                    {l.proposalText && <div className="text-sm text-[#5a6e62] mt-0.5">{l.proposalText}</div>}
                    {recurring && <div className="text-xs text-[#7a9488] mt-1">{FREQ[l.frequency] || ""} · about {l.visits} visits per season{l.seasonPrice ? ` (≈ ${money(l.seasonPrice)})` : ""}</div>}
                    {l.optional && !decided && !expired && <button onClick={() => toggle(l.key)} className="text-xs font-semibold mt-1.5 underline" style={{ color: GREEN }}>{on ? "Remove this option" : "Add this option"}</button>}
                  </div>
                  <div className={`text-right font-extrabold whitespace-nowrap ${on ? "text-[#111]" : "text-[#9aa79f] line-through decoration-1"}`}>
                    {money(l.price)}{recurring && <div className="text-[11px] font-semibold text-[#7a9488] no-underline">per visit</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-2xl p-4 bg-[#f7f4ef] space-y-1.5">
            {totals.once > 0 && <div className="flex justify-between text-lg"><span className="font-bold text-[#111]">Total{totals.recurring.length ? " (one-time services)" : ""}</span><span className="font-extrabold" style={{ color: GREEN }}>{money(totals.once)}</span></div>}
            {totals.recurring.length > 0 && <div className="flex justify-between"><span className="font-semibold text-[#111]">Recurring service</span><span className="font-extrabold" style={{ color: GREEN }}>{money(totals.recurringPerVisit)} per visit</span></div>}
            {deposit > 0 && <div className="text-xs text-[#5a6e62] pt-1">A 50% deposit ({money(deposit)}) is due at approval; the balance is due at completion.</div>}
          </div>
        </Card>

        {/* Good to know */}
        <Card title="Good to Know">
          <ul className="space-y-2.5 text-sm text-[#333]">
            {snap.startText && <li className="flex gap-2"><Dot />{snap.startText}</li>}
            {snap.timeOnSite && <li className="flex gap-2"><Dot /><span><b>Total time on site:</b> {snap.timeOnSite}</span></li>}
            {snap.exclusions && <li className="flex gap-2"><Dot /><span><b>Services excluded:</b> {lines(snap.exclusions).join(" ")}</span></li>}
            {snap.warranty && <li className="flex gap-2"><Dot /><span><b>Warranty:</b> {snap.warranty}</span></li>}
            {(snap.notices || []).map((n, i) => <li key={i} className="flex gap-2"><Dot /><span className="text-[#444]">{n}</span></li>)}
          </ul>
          {snap.notes && <div className="mt-4 text-sm text-[#333] bg-[#f7f4ef] rounded-xl p-3 whitespace-pre-wrap">{snap.notes}</div>}
        </Card>

        {/* Commercial scope */}
        {allLines.some((l) => lines(l.workIncluded).length || l.acceptance) && (
          <Card title="Scope of Work">
            <div className="space-y-4">
              {allLines.filter((l) => lines(l.workIncluded).length || l.acceptance).map((l) => (
                <div key={l.key}>
                  <div className="font-bold text-[#111]">{l.description}</div>
                  <ul className="mt-1 space-y-1 text-sm text-[#333]">{lines(l.workIncluded).map((x, i) => <li key={i} className="flex gap-2"><Dot />{x}</li>)}</ul>
                  {l.acceptance && <div className="text-xs text-[#5a6e62] mt-1"><b>Complete when:</b> {l.acceptance}</div>}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Terms */}
        <Card title="Payment Terms">
          <div className="space-y-2 text-sm text-[#444]">
            {c.depositTerms && <p><b>Deposit:</b> {c.depositTerms}</p>}
            {allLines.some((l) => l.optional) && c.optionalTerms && <p><b>Optional items:</b> {c.optionalTerms.replace(/signed and dated/gi, "selected and approved").replace(/By signing and dating/gi, "By selecting")}</p>}
            {c.payableBy && <p><b>Payable by:</b> {c.payableBy}</p>}
          </div>
        </Card>

        {/* About */}
        <div className="bg-white border border-[#e0d9cf] rounded-3xl">
          <button onClick={() => setShowAbout((s) => !s)} className="w-full text-left px-6 py-5 flex items-center justify-between">
            <span className="text-lg font-extrabold text-[#111]">About Owen's Lawn & Landscape</span>
            <span className="text-[#7a9488] text-sm">{showAbout ? "Hide" : "Who we are & references"}</span>
          </button>
          {showAbout && (
            <div className="px-6 pb-6 space-y-4 text-sm text-[#333]">
              {paras(c.whoWeAre).map((p, i) => <p key={i}>{p}</p>)}
              <div className="grid sm:grid-cols-2 gap-3">
                {[c.reference1, snap.template === "commercial" ? c.commercialReference2 || c.reference2 : c.reference2].filter(Boolean).map((r, i) => (
                  <div key={i} className="bg-[#efede6] rounded-2xl p-4 text-[13px] italic text-[#555] space-y-2">{paras(r).map((p, j) => <p key={j}>{p}</p>)}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Respond */}
        {!decided && !expired && (
          <div className="bg-white border-2 rounded-3xl p-6 sm:p-8 print:hidden" style={{ borderColor: GREEN }}>
            <div className="flex gap-2 mb-5">
              <button onClick={() => setMode("approve")} className={`flex-1 rounded-xl py-2.5 text-sm font-bold border ${mode === "approve" ? "text-white border-transparent" : "text-[#5a6e62] border-[#e0d9cf]"}`} style={mode === "approve" ? { background: GREEN } : {}}>Approve</button>
              <button onClick={() => setMode("decline")} className={`flex-1 rounded-xl py-2.5 text-sm font-bold border ${mode === "decline" ? "bg-[#111] text-white border-transparent" : "text-[#5a6e62] border-[#e0d9cf]"}`}>Request changes / decline</button>
            </div>
            {mode === "approve" ? (
              <>
                <div className="text-sm text-[#5a6e62] mb-4">You're approving <b className="text-[#111]">{money(totals.once)}</b>{totals.recurring.length ? <> plus <b className="text-[#111]">{money(totals.recurringPerVisit)} per visit</b> for recurring service</> : null}{allLines.some((l) => l.optional) ? `, including ${allLines.filter((l) => l.optional && selected.includes(l.key)).length} optional item(s) you selected` : ""}.</div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#5a6e62] mb-1.5">Type your full name to sign</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="w-full rounded-xl border border-[#d5cec3] px-4 py-3 text-base focus:outline-none focus:border-[#1a4a2e]" style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive", fontSize: name ? 22 : 16 }} />
                <label className="flex items-start gap-3 mt-4 text-sm text-[#333] cursor-pointer">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 w-4 h-4 accent-[#1a4a2e]" />
                  <span>I authorize Owen's Lawn & Landscape to perform the work above at the prices shown, and I agree to the payment terms.</span>
                </label>
              </>
            ) : (
              <>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#5a6e62] mb-1.5">What would you like changed?</label>
                <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Can you quote it without overseeding? / We've decided to wait until spring." className="w-full rounded-xl border border-[#d5cec3] px-4 py-3 text-sm focus:outline-none focus:border-[#1a4a2e]" />
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" className="w-full rounded-xl border border-[#d5cec3] px-4 py-3 text-sm mt-3 focus:outline-none focus:border-[#1a4a2e]" />
              </>
            )}
            {error && <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{error}</div>}
            <button disabled={busy} onClick={submit} className="w-full mt-5 rounded-2xl py-4 text-white text-base font-extrabold disabled:opacity-50" style={{ background: mode === "approve" ? GREEN : "#111" }}>
              {busy ? "Sending…" : mode === "approve" ? `Approve ${money(totals.once)}${totals.recurring.length ? ` + ${money(totals.recurringPerVisit)}/visit` : ""}` : "Send to Owen"}
            </button>
            <p className="text-[11px] text-[#7a9488] text-center mt-3">Questions first? Call or text <a className="underline" href="tel:3178684699">(317) 868-4699</a>.</p>
          </div>
        )}
      </div>
    </Shell>
  );
}

const Dot = () => <span className="mt-2 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: GREEN }} />;
const Info = ({ label, value }) => (
  <div><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7a9488]">{label}</div><div className="text-[#333] mt-0.5">{value}</div></div>
);
const Card = ({ title, children }) => (
  <div className="bg-white border border-[#e0d9cf] rounded-3xl p-6 sm:p-8">
    <h2 className="text-lg font-extrabold text-[#111] mb-4 pb-2 border-b-2" style={{ borderColor: GREEN }}>{title}</h2>
    {children}
  </div>
);
function Shell({ children, phone }) {
  return (
    <div className="min-h-screen" style={{ background: "#f7f4ef", fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif" }}>
      <header className="bg-white border-b border-[#e0d9cf] print:border-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <a href="/"><img src="/brand/oll-logo.webp" alt="Owen's Lawn & Landscape" className="h-12 w-auto" /></a>
          <a href="tel:3178684699" className="text-sm font-semibold print:hidden" style={{ color: GREEN }}>{phone || "(317) 868-4699"}</a>
        </div>
      </header>
      {children}
      <footer className="text-center text-xs text-[#7a9488] py-8 print:hidden">Owen's Lawn & Landscape · Bargersville, IN · <a href="/" className="underline">owenslawnandlandscapes.com</a></footer>
    </div>
  );
}
