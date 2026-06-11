/**
 * Mask an email for server-side logs: keep 2 chars of the local part and the
 * domain ("ud***@gmail.com") — enough to correlate support tickets without
 * writing the full address into log lines.
 */
export function emailMask(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return 'unparseable';
  return `${user.slice(0, 2)}***@${domain}`;
}
