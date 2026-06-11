/* Vercel serverless function: landing contact form.
   Per submission:
   1. Emails the inquiry to the office inbox via Resend (RESEND_API_KEY env var).
   2. Sends a branded confirmation email back to the prospect.
   3. Creates a CRM lead via the anon Supabase RPC (same pipeline as /check).
   Succeeds if the office email OR the lead went through, so a hiccup in one
   leg never silently swallows an inquiry. The prospect confirmation is pure
   best-effort. Layout mirrors src/lib/email/render.ts in the CRM. */

var SB_URL = "https://uknsayoyvffkxamofczy.supabase.co";
var SB_ANON = "sb_publishable_EgsBfmOtwL0nL3ZrgYNkEQ_15_0BBV1"; // public anon key, same as the page
var TO_EMAIL = "office@kaufman-finance.com";
var FROM_EMAIL = "Kaufman Finance Group <noreply@kaufman-finance.com>";
var LOGO_URL = "https://kaufman-finance.com/assets/logo-coin-square.png";
var GOLD = "#C9A961", GOLD_TEXT = "#8A6E2D", BLACK = "#0A0A0A";

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

/* Branded shell — keep in sync with src/lib/email/render.ts in the CRM:
   black serif-wordmark header, gold divider, padded card with a gold accent
   bar under the heading, warm contact footer. */
function brandedEmail(locale, heading, bodyHtml) {
  var dir = locale === "he" ? "rtl" : "ltr", align = locale === "he" ? "right" : "left";
  var auto = locale === "he" ? "הודעה אוטומטית מהאתר" : "Automated message from the website";
  return '<!DOCTYPE html><html dir="' + dir + '" lang="' + locale + '"><head><meta charset="utf-8"></head>' +
    '<body style="margin:0;padding:0;background:#F3EEE3;font-family:Arial,Helvetica,sans-serif;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3EEE3;padding:36px 0;"><tr><td align="center" style="padding:0 12px;">' +
    '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid #E8E1D0;border-radius:18px;overflow:hidden;">' +
    '<tr><td align="center" style="background:' + BLACK + ';padding:34px 28px 26px;">' +
    '<img src="' + LOGO_URL + '" width="64" height="64" alt="Kaufman Finance Group" style="display:block;margin:0 auto;border:0;">' +
    '<div style="color:#FFFFFF;font-size:22px;font-weight:700;letter-spacing:6px;font-family:Georgia,serif;margin-top:14px;">KAUFMAN</div>' +
    '<div style="color:' + GOLD + ';font-size:10px;letter-spacing:5px;margin-top:6px;">FINANCE&nbsp;GROUP</div></td></tr>' +
    '<tr><td style="height:3px;background:' + GOLD + ';background-image:linear-gradient(90deg,#B8945A,#E8C77B,#B8945A);font-size:0;line-height:3px;">&nbsp;</td></tr>' +
    '<tr><td dir="' + dir + '" align="' + align + '" style="padding:36px 34px;text-align:' + align + ';">' +
    '<h1 style="margin:0 0 10px;font-size:23px;line-height:1.3;color:' + BLACK + ';font-family:Georgia,serif;font-weight:700;">' + heading + "</h1>" +
    '<table role="presentation" cellpadding="0" cellspacing="0" align="' + align + '" style="margin:0 0 22px;"><tr>' +
    '<td width="44" style="height:3px;background:' + GOLD + ';border-radius:2px;font-size:0;line-height:3px;">&nbsp;</td></tr></table>' +
    '<div style="font-size:15px;line-height:1.75;color:#3A3A3A;clear:both;">' + bodyHtml + "</div></td></tr>" +
    '<tr><td dir="' + dir + '" align="' + align + '" style="background:#FAF8F3;border-top:1px solid #EFE7D5;padding:24px 34px;text-align:' + align + ';">' +
    '<div style="font-size:15px;color:' + GOLD_TEXT + ';font-weight:700;font-family:Georgia,serif;">Kaufman Finance Group</div>' +
    '<div style="font-size:12px;color:#767676;line-height:1.9;margin-top:4px;"><a href="tel:+97225681681" style="color:#767676;text-decoration:none;" dir="ltr">02-568-1681</a>&nbsp;&middot;&nbsp;' +
    '<a href="mailto:office@kaufman-finance.com" style="color:#767676;text-decoration:none;">office@kaufman-finance.com</a>&nbsp;&middot;&nbsp;' +
    '<a href="https://kaufman-finance.com" style="color:' + GOLD_TEXT + ';text-decoration:none;font-weight:600;">kaufman-finance.com</a></div>' +
    '<div style="font-size:11px;color:#A8A29A;margin-top:8px;">' + auto + "</div></td></tr></table>" +
    '<div style="font-size:11px;color:#B5AD9E;margin-top:14px;">&copy; Kaufman Finance Group</div>' +
    "</td></tr></table></body></html>";
}

function officeBody(d) {
  var row = function (k, v) {
    return '<tr><td style="padding:6px 12px;font-weight:bold;white-space:nowrap;">' + k +
           '</td><td style="padding:6px 12px;">' + esc(v || "—") + "</td></tr>";
  };
  return '<table style="border-collapse:collapse;background:#FAF8F3;border-radius:8px;">' +
    row("שם", d.name) + row("אימייל", d.email) + row("נושא", d.subject) + row("הודעה", d.message) +
    '</table><p style="color:#666666;font-size:12px;">אפשר להשיב ישירות למייל הזה — התשובה תגיע לפונה.</p>';
}

function confirmBody(d) {
  var he = d.locale === "he";
  var btn = '<a href="https://wa.me/97225681681" style="display:inline-block;background:' + GOLD + ";color:" + BLACK +
    ';text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:999px;margin-top:14px;">' +
    (he ? "דברו איתנו בוואטסאפ" : "Chat with us on WhatsApp") + "</a>";
  return "<p style=\"margin:0 0 14px;\">" +
    (he ? "ההודעה שלך הגיעה למשרדנו. יועץ משכנתאות יעבור עליה וייצור איתך קשר עד יום העסקים הבא."
        : "Your message has reached our office. A mortgage advisor will review it and contact you by the next business day.") +
    "</p><p style=\"margin:0;color:#555555;\">" +
    (he ? "יש שאלה כבר עכשיו? אפשר להשיב למייל הזה או לחייג 02-568-1681."
        : "Have a question already? Reply to this email or call +972-2-568-1681.") +
    "</p>" + btn;
}

async function sendViaResend(msg) {
  var key = process.env.RESEND_API_KEY;
  if (!key) { console.error("[contact] RESEND_API_KEY not set"); return false; }
  try {
    var r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify(msg),
    });
    if (!r.ok) console.error("[contact] resend failed", r.status, await r.text());
    return r.ok;
  } catch (e) { console.error("[contact] resend error", e); return false; }
}

function emailOffice(d) {
  return sendViaResend({
    from: FROM_EMAIL, to: [TO_EMAIL], reply_to: d.email,
    subject: "פנייה חדשה מהאתר — " + d.name,
    html: brandedEmail("he", "פנייה חדשה מהאתר", officeBody(d)),
  });
}

function emailProspect(d) {
  var he = d.locale === "he";
  return sendViaResend({
    from: FROM_EMAIL, to: [d.email], reply_to: TO_EMAIL,
    subject: he ? "קיבלנו את הפנייה שלך — Kaufman Finance Group" : "We received your inquiry — Kaufman Finance Group",
    html: brandedEmail(d.locale,
      he ? "תודה, " + esc(d.name) + " — הפנייה שלך התקבלה" : "Thank you, " + esc(d.name) + " — we got your inquiry",
      confirmBody(d)),
  });
}

async function createLead(d) {
  var parts = d.name.split(/\s+/);
  var tag = d.locale === "he" ? "פנייה מטופס יצירת קשר באתר" : "Website contact form";
  try {
    var r = await fetch(SB_URL + "/rest/v1/rpc/submit_public_intake", {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: "Bearer " + SB_ANON, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_payload: {
          borrowers: [{ first_name: parts[0] || "—", last_name: parts.slice(1).join(" "), email: d.email, phone: "" }],
          request_details: "[" + tag + "] " + (d.subject ? d.subject + " — " : "") + d.message,
          consent: true,
          form_type: "contact",
          locale: d.locale,
        },
        p_policy_version: "2026-06",
        p_ip: d.ip || null,
      }),
    });
    if (!r.ok) console.error("[contact] lead RPC failed", r.status, await r.text());
    return r.ok;
  } catch (e) { console.error("[contact] lead RPC error", e); return false; }
}

// Best-effort client IP from the trusted Vercel edge. The first x-forwarded-for
// hop is the originating client. NOT authoritative (a request reaching the
// function off-edge can spoof it), but it throttles the common case — a bot
// reusing one address — and stamps the consent record's IP. Mirrors
// src/lib/http/request-ip.ts in the CRM.
function clientIp(req) {
  var xff = req.headers["x-forwarded-for"];
  if (xff) {
    var first = String(xff).split(",")[0].trim();
    if (first) return first;
  }
  return req.headers["x-real-ip"] || "unknown";
}

// Server-side per-IP rate limit (5/hour) via the anon-callable RPC from
// migration 165. This is the load-bearing brake: without it /api/contact is an
// open relay (emailProspect mails an attacker-supplied address from our verified
// domain) and a lead-flood door. FAIL-CLOSED — a public relay must not lose its
// brake on a DB blip; the page still shows phone / WhatsApp / office-email.
async function underRateLimit(subject) {
  try {
    var r = await fetch(SB_URL + "/rest/v1/rpc/consume_public_contact_rate_limit", {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: "Bearer " + SB_ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ p_subject: subject }),
    });
    if (!r.ok) { console.error("[contact] rate-limit RPC failed", r.status); return false; }
    return (await r.json()) === true;
  } catch (e) { console.error("[contact] rate-limit error", e); return false; }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ ok: false }); return; }
  var b = req.body || {};
  // honeypot: real users never fill this — pretend success for bots
  if (String(b.company || "").trim() !== "") { res.status(200).json({ ok: true }); return; }
  // timing trap (mirrors /check): a sub-2.5s fill is a script. The client also
  // drops these, but the server must not trust the client. Ack-and-drop like a bot.
  var elapsed = Number(b.elapsed_ms);
  if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 2500) { res.status(200).json({ ok: true }); return; }
  var name = String(b.name || "").trim().slice(0, 120);
  var email = String(b.email || "").trim().slice(0, 200);
  var subject = String(b.subject || "").trim().slice(0, 200);
  var message = String(b.message || "").trim().slice(0, 4000);
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { res.status(400).json({ ok: false }); return; }
  // Throttle BEFORE any email or lead so abuse never triggers a single send.
  var ip = clientIp(req);
  if (!(await underRateLimit("ip:" + ip))) { res.status(429).json({ ok: false }); return; }
  var d = { name: name, email: email, subject: subject, message: message, ip: ip, locale: b.locale === "he" ? "he" : "en" };
  var results = await Promise.all([emailOffice(d), createLead(d), emailProspect(d)]);
  res.status(results[0] || results[1] ? 200 : 502).json({ ok: results[0] || results[1] });
};
