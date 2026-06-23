/**
 * Collapse rich-text HTML to readable plain text — for activity-log entries and
 * previews, where the stored email body should render as plain text rather than
 * raw markup. Block tags become newlines; entities are decoded. Not a sanitizer
 * (it strips all tags); pair it with the editor's HTML for actual rendering.
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
