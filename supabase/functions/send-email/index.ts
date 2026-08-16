import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function appBrandName() {
  return Deno.env.get("APP_NAME") ?? "Trackweeb";
}

async function sendResendEmail(params: {
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return { sent: false, error: "Email not configured" };
  }

  const appName = appBrandName();
  const from = Deno.env.get("RESEND_FROM_EMAIL") ?? `${appName} <onboarding@resend.dev>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        reply_to: params.replyTo,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { sent: false, error: `Resend error ${res.status}: ${body}` };
    }

    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : "Send failed" };
  }
}

type EmailBody =
  | {
      type: "status_change";
      to: string;
      tracking_code: string;
      receiver_name: string;
      old_status: string;
      new_status: string;
      origin: string;
      destination: string;
    }
  | {
      type: "delay";
      to: string;
      tracking_code: string;
      receiver_name: string;
      reason: string;
      new_eta: string;
      origin: string;
      destination: string;
    }
  | {
      type: "contact_inquiry";
      name: string;
      email: string;
      phone?: string;
      company?: string;
      origin: string;
      destination: string;
      details: string;
    };

function buildHtml(body: EmailBody): { to: string[]; subject: string; html: string; replyTo?: string } {
  if (body.type === "status_change") {
    return {
      to: [body.to],
      subject: `Shipment ${body.tracking_code} — now ${statusLabel(body.new_status)}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">Shipment status update</h2>
          <p>Hi ${escapeHtml(body.receiver_name)},</p>
          <p>Your shipment <strong>${escapeHtml(body.tracking_code)}</strong> status has changed:</p>
          <p style="font-size: 18px; font-weight: 600; color: #e85d04;">
            ${statusLabel(body.old_status)} → ${statusLabel(body.new_status)}
          </p>
          <p><strong>Route:</strong> ${escapeHtml(body.origin)} → ${escapeHtml(body.destination)}</p>
          <p style="color: #666; font-size: 14px;">Track your shipment anytime using your tracking code.</p>
        </div>
      `,
    };
  }

  if (body.type === "delay") {
    const eta = new Date(body.new_eta).toLocaleString();
    return {
      to: [body.to],
      subject: `Shipment ${body.tracking_code} — delivery delayed`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">Shipment delay notice</h2>
          <p>Hi ${escapeHtml(body.receiver_name)},</p>
          <p>Your shipment <strong>${escapeHtml(body.tracking_code)}</strong> has been delayed.</p>
          <p><strong>Reason:</strong> ${escapeHtml(body.reason)}</p>
          <p><strong>Updated ETA:</strong> ${escapeHtml(eta)}</p>
          <p><strong>Route:</strong> ${escapeHtml(body.origin)} → ${escapeHtml(body.destination)}</p>
        </div>
      `,
    };
  }

  const appName = appBrandName();
  const supportEmail = Deno.env.get("SUPPORT_EMAIL") ?? `support@${appName.toLowerCase().replace(/\s+/g, "")}.com`;
  const subject = `Quote request — ${body.origin} → ${body.destination}`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 620px; margin: 0 auto; color: #1a1a2e;">
      <h2 style="margin: 0 0 16px;">New quote request</h2>
      <p style="color: #555; margin: 0 0 24px;">Submitted via the ${escapeHtml(appName)} contact form.</p>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding: 8px 0; color: #666; width: 140px;">Name</td><td style="padding: 8px 0;"><strong>${escapeHtml(body.name)}</strong></td></tr>
        ${body.company ? `<tr><td style="padding: 8px 0; color: #666;">Company</td><td style="padding: 8px 0;">${escapeHtml(body.company)}</td></tr>` : ""}
        <tr><td style="padding: 8px 0; color: #666;">Email</td><td style="padding: 8px 0;"><a href="mailto:${escapeHtml(body.email)}">${escapeHtml(body.email)}</a></td></tr>
        ${body.phone ? `<tr><td style="padding: 8px 0; color: #666;">Phone</td><td style="padding: 8px 0;">${escapeHtml(body.phone)}</td></tr>` : ""}
        <tr><td style="padding: 8px 0; color: #666;">Origin</td><td style="padding: 8px 0;">${escapeHtml(body.origin)}</td></tr>
        <tr><td style="padding: 8px 0; color: #666;">Destination</td><td style="padding: 8px 0;">${escapeHtml(body.destination)}</td></tr>
      </table>
      <h3 style="margin: 24px 0 8px; font-size: 15px;">Shipment details</h3>
      <pre style="white-space: pre-wrap; background: #f4f4f5; padding: 16px; border-radius: 8px; font-size: 13px; line-height: 1.5;">${escapeHtml(body.details)}</pre>
    </div>
  `;

  return { to: [supportEmail], subject, html, replyTo: body.email };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as EmailBody;

    if (body.type === "status_change" || body.type === "delay") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ sent: false, error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } },
      );

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ sent: false, error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const mail = buildHtml(body);
    const result = await sendResendEmail(mail);

    if (body.type === "contact_inquiry" && result.sent) {
      const appName = appBrandName();
      await sendResendEmail({
        to: [body.email],
        subject: `We received your ${appName} quote request`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a2e;">
            <h2 style="margin: 0 0 12px;">Thanks, ${escapeHtml(body.name)}</h2>
            <p>We received your freight quote request for <strong>${escapeHtml(body.origin)} → ${escapeHtml(body.destination)}</strong>.</p>
            <p>A member of the ${escapeHtml(appName)} team will reply within one business day.</p>
          </div>
        `,
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ sent: false, error: err instanceof Error ? err.message : "Bad request" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
