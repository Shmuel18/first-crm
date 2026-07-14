# Spec: Voice-note recordings on tasks (הקלטות קוליות במשימות)

**Status:** approved for build · **Author:** spec session 2026-07-14 · **No DB migration required.**

## 1. Goal

Kaufman (the client) works by voice notes. Let a user record a voice note with the
microphone and attach it to a task — both when **creating** a task and on an
**existing** task — and play it back inline from the task dialog.

### Product decisions (already made — do not relitigate)
1. Record button appears in **both** the create form and the edit dialog of an existing task.
2. Audio is allowed **only on the task-attachment path**. Audio must **never** enter the
   case-documents system (`documents` table / `case-documents` bucket / case Drive folder).

### Non-goals (v1)
- No transcription.
- No audio uploads via the regular file picker (recordings come only from the in-app recorder).
- No audio on case documents, borrower documents, or anywhere else.
- No waveform UI; render a plain inline `<audio controls>` player directly in
  the task attachment row (no preview/eye click for recordings).
- Normalize Chrome/Chromium WebM duration metadata before upload so the remote
  `<audio>` player receives a finite duration and remains playable/seekable.
- Keep a player-side duration recovery for WebM recordings uploaded before that
  normalization was introduced.
- The CSP must allow `media-src` from the app origin, `blob:`, and the scoped
  Supabase Storage host pattern used by signed recording URLs.

## 2. Architecture decision — recordings ALWAYS use the general task store

Today, task attachments route by case linkage (`src/features/tasks/components/upload-task-attachments.ts`):
- **Case-linked task** → `prepareTaskAttachmentUploadAction` → row in `documents`, blob in
  `case-documents` bucket, Drive copy in the case folder. (This is the case-documents system.)
- **Case-less task** → `prepareGeneralTaskAttachmentAction` → row in `task_attachments`, blob in
  `task-documents` bucket, Drive copy in the standalone "מסמכים כלליים" folder.

**Voice recordings always take the general path (`task_attachments`), even when the task is
linked to a case.** This is what enforces decision #2 with zero changes to the documents feature.

This is safe because migration `157_task_attachments.sql` gates everything on
`can_view_task(task_id)` only — it does **not** require the task to be case-less. The
`task-documents` storage bucket path is `<task_id>/<attachment_id>.<ext>` and its RLS casts
segment 1 to a **task** uuid, so case-linked task ids work as-is. `TaskAttachmentsList`
already merges both sources into one list, so a recording on a case-linked task shows up
next to the case-doc attachments naturally.

Accepted consequence (by design): a recording made on a case-linked task lands in the
standalone Drive "general documents" folder, not the case's Drive folder, and does not appear
on the case's Documents page. That is exactly what "audio only for tasks" means.

**Do NOT touch** `src/features/tasks/actions/task-attachment-upload.ts` (the case path) or
`ALLOWED_MIME_TYPES` in `src/features/documents/schemas/document.schema.ts`. Both stay
audio-free.

## 3. Critical technical facts (verified in this repo — build on these)

### 3.1 Server-side MIME sniffing will NOT report `audio/*` for recordings
`finalizeGeneralTaskAttachmentAction` sniffs magic bytes with `file-type` v22 and rejects
anything whose **sniffed** mime is off-allowlist. Verified in
`node_modules/file-type/source/`:
- Audio-only WebM (Chrome/Android/Firefox `MediaRecorder`) sniffs as **`video/webm`**
  (`detectors/ebml.js` maps DocType `webm` → `video/webm` unconditionally).
- MP4/AAC (iOS/macOS Safari `MediaRecorder`, `audio/mp4`): ftyp brand `M4A ` →
  **`audio/x-m4a`**; any other brand falls through to **`video/mp4`** (`index.js` ~line 1280).

So the finalize action needs TWO lists:
- **Declared-mime accept** (what the client claims): `audio/webm`, `audio/mp4` (plus
  codec-suffixed forms — strip `;codecs=...` before comparing).
- **Sniff accept** (what file-type will actually report for those containers):
  `video/webm`, `video/mp4`, `audio/x-m4a`.

And it must store an **effective mime**: when the client declared `audio/*` and the sniffed
container is one of the accepted ones, persist the declared base type (`audio/webm` /
`audio/mp4`) in `task_attachments.mime_type` — playback detection is
`mime_type.startsWith('audio/')` and would break if we stored `video/webm`.

Security note: container sniffing cannot distinguish audio-only mp4/webm from video. Worst
case someone hand-crafts a video upload through the recording action — it is size-capped
(20 MB), task-scoped, RLS-guarded, and plays in an `<audio>` element as sound only.
Acceptable; do not try to parse tracks.

### 3.2 Client/server module boundary (repo gotcha — has broken prod builds before)
A `'use client'` file importing a **value** from a module that (transitively) imports
`@/lib/supabase/server` pulls server code into the browser bundle → **Turbopack build fails
while tsc and lint pass**. New shared constants/helpers for recording MUST live in a
server-free module (see 4.1), and you MUST run `npm run build` before pushing.

### 3.3 Existing plumbing you reuse unchanged
- Two-phase upload: `prepare*` (signed upload URL) → client `PUT` → `finalize*` (sniff +
  insert + Drive copy). Client helper pattern in `upload-task-attachments.ts`.
- Rate limit: `prepare_general_task_attachment`, 120/min per user, fail-closed — plenty for
  recordings; reuse as-is.
- Permission: server enforces `upload_document` + `can_view_task`. UI does not pre-gate
  (consistent with the existing attachments field).
- Delete: `deleteTaskAttachmentAction` already handles general attachments (uploader or
  admin) — recordings get delete for free.
- `sanitizeFilename` keeps Hebrew (NFC, strips control/bidi/`\/:*?"<>|`) — Hebrew file names
  are fine.

## 4. Changes by file

### 4.1 NEW `src/features/tasks/domain/recording.ts` (server-free — no supabase imports)
Pure constants + helpers, importable from both client components and server actions:

```ts
/** Declared mimes the recorder may produce (base types, no codec suffix). */
export const RECORDING_DECLARED_MIME_TYPES = ['audio/webm', 'audio/mp4'] as const;

/** What file-type v22 reports for those containers (audio-only webm sniffs as
 *  video/webm; Safari mp4 sniffs as video/mp4 or audio/x-m4a by ftyp brand). */
export const RECORDING_SNIFF_ACCEPT = ['video/webm', 'video/mp4', 'audio/x-m4a'] as const;

/** Hard client-side cap; 20 min of opus/AAC stays far below the 20 MB limit. */
export const RECORDING_MAX_SECONDS = 20 * 60;

export function stripCodecSuffix(mime: string): string; // 'audio/webm;codecs=opus' → 'audio/webm'
export function isRecordingDeclaredMime(mime: string): boolean; // after stripping suffix
export function recordingExtension(mime: string): 'webm' | 'm4a'; // audio/mp4 → m4a
export function recordingFileName(mime: string, now: Date): string;
// e.g. 'הקלטה 2026-07-14 09-32.webm' — no colons (sanitizeFilename strips them to '_')
export function isAudioMime(mime: string | null): boolean; // mime?.startsWith('audio/')
```

Keep each function tiny (≤30-line utility rule). Explicit return types.

### 4.2 NEW `src/features/tasks/components/voice-recorder-button.tsx` (`'use client'`, ≤250 lines)
One self-contained component:

- Props: `{ disabled?: boolean; onRecordingReady: (file: File) => void }`.
- Idle state: a button with the `Mic` lucide icon + label `t('fields.recordVoice')`.
- On click: `navigator.mediaDevices.getUserMedia({ audio: true })`; pick mime with the first
  supported of `['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']` via
  `MediaRecorder.isTypeSupported` (Safari supports only `audio/mp4`; construct with no
  mimeType option as last resort and read `recorder.mimeType`).
- Recording state: red pulsing dot + running `mm:ss` timer + stop button (`Square` icon) +
  cancel button (`X`, discards). Auto-stop at `RECORDING_MAX_SECONDS`.
- On stop: assemble `new File(chunks, recordingFileName(mime, new Date()), { type: stripCodecSuffix(recorder.mimeType) })`
  and call `onRecordingReady(file)`.
- **Always** `stream.getTracks().forEach(t => t.stop())` on stop/cancel/unmount — otherwise
  the browser mic indicator stays on.
- Error handling: `NotAllowedError`/`NotFoundError` → inline error text
  `t('fields.recordMicDenied')`; unsupported `MediaRecorder` (undefined) → hide the button
  entirely (feature-detect on mount to avoid hydration mismatch: render after `useEffect`).
- RTL-safe layout (flex + logical gaps, no hard left/right), Heebo text, brand tokens only.

### 4.3 NEW `src/features/tasks/components/upload-task-recordings.ts`
Mirror of `upload-task-attachments.ts` but **always** the general path, ignoring caseId:

```ts
export async function runTaskRecordingUploads(taskId: string, files: File[]): Promise<void>
```
Loop: `prepareGeneralTaskAttachmentAction` → `PUT` blob (same `putBlob` shape) →
`finalizeGeneralTaskAttachmentAction`. Throws first failure (caller maps codes like the
existing `mapAttachmentError`).

### 4.4 MODIFY `src/features/tasks/actions/task-general-attachment-upload.ts`
Keep it under the 100-line action budget by moving list logic into `domain/recording.ts`.

- `prepareGeneralTaskAttachmentAction`: declared-mime check becomes
  `ALLOWED_MIME_TYPES.includes(mime) || isRecordingDeclaredMime(mime)`.
- `finalizeGeneralTaskAttachmentAction` needs the declared mime to compute the effective
  stored type — **add `mimeType: string` to its input** (client already knows it; it is
  advisory only, the sniff stays authoritative):
  - Accept when `sniffed.mime` ∈ `ALLOWED_MIME_TYPES` (existing behavior), OR
    (`isRecordingDeclaredMime(input.mimeType)` AND `sniffed.mime` ∈ `RECORDING_SNIFF_ACCEPT`).
  - Effective mime for the DB row **and** the Drive upload call: the declared
    `audio/webm`/`audio/mp4` in the recording case, `sniffed.mime` otherwise.
- Update the one existing caller (`upload-task-attachments.ts` general branch) to pass
  `mimeType: file.type`.

### 4.5 MODIFY `src/features/tasks/components/task-form-dialog.tsx`
**Create mode:**
- New state `recordings: File[]` — separate from `attachments` because routing differs
  (attachments follow caseId; recordings always general). Cap: 3 recordings.
- Render `<VoiceRecorderButton onRecordingReady={f => setRecordings(prev => [...prev, f])}>`
  inside/next to the attachments `FormField`; list pending recordings with name + remove (X).
- In the post-create success flow (where `runTaskAttachmentUploads` runs): also
  `await runTaskRecordingUploads(newTaskId, recordings)`; reuse
  `attachmentPending`/`attachmentError` for progress/error UX.
- Reset `recordings` in `resetAttachmentState`.
- React 19 gotcha (repo memory): `<form action>` auto-resets — recordings live in controlled
  state, not form fields, so they survive; still clear them on success like attachments.

**Edit mode:**
- Render `VoiceRecorderButton` above `TaskAttachmentsList`. On `onRecordingReady`, upload
  immediately via `runTaskRecordingUploads(task.id, [file])` with a local pending indicator,
  then bump a `reloadToken` passed to the list (4.6). Errors → toast (`sonner`), like the
  list's own actions.

Watch the 250-line component cap — `task-form-dialog.tsx` is already near it; extract the
recordings sub-UI (pending list + recorder + upload glue) into a small co-located component
(e.g. `task-recordings-field.tsx`) rather than inflating the dialog.

### 4.6 MODIFY `src/features/tasks/components/task-attachments-list.tsx`
- Accept optional `reloadToken?: number`; add to the fetch `useEffect` deps so edit-mode
  uploads refresh the list.
- Icon: `isAudioMime(item.mimeType)` → `Mic` (or `AudioLines`) icon instead of `FileText`.
- The Eye/preview button works unchanged (signed URL via `getTaskAttachmentUrlAction`).

### 4.7 MODIFY `src/features/tasks/components/task-doc-preview-dialog.tsx`
- `const isAudio = isAudioMime(mimeType)`.
- When `isAudio`, render `<audio controls src={url} className="w-full" preload="metadata">`
  instead of `DocumentPreviewBody` (audio stays tasks-only — do not touch the shared
  documents preview body). Keep the existing Drive/download links row.

### 4.8 i18n — `src/messages/he.json` + `src/messages/en.json`
Add under `tasks.form.fields` (final naming up to builder, both languages required):

| key | he | en |
|---|---|---|
| `recordVoice` | הקלטת תזכורת קולית | Record voice note |
| `recordStop` | סיום הקלטה | Stop recording |
| `recordCancel` | ביטול הקלטה | Cancel recording |
| `recordMicDenied` | אין גישה למיקרופון — בדקו את הרשאות הדפדפן | Microphone unavailable — check browser permissions |
| `recordTooMany` | אפשר לצרף עד 3 הקלטות | Up to 3 recordings per task |
| `recordingPendingName` | הקלטה מוכנה לצירוף | Recording ready to attach |

File-name prefix "הקלטה" is DATA (goes into the stored file name), hardcode it in
`recordingFileName` — same convention as checklist labels.

## 5. What does NOT change
- No migration; no schema/RLS/bucket changes (bucket has no MIME restriction; RLS already
  covers any visible task).
- `task-attachment-upload.ts` (case path), `document.schema.ts`, `DocumentPreviewBody`,
  Drive uploaders, delete action, rate-limit config — untouched.
- The finalize action's awaited Drive upload stays awaited for now (it runs post-create
  behind the attachments spinner, not on the primary submit path). Do not convert to
  `after()` in this change.

## 6. Verification (Definition of Done)
1. `npx tsc --noEmit`, `npm run lint`, **`npm run build`** (boundary gotcha 3.2) — all green.
2. Manual, Chrome desktop: create task WITH case + recording → task saves; recording listed
   with mic icon; plays in the preview dialog; **case Documents page does NOT show it**;
   `documents` table untouched (no new row), `task_attachments` has the row with
   `mime_type='audio/webm'`.
3. Manual: case-less task + recording → same, Drive copy lands in the general folder (if
   Drive is connected on the env; best-effort otherwise).
4. Manual: edit an existing task → record → list refreshes without reopening; delete works.
5. Mic permission denied → inline translated error, no crash, no stuck mic indicator.
6. Regression: plain PDF/image attachments still upload on both case-linked and case-less
   tasks (declared/sniff changes must not break the existing types).
7. RTL (he) + LTR (en), mobile ≤768px: recorder controls and `<audio>` player fit and align.
8. Cannot fully verify iOS Safari locally — code the `audio/mp4` path per 3.1/4.2 and note
   it for on-device QA on staging (http://104.207.131.136:3747).

## 7. Commit
`feat(tasks): voice-note recordings on tasks (create + edit), audio scoped to task attachments`
— conventional commits, split if natural (domain+actions / UI).
