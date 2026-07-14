'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { Mic, Square, X } from 'lucide-react';
import fixWebmDuration from 'fix-webm-duration';
import { useTranslations } from 'next-intl';

import { RECORDING_MAX_SECONDS, recordingFileName, stripCodecSuffix } from '../domain/recording';

type Props = {
  disabled?: boolean;
  onRecordingReady: (file: File) => void;
};

/** Preferred recorder mimes in order; Safari only supports audio/mp4. */
const PREFERRED_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'] as const;

function pickSupportedMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  for (const mime of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return undefined; // let the browser choose its default
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const noopSubscribe = (): (() => void) => () => undefined;
const isRecorderSupported = (): boolean =>
  typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

/** Feature-detect the recorder client-side without a hydration mismatch: the
 *  server snapshot is always false, the client reads the real capability. */
function useRecorderSupported(): boolean {
  return useSyncExternalStore(noopSubscribe, isRecorderSupported, () => false);
}

/**
 * Record a voice note with the microphone and hand the finished audio to the
 * caller as a File. Self-contained: owns the MediaRecorder, the stream lifecycle
 * (always stops tracks so the browser mic indicator clears), a live mm:ss timer,
 * and an auto-stop at RECORDING_MAX_SECONDS. Feature-detected after mount to avoid
 * a hydration mismatch — renders nothing where MediaRecorder is unavailable.
 */
export function VoiceRecorderButton({ disabled, onRecordingReady }: Props) {
  const t = useTranslations('tasks.form.fields');
  const supported = useRecorderSupported();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  const cleanup = useCallback((): void => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    setElapsed(0);
  }, []);

  // Stop tracks if the component unmounts mid-recording (dialog closed).
  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback((cancel: boolean): void => {
    cancelledRef.current = cancel;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop(); // fires onstop → assembles the file (unless cancelled)
    } else {
      cleanup();
    }
  }, [cleanup]);

  const start = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      cancelledRef.current = false;
      chunksRef.current = [];

      const mime = pickSupportedMime();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const wasCancelled = cancelledRef.current;
        const type = stripCodecSuffix(recorder.mimeType || mime || 'audio/webm');
        const blob = new Blob(chunksRef.current, { type });
        const durationMs = Math.max(1, performance.now() - startedAtRef.current);
        cleanup();
        if (!wasCancelled && blob.size > 0) {
          // Chromium's MediaRecorder omits WebM Duration metadata. A remote
          // <audio> element can then report 0:00 and refuse to seek/play even
          // though the Opus frames are intact. Patch only WebM; Safari's MP4
          // output already carries its own duration metadata.
          let playableBlob = blob;
          if (type === 'audio/webm') {
            try {
              playableBlob = await fixWebmDuration(blob, durationMs, { logger: false });
            } catch {
              // Preserve the recording if metadata repair ever fails.
            }
          }
          onRecordingReady(
            new File([playableBlob], recordingFileName(type, new Date()), { type }),
          );
        }
      };

      recorder.start();
      startedAtRef.current = performance.now();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (next >= RECORDING_MAX_SECONDS) stop(false);
          return next;
        });
      }, 1000);
    } catch {
      cleanup();
      setError(t('recordMicDenied'));
    }
  }, [cleanup, onRecordingReady, stop, t]);

  if (!supported) return null;

  if (recording) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2">
        <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-rose-500" aria-hidden="true" />
        <span className="flex-1 font-mono text-sm tabular-nums text-rose-700">
          {formatElapsed(elapsed)}
        </span>
        <button
          type="button"
          onClick={() => stop(false)}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-gold px-2.5 py-1 text-xs font-semibold text-brand-black transition hover:bg-brand-gold-hover"
        >
          <Square className="size-3.5" aria-hidden="true" />
          {t('recordStop')}
        </button>
        <button
          type="button"
          onClick={() => stop(true)}
          aria-label={t('recordCancel')}
          className="flex size-7 items-center justify-center rounded-md text-neutral-500 transition hover:bg-white hover:text-rose-600"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void start()}
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 transition hover:border-brand-gold-text hover:bg-brand-gold/8 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/30"
      >
        <Mic className="size-4 shrink-0 text-brand-gold-text" aria-hidden="true" />
        {t('recordVoice')}
      </button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
