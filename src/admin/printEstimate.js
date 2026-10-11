// Branded, customer-facing estimate that opens in a new window for Print / Save as PDF.
// Internal fields (profit margin, competitive notes, AI advice) are intentionally left off.
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (v) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function printEstimate({ customer, service, frequency, area, basePrice, monthlyEstimate, annualEstimate, lineItems = [], date = new Date(), estimateNumber }) {
  const logo = `${window.location.origin}/brand/oll-logo.png`;
  const issued = new Date(date);
  const validUntil = new Date(issued.getTime() + 30 * 86400000);
  const fmtDate = (d) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const num = estimateNumber || `EST-${issued.getFullYear()}${String(issued.getMonth() + 1).padStart(2, "0")}${String(issued.getDate()).padStart(2, "0")}-${Math.floor(Math.random() * 900 + 100)}`;
  const recurring = frequency && !/one|once/i.test(frequency);
  const cap = (t) => String(t || "").replace(/\b\w/g, (c) => c.toUpperCase());
  service = cap(service); frequency = cap(frequency);
  const rows = lineItems.map((it) => `<tr><td>${esc(it.description)}</td><td class="amount">${Number(it.amount) > 0 ? money(it.amount) : "Included"}</td></tr>`).join("");

  const w = window.open("", "_blank", "width=820,height=1000");
  if (!w) { alert("Please allow pop-ups to print the estimate."); return; }
  w.document.write(`<!DOCTYPE html><html><head><title>Estimate ${esc(num)} · ${esc(customer || "")}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; padding-bottom: 20px; border-bottom: 2px solid #1a4a2e; }
    .brand-logo { height: 78px; width: auto; display: block; margin-bottom: 8px; }
    .brand p { font-size: 11px; color: #666; margin-top: 2px; }
    .doc { text-align: right; }
    .doc h2 { font-size: 26px; font-weight: 900; color: #1a4a2e; letter-spacing: 1px; }
    .doc p { font-size: 12px; color: #666; margin-top: 3px; }
    .for { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 28px; }
    .for h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #999; margin-bottom: 6px; font-weight: 700; }
    .for p { font-size: 13px; color: #333; line-height: 1.6; }
    .summary { display: flex; gap: 12px; margin-bottom: 26px; }
    .box { flex: 1; background: #f4f8f5; border: 1px solid #dbe8df; border-radius: 10px; padding: 14px; text-align: center; }
    .box .v { font-size: 22px; font-weight: 900; color: #1a4a2e; }
    .box .l { font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px; color: #6a7e72; margin-top: 4px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { text-align: left; padding: 10px 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #999; font-weight: 700; border-bottom: 2px solid #eee; }
    td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
    .amount { text-align: right; font-weight: 700; }
    .terms { margin-top: 22px; padding: 16px; background: #f9f8f6; border-radius: 8px; font-size: 12px; color: #555; line-height: 1.7; }
    .accept { margin-top: 34px; display: flex; gap: 40px; }
    .accept div { flex: 1; border-top: 1px solid #999; padding-top: 6px; font-size: 11px; color: #777; }
    .footer { margin-top: 30px; padding-top: 18px; border-top: 1px solid #eee; font-size: 11px; color: #999; text-align: center; }
    .bar { text-align: center; margin-top: 24px; }
    .bar button { background: #1a4a2e; color: white; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer; }
    @media print { body { padding: 20px; } .bar { display: none !important; } }
  </style></head><body>
    <div class="header">
      <div class="brand">
        <img src="${logo}" class="brand-logo" alt="Owen's Lawn &amp; Landscape" />
        <p>4729 N Banta Rd, Bargersville, IN 46106 · (317) 868-4699</p>
        <p>owen@owenslawnandlandscapes.com · owenslawnandlandscapes.com</p>
      </div>
      <div class="doc">
        <h2>ESTIMATE</h2>
        <p>${esc(num)}</p>
        <p>Date: ${fmtDate(issued)}</p>
        <p>Valid until: ${fmtDate(validUntil)}</p>
      </div>
    </div>
    <div class="for">
      <div><h3>Prepared for</h3><p><strong>${esc(customer || "Valued customer")}</strong></p></div>
      <div style="text-align:right"><h3>Service</h3><p>${esc(service || "")}${frequency ? ` · ${esc(frequency)}` : ""}${area ? `<br/>Property: ~${Number(area).toLocaleString()} sq ft` : ""}</p></div>
    </div>
    <div class="summary">
      <div class="box"><div class="v">${money(basePrice)}</div><div class="l">${recurring ? "Per visit" : "Project price"}</div></div>
      ${recurring && monthlyEstimate ? `<div class="box"><div class="v">${money(monthlyEstimate)}</div><div class="l">Est. monthly</div></div>` : ""}
      ${recurring && annualEstimate ? `<div class="box"><div class="v">${money(annualEstimate)}</div><div class="l">Est. season total</div></div>` : ""}
    </div>
    ${rows ? `<table><thead><tr><th>Description</th><th class="amount">Amount</th></tr></thead><tbody>${rows}</tbody></table>` : ""}
    <div class="terms">
      <strong>Terms.</strong> This estimate is valid for 30 days. Final pricing may change if the scope or property conditions differ from what's described above.
      Recurring services are billed per visit; invoices are due upon receipt. Payment accepted by Venmo, check, or cash.
    </div>
    <div class="accept"><div>Customer signature</div><div>Date</div></div>
    <div class="footer">Thank you for considering Owen's Lawn &amp; Landscape!</div>
    <div class="bar"><button onclick="window.print()">Print / Save as PDF</button></div>
  </body></html>`);
  w.document.close();
}

// Multi-service estimate from the rules-based estimator
const FREQ_LABEL = { once: "One-time", weekly: "Weekly", biweekly: "Every 2 weeks", monthly: "Monthly" };
export function printEstimateV2({ customer, address, lines = [], totals, notes, terms, date = new Date(), estimateNumber, property }) {
  const logo = `${window.location.origin}/brand/oll-logo.png`;
  const issued = new Date(date);
  const validUntil = new Date(issued.getTime() + 30 * 86400000);
  const fmtDate = (d) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const num = estimateNumber || `EST-DRAFT`;
  const anyRecurring = lines.some((l) => l.frequency && l.frequency !== "once");
  const rows = lines.map((l) => `<tr>
      <td><strong>${esc(l.description)}</strong>${l.qtyText ? `<div class="sub">${esc(l.qtyText)}</div>` : ""}</td>
      <td>${FREQ_LABEL[l.frequency] || "One-time"}${l.frequency && l.frequency !== "once" ? `<div class="sub">~${l.visits} visits / season</div>` : ""}</td>
      <td class="amount">${money(l.price)}${l.frequency && l.frequency !== "once" ? `<div class="sub">per visit</div>` : ""}</td>
      <td class="amount">${money(l.seasonPrice)}</td></tr>`).join("");
  const boxes = [
    totals.oneTimeTotal > 0 ? `<div class="box"><div class="v">${money(totals.oneTimeTotal)}</div><div class="l">One-time services</div></div>` : "",
    totals.perVisitRecurring > 0 ? `<div class="box"><div class="v">${money(totals.perVisitRecurring)}</div><div class="l">Per visit (recurring)</div></div>` : "",
    anyRecurring ? `<div class="box"><div class="v">${money(totals.seasonTotal)}</div><div class="l">Estimated season total</div></div>` : "",
  ].join("");
  const w = window.open("", "_blank", "width=820,height=1000");
  if (!w) { alert("Please allow pop-ups to print the estimate."); return; }
  w.document.write(`<!DOCTYPE html><html><head><title>Estimate ${esc(num)} · ${esc(customer || "")}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #1a4a2e; }
    .brand-logo { height: 78px; width: auto; display: block; margin-bottom: 8px; }
    .brand p { font-size: 11px; color: #666; margin-top: 2px; }
    .doc { text-align: right; }
    .doc h2 { font-size: 26px; font-weight: 900; color: #1a4a2e; letter-spacing: 1px; }
    .doc p { font-size: 12px; color: #666; margin-top: 3px; }
    .for { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
    .for h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #999; margin-bottom: 6px; font-weight: 700; }
    .for p { font-size: 13px; color: #333; line-height: 1.6; }
    .summary { display: flex; gap: 12px; margin-bottom: 24px; }
    .box { flex: 1; background: #f4f8f5; border: 1px solid #dbe8df; border-radius: 10px; padding: 14px; text-align: center; }
    .box .v { font-size: 22px; font-weight: 900; color: #1a4a2e; }
    .box .l { font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px; color: #6a7e72; margin-top: 4px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
    th { text-align: left; padding: 10px 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #999; font-weight: 700; border-bottom: 2px solid #eee; }
    td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    .sub { font-size: 11px; color: #888; margin-top: 2px; font-weight: 400; }
    .amount { text-align: right; font-weight: 700; }
    .total td { border-top: 2px solid #1a4a2e; font-weight: 800; font-size: 14px; color: #1a4a2e; }
    .notes { margin-top: 6px; padding: 14px 16px; border-left: 3px solid #1a4a2e; background: #f7faf8; font-size: 12.5px; color: #333; line-height: 1.6; white-space: pre-wrap; }
    .terms { margin-top: 18px; padding: 16px; background: #f9f8f6; border-radius: 8px; font-size: 12px; color: #555; line-height: 1.7; }
    .accept { margin-top: 34px; display: flex; gap: 40px; }
    .accept div { flex: 1; border-top: 1px solid #999; padding-top: 6px; font-size: 11px; color: #777; }
    .footer { margin-top: 30px; padding-top: 18px; border-top: 1px solid #eee; font-size: 11px; color: #999; text-align: center; }
    .bar { text-align: center; margin-top: 24px; }
    .bar button { background: #1a4a2e; color: white; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer; }
    @media print { body { padding: 20px; } .bar { display: none !important; } }
  </style></head><body>
    <div class="header">
      <div class="brand">
        <img src="${logo}" class="brand-logo" alt="Owen's Lawn &amp; Landscape" />
        <p>4729 N Banta Rd, Bargersville, IN 46106 · (317) 868-4699</p>
        <p>owen@owenslawnandlandscapes.com · owenslawnandlandscapes.com</p>
      </div>
      <div class="doc">
        <h2>ESTIMATE</h2>
        <p>${esc(num)}</p>
        <p>Date: ${fmtDate(issued)}</p>
        <p>Valid until: ${fmtDate(validUntil)}</p>
      </div>
    </div>
    <div class="for">
      <div><h3>Prepared for</h3><p><strong>${esc(customer || "Valued customer")}</strong>${address ? `<br/>${esc(address)}` : ""}</p></div>
      ${property?.lawnSqft ? `<div style="text-align:right"><h3>Property</h3><p>Lawn ~${Number(property.lawnSqft).toLocaleString()} sq ft${property.bedSqft ? `<br/>Beds ~${Number(property.bedSqft).toLocaleString()} sq ft` : ""}</p></div>` : ""}
    </div>
    <div class="summary">${boxes}</div>
    <table>
      <thead><tr><th>Service</th><th>Frequency</th><th class="amount">Price</th><th class="amount">Season total</th></tr></thead>
      <tbody>${rows}
        <tr class="total"><td colspan="3">Estimated total${anyRecurring ? " for the season" : ""}</td><td class="amount">${money(totals.seasonTotal)}</td></tr>
      </tbody>
    </table>
    ${notes ? `<div class="notes">${esc(notes)}</div>` : ""}
    <div class="terms">
      <strong>Terms.</strong> ${esc(terms || "")}
    </div>
    <div class="accept"><div>Customer signature</div><div>Date</div></div>
    <div class="footer">Thank you for considering Owen's Lawn &amp; Landscape!</div>
    <div class="bar"><button onclick="window.print()">Print / Save as PDF</button></div>
  </body></html>`);
  w.document.close();
}
