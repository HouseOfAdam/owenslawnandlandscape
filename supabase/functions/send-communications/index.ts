// supabase/functions/send-communications/index.ts
// ============================================================
// Sends bulk email (Resend) for season campaigns.
//
// Expects JSON body:
// {
//   recipients: [{ name, email, phone, message_email, message_text }],
//   (email only — texting is turned off)
// }
//
// Required secrets (same as notify-new-lead):
//   RESEND_API_KEY, OWEN_EMAIL
// ============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── Only signed-in Owen's Lawn admins may send messages ──
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const { data: isAdmin } = userData?.user ? await userClient.rpc("is_admin") : { data: false };
  if (!userData?.user || isAdmin !== true) {
    return new Response(JSON.stringify({ error: "Not authorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { recipients } = await req.json();

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return new Response(JSON.stringify({ error: "No recipients provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");

    const results = { sent_email: 0, sent_text: 0, failed_email: 0, failed_text: 0, errors: [] };

    for (const r of recipients) {
      // ── Send Email ──────────────────────────────────────────
      if (r.email && resendKey) {
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
              from: "Owen's Lawn + Landscape <owen@owenslawnandlandscapes.com>",
              to: r.email,
              bcc: ["owenlawnandlandscape09@gmail.com", "ascheidler1@gmail.com"],
              reply_to: "owenlawnandlandscape09@gmail.com",
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

      // Texting is turned off (Twilio removed); campaigns go out by email only.
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
