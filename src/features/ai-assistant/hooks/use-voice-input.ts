'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useLocale } from 'next-intl';

/**
 * Voice dictation for the assistant composer (Web Speech API). One utterance
 * per tap: tap to listen, speak, the transcript lands in the input for the
 * user to REVIEW AND SEND — never auto-sent (same discipline as
 * propose-and-confirm). Hebrew/English per the active locale.
 *
 * `supported` is false when the API is missing OR the page isn't a secure
 * context (browsers gate the mic behind HTTPS/localhost) — callers hide the
 * button entirely rather than showing a dead control.
 */

// The Web Speech API has no lib.dom typings yet — minimal local contract.
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechResultEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechResultEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined' || !window.isSecureContext) return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoiceInput(onTranscript: (text: string) => void) {
  const locale = useLocale();
  // Lazy init is hydration-safe here: the composer mounts only after the
  // user OPENS the panel (client-side), so this never renders during SSR.
  const [supported] = useState(() => getRecognitionCtor() !== null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Abort any in-flight recognition when the composer unmounts.
  useEffect(() => () => recognitionRef.current?.abort(), []);

  const stop = useCallback((): void => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const toggle = useCallback((): void => {
    if (listening) {
      stop();
      return;
    }
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = locale === 'en' ? 'en-US' : 'he-IL';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) onTranscript(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [listening, locale, onTranscript, stop]);

  return { supported, listening, toggle };
}
