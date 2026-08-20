/**
 * The office inbox. EMAIL_FROM is a noreply@ sender (it has to be — the
 * sending domain is Resend-authenticated and nobody reads it), so every
 * outgoing message needs an explicit Reply-To or a recipient hitting Reply
 * writes into a black hole. sendEmail applies this by default; callers with a
 * better answer (the advisor handling the case) pass their own.
 */
export const OFFICE_EMAIL = 'office@kaufman-finance.com';
