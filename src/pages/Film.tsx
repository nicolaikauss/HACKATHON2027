// The product film, as a page. Every scene is code, so a change shows at once in the browser.
// The cards and the numbers come from the real engine: the film cannot show a payment that the rules would stop.
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { EuropeMap, ITALY, type MapHandle } from '../components/EuropeMap';
import { Checks, CountTo, Icon, NexiLogo } from '../components/parts';
import { respond, setup, type Seen, type SetupStep } from '../lib/agent';
import { eur } from '../lib/guard';
import { useVoice } from '../lib/voice';
import { demand, initialWorld, MARKETS, reduce, today, wanted, type Action } from '../lib/world';
import { Decision, rulesOf } from './Agent';
import '../film.css';

const W = 1600;
const H = 900;
const BREAD = MARKETS[0];

/** Sara's morning, run through the engine one time. */
function story() {
  const who = 'sara';
  let w = reduce(initialWorld(), { type: 'join', id: who, name: 'Sara' });
  const answers: [SetupStep, string][] = [['shops', 'bakery, pastry shop, lunch bar and florist'], ['price', 'the usual price'], ['budget', '20 euros'], ['ask', 'above 10 euros'], ['hours', 'daytime only']];
  for (const [step, text] of answers) w = setup(step, text, who).actions.reduce((x, a: Action) => reduce(x, a), w);
  const me = w.markets.bread.people.find((p) => p.id === who)!;
  const rules = rulesOf(me, 4, 'bread');
  const say = (text: string, focus: string) => {
    const turn = respond(w, who, text, focus);
    w = turn.world;
    return turn.entries;
  };
  const bread = say('Buy two loaves', 'bread')[0];
  const ask = say('Buy flowers', 'bread')[0];
  const approved = say('Yes', 'flowers')[0];
  const tests = say('Test the guardrails', 'bread');

  const base = initialWorld();
  const sold = [{ type: 'offer', priceCents: 240, capacity: 350 }, { type: 'answer', who: 'p1', approve: true }].reduce((x, a) => reduce(x, a), base);
  return { key: me.agent, rules, bread, ask, approved, tests, want: wanted(base.markets.bread, BREAD).units, levels: demand(base.markets.bread, BREAD), day: today(sold.markets.bread, BREAD) };
}
const S = story();

const Show = ({ at, t, className = '', children }: { at: number; t: number; className?: string; children: ReactNode }) => (t >= at ? <div className={`rise ${className}`}>{children}</div> : null);
const Card = ({ e, open = false }: { e: Seen; open?: boolean }) => <div className="f-card"><Decision e={e} open={open} onAnswer={() => undefined} /></div>;
const You = ({ children }: { children: ReactNode }) => <p className="f-bubble you"><Icon name="mic" size={26} />{children}</p>;
const Bot = ({ children }: { children: ReactNode }) => <p className="f-bubble bot">{children}</p>;

function HookScene({ t }: { t: number }) {
  const map = useRef<MapHandle>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => map.current?.fly('turin'), 700);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="f-split">
      <div className="f-text">
        <Show at={0.1} t={t}><p className="f-year">2028</p></Show>
        <Show at={0.4} t={t}><h2>Your AI agent<br />does the shopping.</h2></Show>
        <Show at={2.6} t={t}><p className="f-lead">Nexi makes sure it<br /><em>follows your rules.</em></p></Show>
      </div>
      <div className="f-map"><EuropeMap ref={map} country={ITALY} shop="bread" off={['fish']} onLevel={() => undefined} onCountry={() => undefined} onShop={() => undefined} /></div>
    </div>
  );
}

export type Sfx = 'whoosh' | 'paid' | 'blocked' | 'switch' | 'pop' | 'tick';
type Scene = { id: string; title: string; dur: number; line: string; cues: [number, Sfx][]; View: (p: { t: number }) => ReactNode };
const every = (n: number, from: number, step: number, sfx: Sfx) => Array.from({ length: n }, (_, i): [number, Sfx] => [from + i * step, sfx]);

const SCENES: Scene[] = [
  { id: 'hook', title: '2028', dur: 6, line: 'Your AI agent does the shopping now. Nexi makes sure it follows your rules.', cues: [[0.4, 'pop'], [2.6, 'pop']], View: HookScene },
  {
    id: 'setup', title: 'Set up', dur: 9,
    line: 'Set it up in one minute. Your shops, a price limit, a weekly budget, and when it must ask you.',
    cues: [[0.9, 'pop'], [1.6, 'pop'], ...every(5, 2.2, 0.9, 'tick')],
    View: ({ t }) => (
      <div className="f-split">
        <div className="f-text">
          <Show at={0.1} t={t}><span className="orb" /><h2>Set up in<br /><em>one minute.</em></h2></Show>
          <Show at={0.9} t={t}><Bot>Which shops can I pay?</Bot></Show>
          <Show at={1.6} t={t}><You>The bakery and the florist.</You></Show>
          <Show at={7.2} t={t}><p className="f-note"><Icon name="lock" size={26} />Agent {S.key}, signed at Nexi</p></Show>
        </div>
        <ul className="f-rules">
          {S.rules.map((rule, i) => (
            <li key={rule.step} className={t >= 2.2 + i * 0.9 ? 'on' : ''}>
              <i><Icon name="check" size={24} /></i><span>{rule.label}</span><b>{rule.value}</b>
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: 'voice', title: 'Talk', dur: 5.6,
    line: 'Then just talk. Buy two loaves. Seven checks pass. Paid.',
    cues: [[0.6, 'pop'], ...every(7, 1.7, 0.08, 'tick'), [3.8, 'paid']],
    View: ({ t }) => (
      <div className="f-split">
        <div className="f-chat">
          <Show at={0.1} t={t}><p className="f-eyebrow">Then just talk</p></Show>
          <Show at={0.6} t={t}><You>Buy two loaves.</You></Show>
          <Show at={3.8} t={t}><Card e={S.bread} /></Show>
        </div>
        <div className="f-checks">
          <Show at={1.6} t={t}><p className="f-eyebrow">Nexi checks every payment</p><Checks entry={S.bread} /></Show>
        </div>
      </div>
    ),
  },
  {
    id: 'ask', title: 'Ask first', dur: 4.4,
    line: 'A bigger payment? It asks you first.',
    cues: [[0.5, 'pop'], [2.4, 'pop'], [2.8, 'paid']],
    View: ({ t }) => (
      <div className="f-split">
        <div className="f-text">
          <Show at={0.1} t={t}><h2>Above {eur(1000)},<br /><em>it asks first.</em></h2></Show>
          <Show at={2.4} t={t}><You>Yes.</You></Show>
        </div>
        <div className="f-chat">
          {t < 2.8 ? <Show at={0.5} t={t}><Card e={S.ask} open /></Show> : <Show at={2.8} t={t}><Card e={S.approved} /></Show>}
        </div>
      </div>
    ),
  },
  {
    id: 'attack', title: 'Attacks', dur: 10.8,
    line: 'A fake agent. An unknown shop. Ten times the price. Three in the morning. All blocked. No money moves.',
    cues: [...every(4, 0.7, 2, 'blocked'), [8.7, 'whoosh']],
    View: ({ t }) => (
      <div className="f-stack">
        <Show at={0.1} t={t}><h2>Now someone tries to cheat.</h2></Show>
        <div className="f-grid">{S.tests.map((e, i) => <Show key={e.n} at={0.7 + i * 2} t={t}><Card e={e} /></Show>)}</div>
        <Show at={8.7} t={t} className="f-stamp"><Icon name="shield" size={44} />4 of 4 blocked. No money moved.</Show>
      </div>
    ),
  },
  {
    id: 'stop', title: 'Stop', dur: 3.6,
    line: 'And one word stops everything.',
    cues: [[0.9, 'pop'], [1.6, 'switch']],
    View: ({ t }) => (
      <div className="f-center">
        <Show at={0.1} t={t}><h2>One word stops everything.</h2></Show>
        <Show at={0.9} t={t}><You>Stop.</You></Show>
        <Show at={0.3} t={t}>
          <div className={`f-switch${t >= 1.6 ? ' off' : ''}`}><span><b>{t >= 1.6 ? 'Mandate revoked' : 'Mandate active'}</b><small>{t >= 1.6 ? 'The agent cannot pay' : 'The agent pays inside the rules'}</small></span><i /></div>
        </Show>
      </div>
    ),
  },
  {
    id: 'shop', title: 'The shop', dur: 4.6,
    line: 'Shops see what people want. Never who they are.',
    cues: [[2.2, 'pop']],
    View: ({ t }) => {
      const most = Math.max(...S.levels.map((l) => l.units), 1);
      return (
        <div className="f-split">
          <div className="f-text">
            <Show at={0.1} t={t}><p className="f-eyebrow">The bakery, San Salvario</p><h2>Shops see demand.<br /><em>Never names.</em></h2></Show>
            <Show at={2.2} t={t}>
              <dl className="f-trio">
                <div><dt>{S.day.units}</dt><dd>loaves sold</dd></div>
                <div><dt>{eur(S.day.cents).replace('.00', '')}</dt><dd>paid by {S.day.customers} agents</dd></div>
              </dl>
            </Show>
          </div>
          <Show at={0.5} t={t} className="f-demand">
            <strong><CountTo value={t >= 0.6 ? S.want : 0} /></strong>
            <span>loaves wanted for Friday</span>
            <div className="mini-bars" aria-hidden>{S.levels.map((l) => <i key={l.priceCents} className={l.hidden ? 'hidden' : ''} style={{ height: `${l.hidden ? 12 : Math.max(10, (l.units / most) * 100)}%` }} />)}</div>
          </Show>
        </div>
      );
    },
  },
  {
    id: 'close', title: 'Nexi', dur: 5.4,
    line: 'Your AI agent pays. Your rules decide. Nexi.',
    cues: [],
    View: ({ t }) => (
      <div className="f-center">
        <Show at={0.1} t={t} className="f-end"><NexiLogo /><h1>Your AI agent pays. <em>Your rules decide.</em></h1></Show>
      </div>
    ),
  },
];

const STARTS = SCENES.map((_, i) => SCENES.slice(0, i).reduce((sum, s) => sum + s.dur, 0));
const TOTAL = STARTS.at(-1)! + SCENES.at(-1)!.dur;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const sceneAt = (time: number) => {
  for (let i = STARTS.length - 1; i >= 0; i -= 1) {
    if (time >= STARTS[i]) return i;
  }
  return 0;
};

export function Film() {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [bare, setBare] = useState(false);
  const voice = useVoice(() => undefined);
  const files = useRef(new Map<string, HTMLAudioElement>());
  const music = useRef<HTMLAudioElement | null>(null);
  const sfx = useRef(new Map<Sfx, HTMLAudioElement>());
  const [sound, setSound] = useState(true);
  const speaking = useRef(false);
  speaking.current = voice.state === 'speaking';

  const index = sceneAt(time);
  const scene = SCENES[index];
  const local = time - STARTS[index];

  // The recorded voice, when it exists: public/voice/<scene>.mp3 or .wav. Without it, the browser reads the line.
  useEffect(() => {
    const find = async (id: string) => {
      for (const ext of ['mp3', 'wav']) {
        const url = `/voice/${id}.${ext}`;
        const res = await fetch(url, { method: 'HEAD' }).catch(() => null);
        if (res?.ok && res.headers.get('content-type')?.startsWith('audio')) return url;
      }
      return null;
    };
    for (const s of SCENES) void find(s.id).then((url) => { if (url) files.current.set(s.id, new Audio(url)); });
    music.current = Object.assign(new Audio('/sound/music.mp3'), { volume: 0.32, preload: 'auto' });
    for (const name of ['whoosh', 'paid', 'blocked', 'switch', 'pop', 'tick'] as Sfx[]) sfx.current.set(name, Object.assign(new Audio(`/sound/${name}.mp3`), { preload: 'auto' }));
  }, []);

  const VOLUME: Record<Sfx, number> = { whoosh: 0.45, paid: 0.7, blocked: 0.6, switch: 0.7, pop: 0.35, tick: 0.25 };
  const play = (name: Sfx) => {
    const base = sfx.current.get(name);
    if (!base || !sound) return;
    const one = base.cloneNode() as HTMLAudioElement;
    one.volume = VOLUME[name];
    void one.play().catch(() => undefined);
  };
  // Effects fire when the clock passes a cue. A jump does not replay the cues it skipped.
  const lastTime = useRef(0);
  useEffect(() => {
    const from = lastTime.current;
    lastTime.current = time;
    if (!playing || time < from || time - from > 1) return;
    SCENES.forEach((sc, i) => {
      for (const [at, name] of sc.cues) {
        const when = STARTS[i] + at;
        if (when > from && when <= time) play(name);
      }
    });
    if (index !== sceneAt(from) && index > 0) play('whoosh');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time]);

  // The music follows the film clock, softer while the voice speaks.
  useEffect(() => {
    const m = music.current;
    if (!m) return;
    if (!playing || !sound) { m.pause(); return; }
    if (Math.abs(m.currentTime - time) > 0.4) m.currentTime = Math.min(time, (m.duration || 999) - 0.1);
    const left = TOTAL - time;
    m.volume = 0.32 * Math.min(1, Math.max(0, left / 2.5));
    if (m.paused) void m.play().catch(() => undefined);
  }, [time, playing, sound]);

  useEffect(() => {
    const fit = () => {
      const el = frame.current;
      if (el) setScale(Math.min(el.clientWidth / W, el.clientHeight / H));
    };
    fit();
    const watch = new ResizeObserver(fit);
    if (frame.current) watch.observe(frame.current);
    return () => watch.disconnect();
  }, [bare]);

  useEffect(() => {
    if (!playing) return undefined;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      setTime((t) => {
        const at = sceneAt(t);
        const end = STARTS[at] + SCENES[at].dur;
        const clip = files.current.get(SCENES[at].id);
        // A scene waits for its sentence to end, for 4 seconds at most.
        const talking = clip ? !clip.paused && !clip.ended : speaking.current;
        const next = t + dt;
        if (next >= end && talking && next < end + 4) return Math.min(next, end - 0.001) === t ? t : end - 0.001;
        return Math.min(next, TOTAL);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => {
    if (time >= TOTAL) setPlaying(false);
  }, [time]);

  const hush = () => {
    voice.quiet();
    files.current.forEach((clip) => clip.pause());
  };
  // Each scene says its line when it starts.
  useEffect(() => {
    if (!playing) {
      hush();
      return;
    }
    const clip = files.current.get(scene.id);
    if (clip && !voice.muted) {
      voice.quiet();
      clip.currentTime = 0;
      void clip.play().catch(() => undefined);
    } else voice.speak(scene.line);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, playing]);

  const seek = (to: number) => {
    hush();
    setTime(Math.min(TOTAL, Math.max(0, to)));
  };
  const toggle = () => {
    if (time >= TOTAL) setTime(0);
    setPlaying((p) => !p);
  };
  const keys = useRef({ toggle, seek, time });
  keys.current = { toggle, seek, time };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === ' ') { e.preventDefault(); keys.current.toggle(); }
      if (e.key === 'ArrowRight') keys.current.seek(keys.current.time + 2);
      if (e.key === 'ArrowLeft') keys.current.seek(keys.current.time - 2);
      if (e.key.toLowerCase() === 'h') setBare((b) => !b);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const View = scene.View;
  const stage = useMemo(() => ({ width: W, height: H, transform: `scale(${scale})` }), [scale]);

  return (
    <div className={`film${bare ? ' bare' : ''}`}>
      <div className="film-frame" ref={frame}>
        <div className="film-fit" style={{ width: W * scale, height: H * scale }}>
          <div className="stage" style={stage}>
            <div className="glow" aria-hidden />
            <header className="f-top"><NexiLogo /><span>{scene.title}</span></header>
            <AnimatePresence mode="wait">
              <motion.div key={scene.id} className="f-scene" initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.38, ease: [0.2, 0.8, 0.2, 1] }}>
                <View t={local} />
              </motion.div>
            </AnimatePresence>
            {captions && <p className="f-caption" key={scene.id}>{scene.line}</p>}
            <footer className="f-legal">Student concept for the ESCP Turin hackathon. Not a Nexi product. People and shops are made up.</footer>
            <i className="f-progress" style={{ width: `${(time / TOTAL) * 100}%` }} />
          </div>
        </div>
      </div>

      {!bare && (
        <div className="film-bar">
          <button className="film-play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}><Icon name={playing ? 'stop' : 'arrow'} /></button>
          <button className="film-btn" onClick={() => seek(0)} aria-label="Go to the start"><Icon name="reset" size={18} /></button>
          <output>{clock(time)} / {clock(TOTAL)}</output>
          <input type="range" min={0} max={TOTAL} step={0.1} value={time} onChange={(e) => seek(Number(e.target.value))} aria-label="Position in the film" />
          <div className="film-scenes" role="group" aria-label="Scenes">
            {SCENES.map((s, i) => <button key={s.id} aria-pressed={i === index} onClick={() => seek(STARTS[i])}>{s.title}</button>)}
          </div>
          <button className="film-btn" aria-pressed={!voice.muted} onClick={() => voice.setMuted(!voice.muted)}><Icon name={voice.muted ? 'mute' : 'volume'} size={18} />Voice</button>
          <button className="film-btn" aria-pressed={sound} onClick={() => setSound((v) => !v)}>Music</button>
          <button className="film-btn" aria-pressed={captions} onClick={() => setCaptions((c) => !c)}>Captions</button>
          <button className="film-btn" onClick={() => setBare(true)} title="Press H to show the controls again">Hide</button>
        </div>
      )}
    </div>
  );
}
