'use client';

import type { SyntheticEvent } from 'react';

type Props = {
  src: string;
  className?: string;
};

function recoverMissingWebmDuration(event: SyntheticEvent<HTMLAudioElement>): void {
  const audio = event.currentTarget;
  if (Number.isFinite(audio.duration) && audio.duration > 0) return;

  // Older Chromium MediaRecorder uploads have no WebM Duration element. Seeking
  // to the end makes Chromium scan the clusters and derive a finite duration.
  audio.dataset.recoveringDuration = 'true';
  try {
    audio.currentTime = Number.MAX_SAFE_INTEGER;
  } catch {
    delete audio.dataset.recoveringDuration;
  }
}

function finishDurationRecovery(event: SyntheticEvent<HTMLAudioElement>): void {
  const audio = event.currentTarget;
  if (
    audio.dataset.recoveringDuration === 'true' &&
    Number.isFinite(audio.duration) &&
    audio.duration > 0
  ) {
    delete audio.dataset.recoveringDuration;
    audio.currentTime = 0;
  }
}

/** Native task voice-note player, shared by the inline row and preview fallback. */
export function TaskAudioPlayer({ src, className = 'w-full' }: Props) {
  return (
    <audio
      controls
      src={src}
      preload="metadata"
      className={className}
      onLoadedMetadata={recoverMissingWebmDuration}
      onDurationChange={finishDurationRecovery}
      onTimeUpdate={finishDurationRecovery}
    >
      <track kind="captions" />
    </audio>
  );
}
