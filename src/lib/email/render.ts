type RenderInput = {
  locale: 'he' | 'en';
  heading: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
  footer: string;
};

const BLACK = '#0A0A0A';
const GOLD = '#C9A961';

/**
 * Wraps email content in a minimal, brand-aligned HTML layout with inline
 * styles (email clients strip <style>/external CSS). Direction follows locale.
 */
export function renderBrandedEmail({ locale, heading, bodyHtml, cta, footer }: RenderInput): string {
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const align = locale === 'he' ? 'right' : 'left';

  const ctaHtml = cta
    ? `<tr><td style="padding:8px 0 4px;">
         <a href="${escapeAttr(cta.url)}" style="display:inline-block;background:${GOLD};color:${BLACK};text-decoration:none;font-weight:600;font-size:14px;padding:10px 22px;border-radius:8px;">${escapeHtml(cta.label)}</a>
       </td></tr>`
    : '';

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAFAFA;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid #E5E5E5;border-radius:12px;overflow:hidden;">
        <tr><td style="background:${BLACK};padding:18px 28px;">
          <span style="color:#FFFFFF;font-size:18px;font-weight:700;letter-spacing:1px;">KAUFMAN</span>
          <span style="color:${GOLD};font-size:11px;letter-spacing:2px;display:block;">FINANCE GROUP</span>
        </td></tr>
        <tr><td dir="${dir}" align="${align}" style="padding:28px;text-align:${align};">
          <h1 style="margin:0 0 14px;font-size:19px;color:${BLACK};">${escapeHtml(heading)}</h1>
          <div style="font-size:14px;line-height:1.6;color:#333333;">${bodyHtml}</div>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px;">${ctaHtml}</table>
        </td></tr>
        <tr><td dir="${dir}" align="${align}" style="background:#FAFAFA;border-top:1px solid #E5E5E5;padding:16px 28px;text-align:${align};">
          <span style="font-size:12px;color:#767676;">${escapeHtml(footer)}</span>
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
