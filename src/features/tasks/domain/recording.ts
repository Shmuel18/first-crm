/**
 * Pure helpers + constants for task voice-note recordings. Deliberately free of
 * any Supabase / server import so it can be shared between a 'use client'
 * component (the recorder button) and the server upload action without pulling
 * server code into the browser bundle (a boundary violation that fails the
 * Turbopack build while tsc/lint pass — see the manage-banks memory).
 *
 * Recordings ride the general task-attachment path (task_attachments), never the
 * case-documents system, so audio stays scoped to tasks.
 */
import { ALLOWED_MIME_TYPES } from '@/features/documents/schemas/document.schema';

/** Base mime types the in-app recorder may declare (no codec suffix). */
export const RECORDING_DECLARED_MIME_TYPES = ['audio/webm', 'audio/mp4'] as const;

/**
 * What `file-type` v22 actually reports when it sniffs those recordings — an
 * audio-only WebM sniffs as `video/webm`, and a Safari `audio/mp4` sniffs as
 * `video/mp4` or `audio/x-m4a` depending on the ftyp brand. The finalize action
 * pairs this with the declared mime to accept a recording without loosening the
 * document allowlist.
 */
export const RECORDING_SNIFF_ACCEPT = ['video/webm', 'video/mp4', 'audio/x-m4a'] as const;

/** Client-side cap on a single recording. 20 min of opus/AAC stays well under 20MB. */
export const RECORDING_MAX_SECONDS = 20 * 60;

/** Max recordings that can be queued on one create-form submission. */
export const RECORDING_MAX_PER_TASK = 3;

/** Strip a codec suffix: `audio/webm;codecs=opus` → `audio/webm`. */
export function stripCodecSuffix(mime: string): string {
  const semi = mime.indexOf(';');
  return (semi === -1 ? mime : mime.slice(0, semi)).trim().toLowerCase();
}

/** True when the (suffix-stripped) mime is one our recorder declares. */
export function isRecordingDeclaredMime(mime: string): boolean {
  return (RECORDING_DECLARED_MIME_TYPES as readonly string[]).includes(stripCodecSuffix(mime));
}

/** File extension for a declared recording mime. */
export function recordingExtension(mime: string): 'webm' | 'm4a' {
  return stripCodecSuffix(mime) === 'audio/mp4' ? 'm4a' : 'webm';
}

/** Whether a stored mime should render with the audio player / mic icon. */
export function isAudioMime(mime: string | null): boolean {
  return mime?.startsWith('audio/') ?? false;
}

/** Whether a client-declared mime is an allowed upload — a document type or a recording. */
export function isAcceptedDeclaredMime(mime: string): boolean {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime) || isRecordingDeclaredMime(mime);
}

/**
 * Resolve the mime to persist + hand to Drive, given what the client declared and
 * what the magic-byte sniff found. Documents keep the sniffed mime (authoritative).
 * Recordings sniff as a video/* container (audio-only webm/mp4) — when the client
 * declared a recording mime AND the sniff is one of the accepted containers, we
 * trust the declared audio type so playback detection (audio/*) works. Returns
 * null when neither path accepts the file.
 */
export function resolveStoredMime(declaredMime: string, sniffedMime: string): string | null {
  if ((ALLOWED_MIME_TYPES as readonly string[]).includes(sniffedMime)) return sniffedMime;
  if (
    isRecordingDeclaredMime(declaredMime) &&
    (RECORDING_SNIFF_ACCEPT as readonly string[]).includes(sniffedMime)
  ) {
    return stripCodecSuffix(declaredMime);
  }
  return null;
}

/** Two-digit zero pad for the timestamped file name. */
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Human file name for a recording, e.g. `הקלטה 2026-07-14 09-32.webm`. No colons
 * (sanitizeFilename would rewrite them to `_`). The "הקלטה" prefix is Hebrew data
 * baked into the stored file name, not a UI string — same convention as the
 * checklist preset labels.
 */
export function recordingFileName(mime: string, now: Date): string {
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    ` ${pad(now.getHours())}-${pad(now.getMinutes())}`;
  return `הקלטה ${stamp}.${recordingExtension(mime)}`;
}
