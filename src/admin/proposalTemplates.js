// ============================================================
// PROPOSAL TEMPLATES — HTML recreations of Owen's Drive templates
// (Residential Proposal Template, Aeration Estimate Template,
//  Commercial_Landscape_Proposal_Template). Opens a print window.
// ============================================================

export const DEFAULT_PROPOSAL_CONTENT = {
  companyLegal: "Scheidler Enterprises LLC, DBA Owen’s Lawn and Landscapes",
  companyName: "Owen’s Lawn & Landscape",
  phone: "+1 (317) 868-4699",
  email: "owenlawnandlandscape09@gmail.com",
  website: "https://www.owenslawnandlandscapes.com/",
  address: "4729 N Banta Rd. Bargersville, IN 46106",
  contactName: "Owen Scheidler",
  contactTitle: "Co-Owner",
  validDays: 90,
  whoWeAre: [
    "Owen’s Lawn & Landscape is a family-owned and operated landscaping company proudly serving the Southside of Indianapolis, including Greenwood, Bargersville, Mooresville, Franklin, and surrounding communities.",
    "Now in our third season, we’ve grown to serve 50+ recurring clients by focusing on dependable service, quality craftsmanship, and treating every property as if it were our own.",
    "We offer a full range of residential outdoor services, including lawn mowing, landscaping, spring and fall cleanups, mulching, hedge trimming, and lawn treatments, with a specialization in hardscaping and drainage solutions.",
    "Owen’s Lawn & Landscape is licensed and insured, giving our customers confidence that their property is in capable hands. Whether it’s routine lawn care or a complete outdoor transformation, our goal is simple: do quality work, communicate clearly, and create outdoor spaces our customers are proud of.",
  ].join("\n\n"),
  reference1: "To Whom It May Concern,\n\nOwen's Lawn and Landscape cares for all our lawn and landscaping needs. We are the Fairways Condominiums in Greenwood, Indiana. There are 17 condos within 8 buildings in our community. We require weekly lawn service, hedge trimming, landscaping and snow removal. Owen and Company go above and beyond what is expected. Responsive to correction or additional requests, they are a cut above the rest. Whether it be planning and executing a landscaping idea or weeding an individual unit, they are up for the task. I hold Owen in high regard. He has proven to be a dependable and high quality individual. His company is run transparently with honesty and integrity. I highly recommend him for any project he may take on.\n\nBest Regards,\n\nKristi Zunis\n\nVice President, Fairways Homeowners' Association",
  reference2: "To Whom It May Concern,\n\nI have had the pleasure of working with Owen’s Lawn and Landscape on a number of projects at my property, including landscaping, hardscaping, lawn treatments, aeration, and overseeding. Owen and his team have consistently provided excellent results and have taken great pride in the quality of their work. Owen’s Lawn & Landscape have been dependable, knowledgeable, and attentive to detail. Their aeration, overseeding, and lawn treatment services have made a noticeable improvement to the property, and I have been very pleased with the results of every project they have completed.\n\nOwen is responsive, professional, and straightforward to work with. He stands behind his work and makes sure the job is completed properly. Based on my experience, I would confidently recommend Owen’s Lawn and Landscape to anyone looking for dependable, high-quality lawn care, landscaping, or hardscaping services.\n\nBest Wishes,\n\nRonnie Whittemore\n\nGreenwood, Indiana",
  commercialReference2: "This morning I called [my wife] Kathy over to the window to point out the quality of your work and emphasize its overall excellence. Laser precision transition line from grass to mulch, even distribution of mulch AND a trough dug to make it impossible for the mulch to drift into grass. It’s beautiful and I appreciate the consistency of your work. You do everything like you’re working on your own yard. That is really rare these days.\n\nDwaine",
  startDefault: "Work commences within thirty (30) days of contract execution and deposit receival, weather permitting, unless a later date is agreed upon by both parties.",
  servicesExcluded: "Any work or services not specifically outlined in this estimate are excluded unless additional compensation is agreed upon in writing by both parties prior to the work being performed.",
  depositTerms: "IF TOTAL exceeds $2000, an upfront payment of 50% will be required upon signing and acceptance of this contract, and the additional 50% will be due at completion of work and verbal satisfaction of customer during final walkthrough. IF TOTAL does not exceed $2000, no upfront payment will be required and payment will be due at completion of work and verbal satisfaction of customer during final walkthrough.",
  optionalTerms: "Any optional line item that is signed and dated by the customer shall be considered approved and authorized to proceed. By signing and dating an optional line item, the customer agrees to pay the stated price for that work. The cost of all approved optional line items will be added to the estimate total and reflected on the final invoice.",
  payableBy: "Cash • Check • Venmo • Apple Pay • Credit/Debit Card (5% fee applies)",
  aerationNotice: "AERATION FLAGGING NOTICE & CUSTOMER RESPONSIBILITY: If professional flagging is purchased through Owen’s Lawn and Landscape, all known obstacles will be flagged approximately one (1) week prior to the scheduled aeration service. If professional flagging is not purchased, the homeowner is responsible for clearly marking all obstacles that could be damaged during aeration, including but not limited to sprinkler heads, irrigation components, invisible dog fences, landscape lighting, utility lines, pavers, drains, and other buried or concealed objects. All required flags must be in place and clearly visible upon our arrival on the scheduled service date. If the property is not properly flagged, a charge equal to 50% of the estimated aeration total will apply, and the homeowner may reschedule the service if desired. Customers who elect to flag the property themselves assume responsibility for accurately locating and marking all obstacles. Owen’s Lawn and Landscape is not responsible for damage to any unmarked, improperly marked, or otherwise unidentified obstacles encountered during aeration.",
  singlePoint: "Owen’s Lawn & Landscape will serve as the primary contractor responsible for managing and coordinating all work outlined in this proposal, including any work performed by approved subcontractors. The Client will receive one contract, one invoice (excluding monthly maintenance charges), and one point of contact through Owen’s Lawn & Landscape for the duration of the project.",
  subcontractors: "Any subcontractors utilized for the project will be coordinated through Owen’s Lawn & Landscape. Unless otherwise agreed upon in writing, the Client should direct all project communications, requested changes, and payment matters through Owen’s Lawn & Landscape rather than directly through a subcontractor.",
  customerServiceNote: "Owen’s Lawn and Landscape goes above and beyond to put customer service at the forefront of our priorities. The company cell phone number, +1 (317) 868-4699, is Owen Scheidler's (our co-owner) personal cell phone. Call or text anytime, and we promise a speedy response.",
  clarificationsIntro: "The following clarifications, assumptions, and exclusions are provided to clearly define the scope of work and establish expectations before the project begins. Any conditions or requested work that fall outside the scope and assumptions outlined in this proposal may require additional approval and compensation before proceeding. These details are intentionally gathered now to avoid assumptions or questions in the field.",
  leaveItBetter: "Owen’s Lawn and Landscape operates under a simple yet effective philosophy: leave the area better than you found it. At the end of each work day, tools will be secured and either left on-site in an agreed-upon location or taken away, and surfaces will be blown off.",
};

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const paras = (t, cls = "") => String(t || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p class="${cls}">${esc(p).replace(/\n/g, "<br/>")}</p>`).join("");
const lines = (t) => String(t || "").split("\n").map((x) => x.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
const money = (v) => `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const FREQ = { weekly: "weekly", biweekly: "every 2 weeks", monthly: "monthly" };
const SIG = `<div class="sig">Signature: <span class="blank w60"></span> Date: <span class="blank w30"></span></div>`;

const baseCss = (green = "#1b4d3e") => `
  @import url('https://fonts.googleapis.com/css2?family=Carlito:ital,wght@0,400;0,700;1,400;1,700&display=swap');
  @page { size: letter; margin: 0.35in 0.75in 0.35in; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Calibri, Carlito, 'Segoe UI', Arial, sans-serif; color: #222; font-size: 10.5pt; line-height: 1.38; }
  /* Repeating page header/footer: fixed elements + spacer rows in a wrapping table */
  .runner-head { position: fixed; top: 0; right: 0; }
  .runner-head img { height: 0.42in; }
  .runner-foot { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 8pt; color: #6b6b6b; font-style: italic; }
  table.page { width: 100%; border-collapse: collapse; }
  table.page > thead > tr > td { height: 0.6in; padding: 0; }
  table.page > tfoot > tr > td { height: 0.45in; padding: 0; }
  table.page > tbody > tr > td { padding: 0; }
  .wrap { max-width: 7in; margin: 0 auto; }
  .logo { height: 1.35in; margin: 0 0 0.25in -0.08in; }
  .kicker { font-size: 8.5pt; font-weight: 700; letter-spacing: .06em; color: ${green}; text-transform: uppercase; }
  h1.title { font-size: 18pt; color: ${green}; font-weight: 700; margin: 2pt 0 12pt; }
  h2 { font-size: 13pt; color: ${green}; font-weight: 700; border-bottom: 1.2px solid ${green}; padding-bottom: 2pt; margin: 18pt 0 8pt; }
  h3 { font-size: 11pt; color: ${green}; font-weight: 700; margin: 12pt 0 4pt; }
  .info { display: grid; grid-template-columns: 1fr 1fr; gap: 10pt 24pt; margin: 6pt 0 6pt 0.45in; }
  .info .lbl { font-size: 7.5pt; font-weight: 700; letter-spacing: .05em; color: #444; text-transform: uppercase; }
  .info .val { font-size: 9pt; color: #6b6b6b; font-style: italic; }
  .info a { color: #1155cc; }
  p { margin: 0 0 7pt; }
  .indent p { text-indent: 0.3in; }
  .muted { color: #6b6b6b; }
  .refs { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #333; background: #efede6; }
  .refs > div { padding: 9pt 10pt; font-size: 9pt; color: #6b6b6b; font-style: italic; }
  .refs > div + div { border-left: 1px solid #333; }
  ul.gtk { margin: 4pt 0 0 18pt; }
  ul.gtk li { margin-bottom: 4pt; font-size: 9.5pt; color: #444; }
  ul.gtk li b { color: #333; }
  ul.gtk li .em { font-style: italic; color: #6b6b6b; }
  table.price { width: 100%; border-collapse: collapse; margin: 6pt 0 4pt; font-size: 9.5pt; }
  table.price th { background: ${green}; color: #fff; text-align: left; padding: 4pt 6pt; font-size: 8.5pt; letter-spacing: .03em; }
  table.price td { border: 1px solid #222; padding: 5pt 6pt; vertical-align: top; }
  table.price td.num { width: 0.3in; text-align: center; }
  table.price td.amt, table.price th.amt { width: 1.3in; color: #6b6b6b; font-style: italic; }
  table.price .desc { color: #6b6b6b; font-style: italic; }
  table.price .desc b { font-style: normal; color: #333; }
  table.price tr.total td { font-weight: 700; color: #222; font-style: normal; }
  .sig { margin-top: 3pt; font-style: normal; color: #333; font-size: 8.5pt; font-weight: 700; }
  .blank { display: inline-block; border-bottom: 1px solid #555; height: 9pt; vertical-align: bottom; }
  .w60 { width: 2.1in; } .w30 { width: 1.1in; }
  .terms { font-size: 9pt; color: #6b6b6b; font-style: italic; }
  .terms b { color: #333; font-style: italic; }
  .accept-line { display: flex; gap: 10pt; margin-top: 12pt; font-size: 9pt; color: #6b6b6b; font-style: italic; }
  .accept-line .fill { flex: 1; border-bottom: 1px dashed #888; }
  .pb { page-break-before: always; }
  .attach img { width: 100%; max-height: 8.4in; object-fit: contain; border: 1px solid #ddd; margin-top: 6pt; }
  .bar { position: fixed; top: 10px; right: 10px; z-index: 10; }
  .bar button { background: ${green}; color: #fff; border: 0; padding: 9px 18px; border-radius: 6px; font: 700 13px Arial; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.2); }
  @media screen { body { background: #e9e7e2; padding: 30px 0; } .sheet { background: #fff; width: 8.5in; margin: 0 auto; padding: 0.5in 0.75in; box-shadow: 0 2px 12px rgba(0,0,0,.12); } .runner-head, .runner-foot { display: none; } table.page > thead, table.page > tfoot { display: none; } }
  @media print { .bar { display: none; } .sheet { padding: 0; } }
`;

function openPrint(title, css, body) {
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) { alert("Please allow pop-ups to open the proposal."); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>${body}
    <div class="bar"><button onclick="window.print()">Print / Save as PDF</button></div></body></html>`);
  w.document.close();
}

const priceCell = (l) => {
  if (l.frequency && l.frequency !== "once") return `${money(l.price)} / visit<br/><span style="font-size:8pt">${FREQ[l.frequency] || ""} · ~${l.visits} visits${l.seasonPrice ? ` (${money(l.seasonPrice)})` : ""}</span>`;
  return money(l.price);
};
const lineDesc = (l) => {
  const name = esc(l.description);
  const detail = l.proposalText ? ` — ${esc(l.proposalText)}` : "";
  return `${l.optional ? "<b>*Optional</b> " : ""}${name}${detail}${l.optional ? SIG : ""}`;
};

// ── RESIDENTIAL (also used for the aeration-style estimate) ──
export function printResidentialProposal(d) {
  const c = { ...DEFAULT_PROPOSAL_CONTENT, ...(d.content || {}) };
  const origin = window.location.origin;
  const required = d.lines.filter((l) => !l.optional);
  const oneTimeRequired = required.filter((l) => !l.frequency || l.frequency === "once").reduce((t, l) => t + l.price, 0);
  const recurring = required.filter((l) => l.frequency && l.frequency !== "once");
  const issued = d.date ? new Date(d.date) : new Date();
  const gtk = [
    `<li><b>${esc(d.startText || c.startDefault)}</b></li>`,
    d.timeOnSite ? `<li><b>Total time on site:</b> <span class="em">${esc(d.timeOnSite)}</span></li>` : "",
    `<li><b>Services Excluded:</b> <span class="em">${esc(d.exclusions || c.servicesExcluded)}</span></li>`,
    d.warranty ? `<li><b>Warranty:</b> <span class="em">${esc(d.warranty)}</span></li>` : "",
    ...(d.notices || []).filter(Boolean).map((n) => {
      const m = String(n).match(/^([^:]{3,80}):\s*([\s\S]*)$/);
      return m ? `<li><b>${esc(m[1])}:</b> <b><i>${esc(m[2])}</i></b></li>` : `<li><b><i>${esc(n)}</i></b></li>`;
    }),
  ].join("");
  const rows = d.lines.map((l, i) => `<tr><td class="num">${i + 1}</td><td class="desc">${lineDesc(l)}</td><td class="amt">${priceCell(l)}</td></tr>`).join("");
  const body = `
  <div class="runner-head"><img src="${origin}/brand/oll-mark.png" /></div>
  <div class="runner-foot">${esc(c.companyName)} | ${esc(c.website)}</div>
  <div class="sheet"><table class="page"><thead><tr><td></td></tr></thead><tfoot><tr><td></td></tr></tfoot><tbody><tr><td><div class="wrap">
    <img class="logo" src="${origin}/brand/oll-logo.png" alt="Owen's Lawn &amp; Landscape" />
    <div class="kicker">Residential Proposal</div>
    <h1 class="title">${esc(d.projectTitle || "Proposal")}</h1>
    <div class="info">
      <div><div class="lbl">Prepared for</div><div class="val">${esc(d.customer || "")}<br/>${esc(d.address || "")}</div></div>
      <div><div class="lbl">Prepared by</div><div class="val">${esc(c.companyLegal)}<br/>${esc(c.phone)} • <a href="mailto:${esc(c.email)}">${esc(c.email)}</a></div></div>
      <div><div class="lbl">Date issued</div><div class="val">${fmtDate(issued)} • Valid ${Number(c.validDays) || 90} days from date of issue${d.estimateNumber ? `<br/>${esc(d.estimateNumber)}` : ""}</div></div>
      <div><div class="lbl">Contact</div><div class="val">${esc(c.contactName)}<br/>${esc(c.phone)}</div></div>
    </div>
    <h2>Who We Are</h2>
    <div class="indent">${paras(c.whoWeAre)}</div>

    <div class="pb"></div>
    <h2>References</h2>
    <div class="refs"><div>${paras(c.reference1)}</div><div>${paras(c.reference2)}</div></div>
    <h2>Good to Know</h2>
    <ul class="gtk">${gtk}</ul>
    ${d.notes ? `<div style="margin-top:8pt" class="terms">${paras(d.notes)}</div>` : ""}

    <div class="pb"></div>
    <h2>Pricing</h2>
    <p class="muted" style="font-style:italic">${esc(d.pricingIntro || "")}</p>
    <table class="price">
      <thead><tr><th>#</th><th>DESCRIPTION</th><th class="amt" style="color:#fff;font-style:normal">PRICE</th></tr></thead>
      <tbody>${rows}
        <tr class="total"><td colspan="2">TOTAL${recurring.length ? " (one-time services)" : ""}</td><td class="amt" style="font-style:normal;color:#222">${money(oneTimeRequired)}</td></tr>
        ${recurring.length ? `<tr class="total"><td colspan="2">RECURRING SERVICE${recurring.length > 1 ? "S" : ""} — billed per visit</td><td class="amt" style="font-style:normal;color:#222">${money(recurring.reduce((t, l) => t + l.price, 0))} / visit</td></tr>` : ""}
      </tbody>
    </table>
    <div class="terms">
      <p style="margin-bottom:2pt"><i>Payment Terms</i></p>
      <p><b>Deposit:</b> ${esc(c.depositTerms)}</p>
      ${d.lines.some((l) => l.optional) ? `<p><b>Optional Line Item Authorization:</b> ${esc(c.optionalTerms)}</p>` : ""}
      <p><b>Payable By:</b> ${esc(c.payableBy)}</p>
    </div>
    <h2>Acceptance</h2>
    <p class="terms">Signing below authorizes the work and pricing described above</p>
    <div class="accept-line"><span>Signature:</span><span class="fill"></span><span>Date:</span><span class="fill" style="flex:0 0 1.2in"></span></div>
    <div class="accept-line"><span>Print Name:</span><span class="fill"></span><span style="flex:0 0 1.6in"></span></div>
    <div class="accept-line"><span>Company Representative Signature:</span><span class="fill"></span></div>
    ${d.attachments?.coi ? `<div class="pb"></div><h2>Certificate of Insurance</h2><div class="attach"><img src="${d.attachments.coi}" /></div>` : ""}
  </div></td></tr></tbody></table></div>`;
  openPrint(`${d.projectTitle || "Proposal"} — ${d.customer || ""}`, baseCss(), body);
}

// ── COMMERCIAL ───────────────────────────────────────────────
export function printCommercialProposal(d) {
  const c = { ...DEFAULT_PROPOSAL_CONTENT, ...(d.content || {}) };
  const k = d.commercial || {};
  const origin = window.location.origin;
  const issued = d.date ? new Date(d.date) : new Date();
  const once = d.lines.filter((l) => !l.frequency || l.frequency === "once");
  const rec = d.lines.filter((l) => l.frequency && l.frequency !== "once");
  const onceTotal = once.filter((l) => !l.optional).reduce((t, l) => t + l.price, 0);
  const recMonthly = rec.filter((l) => !l.optional).reduce((t, l) => t + (l.seasonPrice || l.price) , 0) / (Number(d.seasonMonths) || 8);
  const recRange = recMonthly ? `${money(recMonthly * 0.9)} – ${money(recMonthly * 1.1)}` : "";
  const contactName = k.contactName || c.contactName;
  const contactPhone = k.contactPhone || c.phone;
  const deposit = onceTotal * 0.5;
  const middlePct = Number(k.middlePct) || 0;
  const row = (l, i) => `<tr><td class="num">${i + 1}</td><td class="desc">${lineDesc(l)}</td><td class="amt">${priceCell(l)}</td></tr>`;
  let sec = 0;
  const S = (t) => `<h2>SECTION ${++sec} &nbsp;${esc(t)}</h2>`;
  const scopeBlocks = d.lines.map((l, i) => `
    <h3>${5}.${i + 1} ${esc(l.description)}</h3>
    ${l.proposalText ? `<p>${esc(l.proposalText)}</p>` : ""}
    ${lines(l.workIncluded).length ? `<p class="kicker" style="margin-top:4pt">Work Included</p><ul class="gtk">${lines(l.workIncluded).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    ${l.acceptance ? `<p class="kicker" style="margin-top:4pt">Acceptance Criteria</p><p>${esc(l.acceptance)}</p>` : ""}`).join("");
  const phases = lines(k.phases).map((p) => { const m = p.match(/^([^:]+):\s*(.*)$/); return m ? [m[1], m[2]] : ["", p]; });

  const body = `
  <div class="runner-head"><img src="${origin}/brand/oll-mark.png" /></div>
  <div class="runner-foot">${esc(c.companyName)} | ${esc(c.website)}</div>
  <div class="sheet"><table class="page"><thead><tr><td></td></tr></thead><tfoot><tr><td></td></tr></tfoot><tbody><tr><td><div class="wrap">
    <img class="logo" src="${origin}/brand/oll-logo.png" alt="Owen's Lawn &amp; Landscape" />
    <div class="kicker">Commercial Proposal</div>
    <h1 class="title" style="margin-bottom:2pt">${esc(d.projectTitle || "Proposal")}</h1>
    <p style="font-weight:700;color:#333">${esc(d.customer || "")}${k.clientCity ? ` — ${esc(k.clientCity)}` : ""}</p>
    ${k.oneLiner ? `<p class="muted" style="font-style:italic">${esc(k.oneLiner)}</p>` : ""}
    <div class="info" style="margin-left:0">
      <div><div class="lbl">Prepared for</div><div class="val">${esc(d.customer || "")}<br/>${esc(d.address || "")}</div></div>
      <div><div class="lbl">Contact</div><div class="val">${esc(contactName)}${k.contactTitle ? `, ${esc(k.contactTitle)}` : ""} · ${esc(contactPhone)}<br/>${esc(c.email)}<br/>${esc(c.website)}</div></div>
      <div><div class="lbl">Prepared by</div><div class="val">${esc(c.companyName)}<br/>${esc(c.companyLegal)}<br/>${esc(c.address)}</div></div>
      <div><div class="lbl">Date issued</div><div class="val">${fmtDate(issued)} · Valid ${Number(c.validDays) || 90} days from date of issue${d.estimateNumber ? `<br/>${esc(d.estimateNumber)}` : ""}</div></div>
    </div>
    <table class="price" style="margin-top:12pt">
      ${once.length ? `<tr><td style="background:#efede6"><div class="kicker">One-time investment</div><div style="font-size:16pt;font-weight:700;color:#1b4d3e">${money(onceTotal)}</div><div class="muted" style="font-style:italic">${esc(k.oneTimeSummary || d.pricingIntro || "")}</div></td></tr>` : ""}
      ${rec.length ? `<tr><td style="background:#efede6"><div class="kicker">Recurring program</div><div style="font-size:16pt;font-weight:700;color:#1b4d3e">${recRange} per month</div><div class="muted" style="font-style:italic">${esc(k.recurringSummary || "Billed as performed.")}</div></td></tr>` : ""}
    </table>
    <h3 style="margin-top:16pt">Table of Contents</h3>
    <ol style="list-style:none;margin:4pt 0 0 0;font-size:10pt;color:#333;line-height:1.7">
      ${["Who We Are", "References & Previously Completed Work", "Letter of Transmittal", "Pricing", "Scope of Work", "Project Schedule", "Clarifications, Assumptions & Exclusions", "Authorization & Agreement"].map((t, i) => `<li><span style="color:#1b4d3e;font-weight:700">Section ${i + 1}</span> &nbsp;${t}</li>`).join("")}
    </ol>

    <div class="pb"></div>
    ${S("Who We Are")}
    <div class="indent">${paras(c.whoWeAre)}</div>
    ${S("References & Previously Completed Work")}
    <div class="refs"><div>${paras(c.reference1)}</div><div>${paras(c.commercialReference2 || c.reference2)}</div></div>
    ${lines(k.experience).length ? `<h3>Relevant Experience</h3><ul class="gtk">${lines(k.experience).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    <p style="margin-top:8pt">${esc(c.customerServiceNote)}</p>

    <div class="pb"></div>
    ${S("Letter of Transmittal")}
    <p>To the ${esc(d.customer || "Client")} project team,</p>
    <p>Thank you for the opportunity and for your review of this proposal including: ${esc(k.broadScope || d.lines.map((l) => l.description).join(", "))}.</p>
    <h3>What This Proposal Includes</h3>
    <ul class="gtk">${d.lines.map((l) => `<li>${esc(l.description)}${l.frequency && l.frequency !== "once" ? ` (recurring, ${FREQ[l.frequency] || ""})` : ""}</li>`).join("")}</ul>
    <h3>Single Point of Accountability</h3>
    <p>${esc(c.singlePoint)} The company representative responsible for communication between the Client and ${esc(c.companyName)} is ${esc(contactName)}, who can be reached at ${esc(contactPhone)}. ${esc(contactName)} will be responsible for overseeing the project, coordinating scheduling, managing work performed by ${esc(c.companyName)} and any subcontractors, and addressing project-related questions or concerns.</p>
    <p>${esc(c.subcontractors)}</p>
    ${k.compliance ? `<h3>Compliance With Plan</h3><p>${esc(k.compliance)}</p>` : ""}
    <p>Thank you for the opportunity to bring this plan to fruition. If any questions remain, please reach out to your contact (info above and on page 1) to request a site walk prior to the signing of this contract.</p>
    <p style="margin-top:10pt">Respectfully submitted,</p>
    <p><b>${esc(c.contactName)}, ${esc(c.contactTitle)}</b><br/>${esc(c.companyName)}<br/>${esc(c.phone)} · ${esc(c.email)}</p>

    <div class="pb"></div>
    ${S("Pricing")}
    ${once.length ? `<h3>One-Time Investment</h3><p class="muted" style="font-style:italic">${esc(d.pricingIntro || "Pricing is firm for " + (Number(c.validDays) || 90) + " days and includes labor, materials, equipment, and disposal as described in the scope sections below.")}</p>
      <table class="price"><thead><tr><th>#</th><th>DESCRIPTION</th><th class="amt" style="color:#fff;font-style:normal">INVESTMENT</th></tr></thead>
      <tbody>${once.map(row).join("")}<tr class="total"><td colspan="2">TOTAL INVESTMENT</td><td class="amt" style="font-style:normal;color:#222">${money(onceTotal)}</td></tr></tbody></table>` : ""}
    ${rec.length ? `<h3>Recurring Program</h3><p class="muted" style="font-style:italic">${esc(k.recurringSummary || "Recurring maintenance is billed as performed, separately from the fixed total above.")}</p>
      <table class="price"><thead><tr><th>#</th><th>DESCRIPTION</th><th class="amt" style="color:#fff;font-style:normal">INVESTMENT</th></tr></thead>
      <tbody>${rec.map(row).join("")}<tr class="total"><td colspan="2">TOTAL (typical month)</td><td class="amt" style="font-style:normal;color:#222">${recRange}</td></tr></tbody></table>` : ""}
    ${once.length ? `<h3>Payment Schedule</h3>
      <table class="price"><thead><tr><th>MILESTONE</th><th>%</th><th class="amt" style="color:#fff;font-style:normal">AMOUNT</th></tr></thead><tbody>
        <tr><td>Due at signing</td><td>50%</td><td class="amt">${money(deposit)}</td></tr>
        ${middlePct ? `<tr><td>${esc(k.middleLabel || "Progress payment")}</td><td>${middlePct}%</td><td class="amt">${money(onceTotal * middlePct / 100)}</td></tr>` : ""}
        <tr><td>Due upon completion of work</td><td>${50 - middlePct}%</td><td class="amt">${money(onceTotal * (50 - middlePct) / 100)}</td></tr>
      </tbody></table>` : ""}
    ${k.invoicing ? `<p class="terms">${esc(k.invoicing)}</p>` : ""}

    <div class="pb"></div>
    ${S("Scope of Work")}
    <p>This section details what goes into the satisfaction of every priced scope item from Section 4, as well as the high standard any work performed or subcontracted by ${esc(c.companyName)} adheres to.</p>
    ${scopeBlocks}
    ${d.warranty ? `<h3>Warranty</h3><p>${esc(d.warranty)}</p>` : ""}

    ${S("Project Schedule")}
    <p>${esc(d.startText || c.startDefault)}</p>
    <table class="price"><thead><tr><th style="width:1.4in">PHASE</th><th>ACTIVITY</th></tr></thead><tbody>
      <tr><td>Pre-Start</td><td>Contract execution, material procurement, locates, layout confirmation</td></tr>
      ${phases.map(([p, a], i) => `<tr><td>${esc(p || `Phase ${i + 1}`)}</td><td>${esc(a)}</td></tr>`).join("")}
      <tr><td>Closeout</td><td>Acceptance walkthrough, final invoice</td></tr>
    </tbody></table>
    <h3>Site Access & Continuity</h3>
    ${k.siteAccess ? `<p>${esc(k.siteAccess)}</p>` : ""}
    <p>${esc(c.leaveItBetter)}</p>

    <div class="pb"></div>
    ${S("Clarifications, Assumptions & Exclusions")}
    <p>${esc(c.clarificationsIntro)}</p>
    ${k.confirmations ? `<h3>Items Requiring Confirmation</h3><p>${esc(k.confirmations)}</p>` : ""}
    ${k.siteConditions ? `<h3>Site Conditions & Access</h3><p>${esc(k.siteConditions)}</p>` : ""}
    ${k.permits ? `<h3>Permits</h3><p>${esc(k.permits)}</p>` : ""}
    <h3>Exclusions</h3>
    ${lines(d.exclusions).length > 1 ? `<ul class="gtk">${lines(d.exclusions).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p>${esc(d.exclusions || c.servicesExcluded)}</p>`}
    ${(d.notices || []).filter(Boolean).map((n) => `<p class="terms"><b>${esc(n)}</b></p>`).join("")}

    <div class="pb"></div>
    ${S("Authorization & Agreement")}
    <p>By signing below, Client authorizes ${esc(c.companyName)} to perform the work described in this proposal and agrees to the pricing, schedule, and terms set forth above.</p>
    <table class="price"><thead><tr><th>SCOPE</th><th class="amt" style="color:#fff;font-style:normal">VALUE</th></tr></thead><tbody>
      ${once.filter((l) => !l.optional).map((l) => `<tr><td>${esc(l.description)}</td><td class="amt">${money(l.price)}</td></tr>`).join("")}
      ${once.length ? `<tr class="total"><td>TOTAL CONTRACT SUM</td><td class="amt" style="font-style:normal;color:#222">${money(onceTotal)}</td></tr>` : ""}
      ${rec.length ? `<tr><td>Recurring program — billed as performed</td><td class="amt">${recRange} / mo</td></tr>` : ""}
    </tbody></table>
    <h3>Terms</h3>
    <ul class="gtk">
      <li>This estimate is valid for ${Number(c.validDays) || 90} days.</li>
      <li>${esc(d.startText || c.startDefault)}</li>
      <li><b>Payment.</b> ${esc(k.paymentRecap || "50% due at signing; the balance is due upon completion of work and final walkthrough.")}</li>
      <li>Any additional work that is not listed in the proposal above requires written authorization and becomes an addition to the contract sum.</li>
      ${d.warranty ? `<li><b>Warranty.</b> ${esc(d.warranty)}</li>` : ""}
      <li>Deposits and payments are accepted by ${esc(k.payableBy || c.payableBy)}.</li>
    </ul>
    <p class="kicker" style="margin-top:14pt">Accepted for ${esc(d.customer || "Client")}</p>
    <div class="accept-line"><span>Signature:</span><span class="fill"></span></div>
    <div class="accept-line"><span>Print Name &amp; Title:</span><span class="fill"></span></div>
    <div class="accept-line"><span>Date:</span><span class="fill"></span></div>
    <p class="kicker" style="margin-top:14pt">${esc(c.companyName)}</p>
    <div class="accept-line"><span>Company Representative Signature:</span><span class="fill"></span></div>
    <div class="accept-line"><span>${esc(c.contactName)}, ${esc(c.contactTitle)} · Date:</span><span class="fill"></span></div>
    ${d.attachments?.coi ? `<div class="pb"></div><h2>Certificate of Insurance</h2><div class="attach"><img src="${d.attachments.coi}" /></div>` : ""}
    ${d.attachments?.w9 ? `<div class="pb"></div><h2>Form W-9</h2><div class="attach"><img src="${d.attachments.w9}" /></div>` : ""}
  </div></td></tr></tbody></table></div>`;
  openPrint(`${d.projectTitle || "Commercial Proposal"} — ${d.customer || ""}`, baseCss(), body);
}
