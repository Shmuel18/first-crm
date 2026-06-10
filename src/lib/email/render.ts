type RenderInput = {
  locale: 'he' | 'en';
  heading: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
  footer: string;
};

const BLACK = '#0A0A0A';
const GOLD = '#C9A961';
const GOLD_TEXT = '#8A6E2D';
const LOGO_URL = 'https://kaufman-finance.com/assets/logo-coin-square.png';

/**
 * Wraps email content in a brand-aligned HTML layout with inline styles
 * (email clients strip <style>/external CSS). Direction follows locale.
 * Layout: black header with the coin logo + wordmark, a gold divider,
 * the content card, and a footer with the office contact line.
 */
export function renderBrandedEmail({ locale, heading, bodyHtml, cta, footer }: RenderInput): string {
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const align = locale === 'he' ? 'right' : 'left';

  const ctaHtml = cta
    ? `<tr><td style="padding:18px 0 4px;">
         <a href="${escapeAttr(cta.url)}" style="display:inline-block;background:${GOLD};color:${BLACK};text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:999px;">${escapeHtml(cta.label)}</a>
       </td></tr>`
    : '';

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF8F3;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF8F3;padding:28px 0;">
    <tr><td align="center" style="padding:0 12px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid #E5E5E5;border-radius:14px;overflow:hidden;">
        <tr><td align="center" style="background:${BLACK};padding:28px 28px 22px;">
          <img src="${LOGO_URL}" width="56" height="56" alt="Kaufman Finance Group" style="display:block;margin:0 auto 12px;border:0;outline:none;">
          <span style="color:#FFFFFF;font-size:20px;font-weight:700;letter-spacing:4px;font-family:Georgia,'Times New Roman',serif;">KAUFMAN</span>
          <span style="color:${GOLD};font-size:11px;letter-spacing:4px;display:block;margin-top:4px;">FINANCE GROUP</span>
        </td></tr>
        <tr><td style="height:3px;background:${GOLD};background-image:linear-gradient(90deg,#B8945A,#E8C77B,#B8945A);font-size:0;line-height:3px;">&nbsp;</td></tr>
        <tr><td dir="${dir}" align="${align}" style="padding:30px 32px;text-align:${align};">
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${BLACK};font-family:Georgia,'Times New Roman',serif;">${escapeHtml(heading)}</h1>
          <div style="font-size:14px;line-height:1.7;color:#333333;">${bodyHtml}</div>
          <table role="presentation" cellpadding="0" cellspacing="0">${ctaHtml}</table>
        </td></tr>
        <tr><td dir="${dir}" align="${align}" style="background:#FAF8F3;border-top:1px solid #E5E5E5;padding:18px 32px;text-align:${align};">
          <span style="font-size:13px;color:${GOLD_TEXT};font-weight:600;">Kaufman Finance Group</span><br>
          <span style="font-size:12px;color:#767676;line-height:1.8;">
            <a href="tel:+97225681681" style="color:#767676;text-decoration:none;" dir="ltr">02-568-1681</a>
            &nbsp;&middot;&nbsp;
            <a href="mailto:office@kaufman-finance.com" style="color:#767676;text-decoration:none;">office@kaufman-finance.com</a>
            &nbsp;&middot;&nbsp;
            <a href="https://kaufman-finance.com" style="color:${GOLD_TEXT};text-decoration:none;">kaufman-finance.com</a>
          </span><br>
          <span style="font-size:11px;color:#9B9B9B;">${escapeHtml(footer)}</span>
        </td></tr>
      </table>
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
