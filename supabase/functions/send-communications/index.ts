// supabase/functions/send-communications/index.ts
// ============================================================
// Sends bulk email (Resend) + SMS (Twilio) for season campaigns.
//
// Expects JSON body:
// {
//   recipients: [{ name, email, phone, message_email, message_text }],
//   send_mode: "email" | "text" | "both"
// }
//
// Required secrets (same as notify-new-lead):
//   RESEND_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
//   TWILIO_PHONE_FROM, OWEN_EMAIL
// ============================================================

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
    const { recipients, send_mode } = await req.json();

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return new Response(JSON.stringify({ error: "No recipients provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const owenEmail = Deno.env.get("OWEN_EMAIL");
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioFrom = Deno.env.get("TWILIO_PHONE_FROM");

    const results = { sent_email: 0, sent_text: 0, failed_email: 0, failed_text: 0, errors: [] };

    for (const r of recipients) {
      // ── Send Email ──────────────────────────────────────────
      if ((send_mode === "email" || send_mode === "both") && r.email && resendKey) {
        try {
          // Extract subject from message (first line after "Subject: ")
          let subject = `Owen's Lawn + Landscape — Season Update`;
          let body = r.message_email || "";
          if (body.startsWith("Subject:")) {
            const lines = body.split("\n");
            subject = lines[0].replace("Subject: ", "").trim();
            body = lines.slice(1).join("\n").trim();
          }

          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${resendKey}`,
            },
            body: JSON.stringify({
              from: "onboarding@resend.dev",
              to: [r.email],
              subject,
              text: body,
            }),
          });

          if (res.ok) {
            results.sent_email++;
            console.log(`Email sent to ${r.email}`);
          } else {
            results.failed_email++;
            const err = await res.text();
            results.errors.push(`Email to ${r.email}: ${err}`);
            console.error(`Email failed for ${r.email}:`, err);
          }
        } catch (emailErr) {
          results.failed_email++;
          results.errors.push(`Email to ${r.email}: ${emailErr.message}`);
          console.error(`Email error for ${r.email}:`, emailErr);
        }
      }

      // ── Send SMS ────────────────────────────────────────────
      if ((send_mode === "text" || send_mode === "both") && r.phone && twilioSid && twilioAuth && twilioFrom) {
        try {
          const phone = r.phone.replace(/\D/g, "");
          const fullPhone = phone.startsWith("1") ? `+${phone}` : `+1${phone}`;

          const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Authorization": "Basic " + btoa(`${twilioSid}:${twilioAuth}`),
            },
            body: new URLSearchParams({
              To: fullPhone,
              From: twilioFrom,
              Body: r.message_text || "",
            }),
          });

          if (res.ok) {
            results.sent_text++;
            console.log(`SMS sent to ${fullPhone}`);
          } else {
            results.failed_text++;
            const err = await res.text();
            results.errors.push(`SMS to ${fullPhone}: ${err}`);
            console.error(`SMS failed for ${fullPhone}:`, err);
          }
        } catch (smsErr) {
          results.failed_text++;
          results.errors.push(`SMS to ${r.phone}: ${smsErr.message}`);
          console.error(`SMS error for ${r.phone}:`, smsErr);
        }
      }
    }

    console.log("Send results:", JSON.stringify(results));

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-communications error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
