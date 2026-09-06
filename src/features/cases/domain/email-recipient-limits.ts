/**
 * Ceiling on how many borrowers one client email may be addressed to. A case
 * carries a handful of people at most; the cap exists so a crafted payload
 * can't turn one send into a bulk mailing.
 */
export const MAX_EMAIL_RECIPIENTS = 10;
