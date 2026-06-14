/**
 * Client-email attachment limits. Lives in a server-free module so the
 * 'use client' attachments field can import these values without pulling the
 * service (which imports node:crypto + the Supabase server client) into the
 * browser bundle. Both the UI and the server enforce them.
 */

/** At most this many files per client email. */
export const MAX_ATTACHMENT_COUNT = 5;

/** Total attachment bytes per email — well under Resend's 40 MB ceiling. */
export const MAX_TOTAL_ATTACHMENT_BYTES = 15 * 1024 * 1024;
