/**
 * Client-email attachment limits. Lives in a server-free module so the
 * 'use client' attachments field can import these values without pulling the
 * service (which imports node:crypto + the Supabase server client) into the
 * browser bundle. Both the UI and the server enforce them.
 */

/**
 * At most this many files per email. Not a protocol limit — a guard against a
 * runaway selection. Sending a document set to a banker is routinely 10-15
 * small files (a year of payslips), so the cap sits above that; the byte
 * ceiling below is what actually bounds a send.
 */
export const MAX_ATTACHMENT_COUNT = 20;

/**
 * Total attachment bytes per email. The binding constraint is the RECEIVING
 * mailbox, not Resend's 40 MB: attachments travel base64-encoded (~+33%), so
 * 15 MB of files leave as ~20 MB — under Gmail's 25 MB and under the 20 MB
 * Exchange default many banks run. Raising this makes sends that succeed on
 * our side bounce on theirs, which reads to the advisor as "sent". Past this,
 * the Drive-folder link is the intended path.
 */
export const MAX_TOTAL_ATTACHMENT_BYTES = 15 * 1024 * 1024;
