// supabase/functions/notify-estimate-response/index.ts
// Emails (Resend) Owen when a customer approves or
// requests changes on an online proposal. Called only by the database
// trigger notify_estimate_response() using the service-role key.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const money = (v: unknown) => `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

// Only the database (service role) may call this function
function isServiceRole(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (!isServiceRole(req)) return new Response(JSON.stringify({ error: "Not authorized" }), { status: 401 });
  try {
    const e = await req.json();
    const adminUrl = Deno.env.get("ADMIN_PORTAL_URL") || "https://owenslawnandlandscapes.com";
    const approved = e.status === "approved";
    const totalText = approved
      ? `${money(e.approval_total)}${Number(e.approval_recurring) ? ` + ${money(e.approval_recurring)}/visit` : ""}`
      : "";

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const owenEmail = Deno.env.get("OWEN_EMAIL");
    if (resendKey && owenEmail) {
      const color = approved ? "#1a4a2e" : "#92400e";
      const payload = {
          to: [owenEmail],
          subject: approved
            ? `✅ Approved: ${e.customer_name} — ${e.number} (${totalText})`
            : `✏️ Changes requested: ${e.customer_name} — ${e.number}`,
          html: `
            <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto;">
              <div style="background:${color}; color:#fff; padding:20px 24px; border-radius:16px 16px 0 0;">
                <h2 style="margin:0; font-size:18px;">${approved ? "Proposal approved online" : "Customer requested changes"}</h2>
              </div>
              <div style="background:#f7f4ef; padding:24px; border:1px solid #e0d9cf; border-top:none; border-radius:0 0 16px 16px;">
                <table style="width:100%; font-size:14px; border-collapse:collapse;">
                  <tr><td style="padding:6px 0; color:#7a9488; width:130px;">Customer</td><td style="padding:6px 0; font-weight:bold;">${esc(e.customer_name)}</td></tr>
                  <tr><td style="padding:6px 0; color:#7a9488;">Proposal</td><td style="padding:6px 0;">${esc(e.number)}${e.project_title ? ` · ${esc(e.project_title)}` : ""}</td></tr>
                  ${approved ? `<tr><td style="padding:6px 0; color:#7a9488;">Signed by</td><td style="padding:6px 0;">${esc(e.approved_name)}</td></tr>
                  <tr><td style="padding:6px 0; color:#7a9488;">Approved total</td><td style="padding:6px 0; font-weight:bold;">${esc(totalText)}</td></tr>
                  <tr><td style="padding:6px 0; color:#7a9488;">Optional items</td><td style="padding:6px 0;">${esc(e.optional_selected || "None selected")}</td></tr>` : ""}
                  ${e.customer_note ? `<tr><td style="padding:6px 0; color:#7a9488; vertical-align:top;">Note</td><td style="padding:6px 0;">${esc(e.customer_note)}</td></tr>` : ""}
                </table>
                <div style="margin-top:20px;"><a href="${adminUrl}" style="display:inline-block; background:${color}; color:#fff; padding:12px 24px; border-radius:12px; text-decoration:none; font-weight:bold; font-size:14px;">Open admin portal →</a></div>
              </div>
            </div>`,
      };
      // Send from the business domain; if Resend says the domain isn't verified yet,
      // fall back to Resend's shared sender (delivers to the Resend account owner).
      const send = (fromAddr: string) => fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({ from: fromAddr, ...payload }),
      });
      try {
        let r = await send(Deno.env.get("RESEND_FROM") || "Owen's Lawn & Landscape <owen@owenslawnandlandscapes.com>");
        let txt = await r.text();
        if (r.status === 403 && /not verified/i.test(txt)) {
          console.warn("Business domain not verified in Resend; retrying from onboarding@resend.dev");
          r = await send("Owen's Lawn & Landscape <onboarding@resend.dev>");
          txt = await r.text();
        }
        if (r.ok) console.log("Email sent:", r.status, txt.slice(0, 200));
        else console.error("Email rejected by Resend:", r.status, txt.slice(0, 500));
      } catch (err) { console.error("Email failed:", err); }
    } else {
      console.error("Email skipped: missing", !resendKey ? "RESEND_API_KEY" : "", !owenEmail ? "OWEN_EMAIL" : "");
    }

    // Text alerts are turned off (Twilio removed). Email only.

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("notify-estimate-response error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
