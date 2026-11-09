// Generates the video's sound bed from code: a warm pad plus interface ticks at key moments.
import { writeFileSync, mkdirSync } from 'node:fs';

const RATE = 44100;
const LENGTH = 185;
const N = RATE * LENGTH;
const mix = new Float32Array(N * 2);

const midi = (m) => 440 * 2 ** ((m - 69) / 12);

// A slow, unresolved progression; it opens up when the product appears.
const CHORDS = [
  [45, 52, 60, 64, 71],
  [41, 53, 60, 64, 69],
  [48, 55, 62, 64, 71],
  [43, 55, 59, 62, 69],
];
const BAR = 12;

for (let c = 0; c * BAR < LENGTH; c += 1) {
  const chord = CHORDS[c % CHORDS.length];
  const t0 = c * BAR;
  const dur = BAR + 5;
  for (const [v, note] of chord.entries()) {
    const f = midi(note);
    const detune = 1 + (v % 2 ? 0.0016 : -0.0016);
    const start = Math.floor(t0 * RATE);
    const end = Math.min(N, Math.floor((t0 + dur) * RATE));
    for (let i = start; i < end; i += 1) {
      const t = (i - start) / RATE;
      const abs = i / RATE;
      const env = Math.min(1, t / 3.5) * Math.min(1, (dur - t) / 4.5);
      const bright = abs > 63 ? 0.32 : 0.13;
      const s =
        Math.sin(2 * Math.PI * f * t) +
        bright * Math.sin(2 * Math.PI * f * 2 * detune * t) +
        bright * 0.4 * Math.sin(2 * Math.PI * f * 3 * t);
      const pan = 0.5 + 0.35 * Math.sin(v * 1.7 + abs * 0.15);
      const gain = 0.03 * env * (note < 50 ? 1.2 : 0.8);
      mix[i * 2] += s * gain * (1 - pan);
      mix[i * 2 + 1] += s * gain * pan;
    }
  }
}

function event(at, { f, dur, gain, drop = 0 }) {
  const start = Math.floor(at * RATE);
  const len = Math.floor(dur * RATE);
  let phase = 0;
  for (let i = 0; i < len && start + i < N; i += 1) {
    const t = i / RATE;
    const freq = f * (1 - (drop * t) / dur);
    phase += (2 * Math.PI * freq) / RATE;
    const env = Math.min(1, t / 0.003) * Math.exp((-5 * t) / dur);
    const s = Math.sin(phase) * env * gain;
    mix[(start + i) * 2] += s;
    mix[(start + i) * 2 + 1] += s;
  }
}

const DEMO = 70;
const tick = (t) => event(t, { f: 1500, dur: 0.05, gain: 0.16 });
const thud = (t) => event(t, { f: 120, dur: 0.5, gain: 0.5, drop: 0.5 });
const chime = (t) => {
  event(t, { f: 880, dur: 0.7, gain: 0.13 });
  event(t + 0.1, { f: 1318.5, dur: 0.9, gain: 0.11 });
};

[0.3, 8.2, 12.4, 15, 33, 46, 63, 132, 148, 165, 176].forEach((t) => event(t, { f: 72, dur: 1.1, gain: 0.26, drop: 0.2 }));
[33.8, 36.4, 39, 41.8].forEach(tick);
[5.8, 18.5, 29, 31.7, 41.3, 48.8, 55.2].forEach((d) => tick(DEMO + d));
for (let i = 0; i < 7; i += 1) event(DEMO + 11.2 + i * 0.34, { f: i >= 3 && i <= 5 ? 280 : 980, dur: 0.09, gain: 0.13 });
thud(DEMO + 13.9);
chime(DEMO + 16);
chime(DEMO + 27.3);
thud(DEMO + 31.9);
thud(DEMO + 55.4);
chime(176 + 4.8);

// Fade in and out, and keep clear of clipping.
let peak = 0;
for (const s of mix) peak = Math.max(peak, Math.abs(s));
const norm = 0.82 / peak;
const out = Buffer.alloc(44 + N * 4);
out.write('RIFF', 0);
out.writeUInt32LE(36 + N * 4, 4);
out.write('WAVEfmt ', 8);
out.writeUInt32LE(16, 16);
out.writeUInt16LE(1, 20);
out.writeUInt16LE(2, 22);
out.writeUInt32LE(RATE, 24);
out.writeUInt32LE(RATE * 4, 28);
out.writeUInt16LE(4, 32);
out.writeUInt16LE(16, 34);
out.write('data', 36);
out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N * 2; i += 1) {
  const t = Math.floor(i / 2) / RATE;
  const fade = Math.min(1, t / 1.5) * Math.min(1, (LENGTH - t) / 3);
  out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[i] * norm * fade)) * 32767), 44 + i * 2);
}
mkdirSync('out', { recursive: true });
writeFileSync('out/sound.wav', out);
console.log('wrote out/sound.wav', (out.length / 1e6).toFixed(1), 'MB');
