// supabase/functions/notify-new-lead/index.ts
// Sends email (via Resend) + SMS (via Twilio) when a new lead comes in.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const lead = await req.json();
    const adminUrl = Deno.env.get("ADMIN_PORTAL_URL") || "https://owenslawnandlandscapes.com";

    // ── Determine source label for display ──
    const isReferral = lead.source === "referral" || (lead.heard_from || "").toLowerCase().includes("referral");
    let sourceLabel = "Website Estimate Request";
    if (isReferral) {
      sourceLabel = `🤝 Customer Referral${lead.referral_code ? ` (Code: ${lead.referral_code})` : ""}`;
    } else if (lead.source === "signup_form") {
      sourceLabel = "Customer Sign-Up Form";
    } else if (lead.source === "manual") {
      sourceLabel = "Manual Entry";
    }

    // ── Send Email via Resend ────────────────────────────────
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const owenEmail = Deno.env.get("OWEN_EMAIL");

    if (resendKey && owenEmail) {
      try {
        const subjectPrefix = isReferral ? "🤝 Referral" : "🌿 New Lead";
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: "Owen's Lawn + Landscape <owen@owenslawnandlandscapes.com>",
            to: [owenEmail],
            subject: `${subjectPrefix}: ${lead.name} — ${lead.service_type || "Estimate Request"}`,
            html: `
              <div style="font-family: 'Georgia', serif; max-width: 500px; margin: 0 auto;">
                <div style="background: ${isReferral ? '#b45309' : '#1a4a2e'}; color: white; padding: 20px 24px; border-radius: 16px 16px 0 0;">
                  <h2 style="margin: 0; font-size: 18px;">${isReferral ? '🤝 Customer Referral Received' : 'New Lead Received'}</h2>
                </div>
                <div style="background: #f7f4ef; padding: 24px; border: 1px solid #e0d9cf; border-top: none; border-radius: 0 0 16px 16px;">
                  ${isReferral ? `<div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; font-size: 13px; color: #92400e;"><strong>Referred via code: ${lead.referral_code || 'N/A'}</strong><br/>This lead came through a customer referral. Credit will be applied when converted.</div>` : ''}
                  <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                    <tr><td style="padding: 8px 0; color: #7a9488; width: 100px;">Name</td><td style="padding: 8px 0; font-weight: bold;">${lead.name}</td></tr>
                    <tr><td style="padding: 8px 0; color: #7a9488;">Phone</td><td style="padding: 8px 0;"><a href="tel:${lead.phone}" style="color: #1a4a2e;">${lead.phone || 'N/A'}</a></td></tr>
                    <tr><td style="padding: 8px 0; color: #7a9488;">Email</td><td style="padding: 8px 0;"><a href="mailto:${lead.email}" style="color: #1a4a2e;">${lead.email || 'N/A'}</a></td></tr>
                    <tr><td style="padding: 8px 0; color: #7a9488;">Address</td><td style="padding: 8px 0;">${lead.address || 'N/A'}</td></tr>
                    <tr><td style="padding: 8px 0; color: #7a9488;">Service</td><td style="padding: 8px 0; font-weight: bold;">${lead.service_type || "Not specified"}</td></tr>
                    <tr><td style="padding: 8px 0; color: #7a9488;">Source</td><td style="padding: 8px 0; font-weight: bold; ${isReferral ? 'color: #b45309;' : ''}">${sourceLabel}</td></tr>
                    ${lead.notes ? `<tr><td style="padding: 8px 0; color: #7a9488; vertical-align: top;">Notes</td><td style="padding: 8px 0;">${lead.notes}</td></tr>` : ''}
                  </table>
                  <div style="margin-top: 20px;">
                    <a href="${adminUrl}" style="display: inline-block; background: #1a4a2e; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 14px;">
                      Open CRM →
                    </a>
                  </div>
                </div>
              </div>
            `,
          }),
        });
        console.log("Email notification sent to", owenEmail);
      } catch (emailErr) {
        console.error("Email send failed:", emailErr);
      }
    }

    // ── Send SMS via Twilio ──────────────────────────────────
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioFrom = Deno.env.get("TWILIO_PHONE_FROM");
    const owenPhone = Deno.env.get("OWEN_PHONE");

    if (twilioSid && twilioAuth && twilioFrom && owenPhone) {
      try {
        const smsPrefix = isReferral ? `🤝 REFERRAL` : `🌿 New Lead`;
        const smsBody = `${smsPrefix}!\n${lead.name}\n${lead.service_type || "Estimate"}\n📍 ${lead.address || 'N/A'}\n📞 ${lead.phone || 'N/A'}${isReferral && lead.referral_code ? `\nRef Code: ${lead.referral_code}` : ''}\n\nOpen CRM: ${adminUrl}`;

        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": "Basic " + btoa(`${twilioSid}:${twilioAuth}`),
          },
          body: new URLSearchParams({
            To: owenPhone,
            From: twilioFrom,
            Body: smsBody,
          }),
        });
        console.log("SMS notification sent to", owenPhone);
      } catch (smsErr) {
        console.error("SMS send failed:", smsErr);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-new-lead error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
