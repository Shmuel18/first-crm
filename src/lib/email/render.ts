type RenderInput = {
  locale: 'he' | 'en';
  heading: string;
  /**
   * PRE-ESCAPED HTML ONLY. This string is interpolated RAW into the email
   * body — the escape contract lives with the caller. Build it exclusively
   * from escapeHtml()-based helpers (plainTextBodyHtml / textToHtml /
   * escaped table cells); never pass user-controlled text directly.
   */
  bodyHtml: string;
  cta?: { label: string; url: string };
  footer: string;
};

// CTA links must be real navigable URLs. Anything else (javascript:, data:,
// protocol-relative) drops the button entirely — better a missing CTA than a
// dangerous href if a future caller ever forwards user-controlled input.
const SAFE_CTA_URL = /^(https?:\/\/|mailto:|tel:)/i;

const BLACK = '#0A0A0A';
const GOLD = '#C9A961';
const GOLD_TEXT = '#8A6E2D';
const INK = '#3A3A3A';
const LOGO_URL = 'https://kaufman-finance.com/assets/logo-coin-square.png';

/**
 * Wraps email content in a brand-aligned HTML layout with inline styles
 * (email clients strip <style>/external CSS). Direction follows locale.
 * Layout: black header with the coin logo + serif wordmark, a gold divider,
 * a generously-padded content card with a gold accent bar under the heading,
 * and a warm footer with the office contact line. Table-based + solid-color
 * fallbacks so Outlook renders it too.
 */
export function renderBrandedEmail({ locale, heading, bodyHtml, cta, footer }: RenderInput): string {
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const align = locale === 'he' ? 'right' : 'left';

  const ctaSafe = cta && SAFE_CTA_URL.test(cta.url) ? cta : undefined;
  if (cta && !ctaSafe) {
    console.error('[renderBrandedEmail] dropped CTA with unsafe URL scheme');
  }
  const ctaHtml = ctaSafe
    ? `<tr><td style="padding:24px 0 4px;">
         <a href="${escapeAttr(ctaSafe.url)}" style="display:inline-block;background:${GOLD};color:${BLACK};text-decoration:none;font-weight:700;font-size:14px;letter-spacing:.3px;padding:13px 32px;border-radius:999px;">${escapeHtml(ctaSafe.label)}</a>
       </td></tr>`
    : '';

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3EEE3;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3EEE3;padding:36px 0;">
    <tr><td align="center" style="padding:0 12px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid #E8E1D0;border-radius:18px;overflow:hidden;">

        <tr><td align="center" style="background:${BLACK};padding:34px 28px 26px;">
          <img src="${LOGO_URL}" width="64" height="64" alt="Kaufman Finance Group" style="display:block;margin:0 auto;border:0;outline:none;">
          <div style="color:#FFFFFF;font-size:22px;font-weight:700;letter-spacing:6px;font-family:Georgia,'Times New Roman',serif;margin-top:14px;">KAUFMAN</div>
          <div style="color:${GOLD};font-size:10px;letter-spacing:5px;margin-top:6px;">FINANCE&nbsp;GROUP</div>
        </td></tr>
        <tr><td style="height:3px;background:${GOLD};background-image:linear-gradient(90deg,#B8945A,#E8C77B,#B8945A);font-size:0;line-height:3px;">&nbsp;</td></tr>

        <tr><td dir="${dir}" align="${align}" style="padding:36px 34px;text-align:${align};">
          <h1 style="margin:0 0 10px;font-size:23px;line-height:1.3;color:${BLACK};font-family:Georgia,'Times New Roman',serif;font-weight:700;">${escapeHtml(heading)}</h1>
          <table role="presentation" cellpadding="0" cellspacing="0" align="${align}" style="margin:0 0 22px;"><tr>
            <td width="44" style="height:3px;background:${GOLD};border-radius:2px;font-size:0;line-height:3px;">&nbsp;</td>
          </tr></table>
          <div style="font-size:15px;line-height:1.75;color:${INK};clear:both;">${bodyHtml}</div>
          <table role="presentation" cellpadding="0" cellspacing="0">${ctaHtml}</table>
        </td></tr>

        <tr><td dir="${dir}" align="${align}" style="background:#FAF8F3;border-top:1px solid #EFE7D5;padding:24px 34px;text-align:${align};">
          <div style="font-size:15px;color:${GOLD_TEXT};font-weight:700;font-family:Georgia,'Times New Roman',serif;">Kaufman Finance Group</div>
          <div style="font-size:12px;color:#767676;line-height:1.9;margin-top:4px;">
            <a href="tel:+97225681681" style="color:#767676;text-decoration:none;" dir="ltr">02-568-1681</a>
            &nbsp;&middot;&nbsp;
            <a href="mailto:office@kaufman-finance.com" style="color:#767676;text-decoration:none;">office@kaufman-finance.com</a>
            &nbsp;&middot;&nbsp;
            <a href="https://kaufman-finance.com" style="color:${GOLD_TEXT};text-decoration:none;font-weight:600;">kaufman-finance.com</a>
          </div>
          <div style="font-size:11px;color:#A8A29A;margin-top:8px;">${escapeHtml(footer)}</div>
        </td></tr>

      </table>
      <div style="font-size:11px;color:#B5AD9E;margin-top:14px;">&copy; Kaufman Finance Group</div>
    </td></tr>
  </table>
</body></html>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;');
}
