// Records the film at #/film?render to video/nexi-agent-demo.mp4 (1920 × 1080, 30 fps), with its sound,
// and writes a smaller copy for the landing page to public/film/.
// The page plays in real time, so CSS, motion and the map canvas look exactly as in the browser.
// Pictures come from the Chrome screencast; the sound is mixed by ffmpeg from the film's own cue list.
//
//   npm run dev:agent            (in another terminal)
//   node scripts/render-film.mjs [url]
//
// Needs ffmpeg on the PATH and Playwright's Chromium. PLAYWRIGHT_CORE can point at a playwright-core install.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const URL = process.argv[2] ?? 'http://localhost:3910/#/film?render';
const OUT = join(ROOT, 'video', 'nexi-agent-demo.mp4'); // master, kept out of the site
const WEB = join(ROOT, 'public', 'film', 'nexi-agent-demo.mp4'); // smaller copy the landing page plays
const FPS = 30;
const MUSIC = 0.32;

async function chromium() {
  const candidates = [process.env.PLAYWRIGHT_CORE, 'playwright-core', 'playwright'];
  const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8', shell: true }).trim();
  candidates.push(join(globalRoot, '@playwright', 'cli', 'node_modules', 'playwright-core', 'index.mjs'));
  for (const c of candidates.filter(Boolean)) {
    try {
      const mod = await import(c.includes(':') || c.startsWith('/') ? pathToFileURL(c).href : c);
      return (mod.default ?? mod).chromium;
    } catch { /* try the next one */ }
  }
  throw new Error('playwright-core not found. Set PLAYWRIGHT_CORE to its index.mjs.');
}

const work = mkdtempSync(join(tmpdir(), 'nexi-film-'));
const frames = join(work, 'frames');
mkdirSync(frames);

// Use CHROME_PATH, or any Chromium that Playwright downloaded, so a version mismatch does not block the render.
function chrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = join(process.env.LOCALAPPDATA ?? '', 'ms-playwright');
  if (!existsSync(base)) return undefined;
  const found = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()
    .map((d) => join(base, d, 'chrome-win64', 'chrome.exe')).find((f) => existsSync(f));
  return found;
}
const browser = await (await chromium()).launch({ executablePath: chrome(), args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => window.__film, null, { timeout: 15000 });
await page.evaluate(() => document.fonts.ready);
const film = await page.evaluate(() => ({ total: window.__film.total, volumes: window.__film.volumes, scenes: window.__film.scenes }));
console.log(`film: ${film.total.toFixed(1)} s, ${film.scenes.length} scenes`);

// Screencast frames arrive when the page paints. Each keeps its own timestamp.
const cdp = await page.context().newCDPSession(page);
const shots = [];
let start = null;
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  void cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => undefined);
  if (start === null) return;
  const t = metadata.timestamp - start;
  if (t < 0) return;
  const file = join(frames, `${String(shots.length).padStart(5, '0')}.jpg`);
  writeFileSync(file, Buffer.from(data, 'base64'));
  shots.push({ file, t });
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
await page.waitForTimeout(500);

// The film clock follows the wall clock from now on. Screencast timestamps are in seconds since the epoch.
start = await page.evaluate(() => {
  const t0 = performance.now();
  const tick = () => {
    const t = (performance.now() - t0) / 1000;
    window.__film.set(t);
    if (t < window.__film.total + 0.5) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return (performance.timeOrigin + t0) / 1000;
});
await page.waitForTimeout((film.total + 0.8) * 1000);
await cdp.send('Page.stopScreencast');
await browser.close();
console.log(`frames: ${shots.length}`);

// Pictures: each frame lasts until the next one.
const list = shots.map((s, i) => {
  const next = i + 1 < shots.length ? shots[i + 1].t : film.total;
  return `file '${s.file.replace(/\\/g, '/')}'\nduration ${Math.max(0.001, next - s.t).toFixed(4)}`;
});
list.push(`file '${shots.at(-1).file.replace(/\\/g, '/')}'`);
writeFileSync(join(work, 'frames.txt'), list.join('\n'));

// Sound: music under everything, each scene's voice at its start, each cue's effect, and a whoosh at each cut.
const pub = (p) => join(ROOT, 'public', p);
const inputs = [];
const filters = [];
const add = (file, at, volume) => {
  if (!existsSync(file)) return;
  const i = inputs.length;
  inputs.push(file);
  const ms = Math.max(0, Math.round(at * 1000));
  filters.push(`[${i + 1}:a]volume=${volume},adelay=${ms}|${ms}[a${i}]`); // input 0 is the picture
};
const fadeAt = Math.max(0, film.total - 2.5);
inputs.push(pub('sound/music.mp3'));
filters.push(`[1:a]volume=${MUSIC},atrim=0:${film.total.toFixed(2)},afade=t=in:d=0.8,afade=t=out:st=${fadeAt.toFixed(2)}:d=2.5[a0]`);
film.scenes.forEach((s, i) => {
  add(pub(`voice/${s.id}.mp3`), s.start, 1);
  if (i > 0) add(pub('sound/whoosh.mp3'), s.start, film.volumes.whoosh);
  for (const [at, name] of s.cues) add(pub(`sound/${name}.mp3`), s.start + at, film.volumes[name]);
});
const labels = inputs.map((_, i) => `[a${i}]`).join('');
filters.push(`[0:v]fps=${FPS},scale=1920:1080:flags=lanczos,format=yuv420p[v]`);
filters.push(`${labels}amix=inputs=${inputs.length}:normalize=0:dropout_transition=0,alimiter=limit=0.95[mix]`);

const args = ['-y', '-f', 'concat', '-safe', '0', '-i', join(work, 'frames.txt')];
for (const f of inputs) args.push('-i', f);
args.push(
  '-filter_complex', filters.join(';'),
  '-map', '[v]', '-map', '[mix]',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-tune', 'animation',
  '-c:a', 'aac', '-b:a', '192k', '-t', film.total.toFixed(2), '-movflags', '+faststart', OUT,
);
writeFileSync(join(work, 'filters.txt'), filters.join(';\n'));
execFileSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'] });
rmSync(work, { recursive: true, force: true });
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', OUT, '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', WEB], { stdio: 'inherit' });
console.log(`wrote ${OUT} and ${WEB}`);
