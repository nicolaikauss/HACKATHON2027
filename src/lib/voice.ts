// Voice in and out, with the speech engines of the browser. No key and no server.
// Listening works in Chrome, Edge and Safari, on https or localhost. Typing always works.
import { useCallback, useEffect, useRef, useState } from 'react';

type Result = { isFinal: boolean; 0: { transcript: string } };
type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<Result> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type RecognitionClass = new () => Recognition;

const engine = (): RecognitionClass | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};
const synth = () => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null);

const ERRORS: Record<string, string> = {
  'not-allowed': 'The microphone is blocked. Allow it in the browser, or type.',
  'service-not-allowed': 'The microphone is blocked. Allow it in the browser, or type.',
  'audio-capture': 'No microphone was found. You can type.',
  network: 'Voice input did not connect. Use Chrome or Edge, or type.',
  'language-not-supported': 'Voice input does not support English here. You can type.',
};
const PREFERRED = [/Natural.*English \(United Kingdom\)/i, /Google UK English Female/i, /Natural.*English/i, /Samantha/i, /Google US English/i, /English/i];

function pickVoice(voices: SpeechSynthesisVoice[]) {
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  for (const want of PREFERRED) {
    const found = english.find((v) => want.test(v.name));
    if (found) return found;
  }
  return english[0] ?? null;
}

/** Amounts and keys, the way a person says them. */
const spoken = (text: string) => text.replace(/€(\d+)\.00\b/g, '$1 euros').replace(/€(\d+)\.(\d{2})\b/g, '$1 euros $2').replace(/\b([A-Z]{2})-([0-9A-F]{4})\b/g, (_, a: string, b: string) => `${a} ${b.split('').join(' ')}`).replace(/08:00 to 20:00/g, '8 to 20 hours');

export type VoiceState = 'idle' | 'listening' | 'speaking';

export function useVoice(onHeard: (text: string) => void) {
  const [state, setState] = useState<VoiceState>('idle');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const heard = useRef(onHeard);
  heard.current = onHeard;
  const mutedNow = useRef(muted);
  mutedNow.current = muted;
  // Each new sentence, and each interruption, gets a number. An older sentence that ends late does nothing.
  const turn = useRef(0);

  const quiet = useCallback(() => {
    turn.current += 1;
    synth()?.cancel();
    setState((s) => (s === 'speaking' ? 'idle' : s));
  }, []);

  const stop = useCallback(() => {
    rec.current?.abort();
    rec.current = null;
    setInterim('');
    setState((s) => (s === 'listening' ? 'idle' : s));
  }, []);

  const listen = useCallback(() => {
    const Engine = engine();
    if (!Engine) {
      setError('This browser has no voice input. Use Chrome or Edge, or type.');
      return;
    }
    turn.current += 1;
    synth()?.cancel();
    rec.current?.abort();
    const r = new Engine();
    rec.current = r;
    r.lang = 'en-GB';
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    let done = false;
    r.onresult = (e) => {
      let text = '';
      let final = false;
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        text += e.results[i][0].transcript;
        final ||= e.results[i].isFinal;
      }
      setInterim(text);
      if (final && text.trim() && !done) {
        done = true;
        setInterim('');
        setState('idle');
        heard.current(text.trim());
      }
    };
    r.onerror = (e) => {
      if (ERRORS[e.error]) setError(ERRORS[e.error]);
    };
    r.onend = () => {
      if (rec.current !== r) return;
      rec.current = null;
      setInterim('');
      setState((s) => (s === 'listening' ? 'idle' : s));
    };
    setError('');
    setInterim('');
    setState('listening');
    try { r.start(); } catch { setState('idle'); }
  }, []);

  /** Says the text, then calls `then`. When sound is off, `then` runs at once. */
  const speak = useCallback((text: string, then?: () => void) => {
    const s = synth();
    if (!s || mutedNow.current || !text) {
      then?.();
      return;
    }
    s.cancel();
    const mine = (turn.current += 1);
    const u = new SpeechSynthesisUtterance(spoken(text));
    const voice = pickVoice(s.getVoices());
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? 'en-GB';
    u.rate = 1.06;
    let ended = false;
    const end = () => {
      if (ended || mine !== turn.current) return;
      ended = true;
      setState((now) => (now === 'speaking' ? 'idle' : now));
      then?.();
    };
    u.onend = end;
    u.onerror = end;
    // Some browsers never report the end of a sentence. Then the agent would look busy for ever.
    window.setTimeout(end, 4000 + text.length * 95);
    setState('speaking');
    s.speak(u);
  }, []);

  useEffect(() => {
    synth()?.getVoices();
    return () => {
      rec.current?.abort();
      synth()?.cancel();
    };
  }, []);

  useEffect(() => {
    if (muted) quiet();
  }, [muted, quiet]);

  return { canListen: !!engine(), canSpeak: !!synth(), state, interim, error, muted, setMuted, listen, stop, speak, quiet };
}
