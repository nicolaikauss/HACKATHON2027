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

function MapScene({ t }: { t: number }) {
  const map = useRef<MapHandle>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => map.current?.fly('turin'), 900);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="f-split">
      <div className="f-text">
        <Show at={0.2} t={t}><p className="f-eyebrow">Torino, Italy</p><h2>This is Sara.</h2></Show>
        <Show at={2.6} t={t}><p className="f-lead">Bread on Friday.<br />Flowers on Saturday.</p></Show>
        <Show at={5} t={t}><p className="f-note">Her agent can pay at four shops. The fish stall is not on her list.</p></Show>
      </div>
      <div className="f-map"><EuropeMap ref={map} country={ITALY} shop="bread" off={['fish']} onLevel={() => undefined} onCountry={() => undefined} onShop={() => undefined} /></div>
    </div>
  );
}

type Scene = { id: string; title: string; dur: number; line: string; View: (p: { t: number }) => ReactNode };

const SCENES: Scene[] = [
  {
    id: 'hook', title: '2028', dur: 8,
    line: 'It is 2028. Your AI agent does the shopping. So who checks what it pays?',
    View: ({ t }) => (
      <div className="f-center">
        <Show at={0.2} t={t}><p className="f-year">2028</p></Show>
        <Show at={1.2} t={t}><h1>Your AI agent does the shopping.</h1></Show>
        <Show at={3.4} t={t} className="f-clip"><blockquote>“I let ChatGPT’s new ‘agent’ manage my life. It spent $31 on a dozen eggs.”</blockquote><cite>The Washington Post, 2025</cite></Show>
        <Show at={5.6} t={t}><h2 className="f-ask">So who checks what it pays?</h2></Show>
      </div>
    ),
  },
  { id: 'sara', title: 'Sara', dur: 8, line: 'This is Sara. She lives in Torino. On Friday she buys bread. On Saturday, flowers.', View: MapScene },
  {
    id: 'setup', title: 'Set up', dur: 11.5,
    line: 'With Nexi, Sara sets up her agent in one minute. Which shops it can use. The most it can pay. A weekly budget. And when it must ask her first.',
    View: ({ t }) => (
      <div className="f-split">
        <div className="f-text">
          <Show at={0.2} t={t}><span className="orb" /><h2>Six questions.<br /><em>One minute.</em></h2></Show>
          <Show at={2.2} t={t}><Bot>Which shops can I pay?</Bot></Show>
          <Show at={3.4} t={t}><You>The bakery and the florist.</You></Show>
          <Show at={9.4} t={t}><p className="f-note"><Icon name="lock" size={26} />Agent {S.key}, signed at Nexi</p></Show>
        </div>
        <ul className="f-rules">
          {S.rules.map((rule, i) => (
            <li key={rule.step} className={t >= 3.2 + i * 1.3 ? 'on' : ''}>
              <i><Icon name="check" size={24} /></i><span>{rule.label}</span><b>{rule.value}</b>
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    id: 'voice', title: 'Voice', dur: 11,
    line: 'Then she just talks. Buy two loaves. Nexi runs seven checks, always in the same order. All seven pass. Paid, with a one-time token.',
    View: ({ t }) => (
      <div className="f-split">
        <div className="f-chat">
          <Show at={0.2} t={t}><p className="f-eyebrow">Then she just talks</p></Show>
          <Show at={1.4} t={t}><You>Buy two loaves.</You></Show>
          <Show at={7} t={t}><Card e={S.bread} /></Show>
        </div>
        <div className="f-checks">
          <Show at={3} t={t}><p className="f-eyebrow">Nexi checks every payment</p><Checks entry={S.bread} /></Show>
        </div>
      </div>
    ),
  },
  {
    id: 'ask', title: 'Ask first', dur: 8,
    line: 'Flowers cost more. So her agent asks first. Sara says yes.',
    View: ({ t }) => (
      <div className="f-split">
        <div className="f-text">
          <Show at={0.2} t={t}><h2>Above {eur(1000)},<br /><em>the agent asks first.</em></h2></Show>
          <Show at={5.2} t={t}><You>Yes.</You></Show>
        </div>
        <div className="f-chat">
          {t < 5.8 ? <Show at={1.8} t={t}><Card e={S.ask} open /></Show> : <Show at={5.8} t={t}><Card e={S.approved} /></Show>}
        </div>
      </div>
    ),
  },
  {
    id: 'attack', title: 'Attacks', dur: 12.5,
    line: 'Now a fake agent tries to pay. Then an unknown shop. A price ten times higher. A payment at three in the morning. Nexi stops all four. No money moves.',
    View: ({ t }) => (
      <div className="f-stack">
        <Show at={0.2} t={t}><h2>Now someone tries to cheat.</h2></Show>
        <div className="f-grid">{S.tests.map((e, i) => <Show key={e.n} at={1.6 + i * 1.9} t={t}><Card e={e} /></Show>)}</div>
        <Show at={9.6} t={t} className="f-stamp"><Icon name="shield" size={44} />4 of 4 stopped. No money moved.</Show>
      </div>
    ),
  },
  {
    id: 'stop', title: 'Stop', dur: 6,
    line: 'And one word stops everything. Stop.',
    View: ({ t }) => (
      <div className="f-center">
        <Show at={0.2} t={t}><h2>One word stops everything.</h2></Show>
        <Show at={2} t={t}><You>Stop.</You></Show>
        <Show at={0.8} t={t}>
          <div className={`f-switch${t >= 3 ? ' off' : ''}`}><span><b>{t >= 3 ? 'Mandate revoked' : 'Mandate active'}</b><small>{t >= 3 ? 'The agent cannot pay' : 'The agent pays inside the rules'}</small></span><i /></div>
        </Show>
      </div>
    ),
  },
  {
    id: 'shop', title: 'The shop', dur: 12.5,
    line: 'The bakery wins too. It sees four hundred and forty-six loaves wanted for Friday. No names. No budgets. It bakes three hundred and fifty, and sells every one.',
    View: ({ t }) => {
      const most = Math.max(...S.levels.map((l) => l.units), 1);
      return (
        <div className="f-split">
          <div className="f-text">
            <Show at={0.2} t={t}><p className="f-eyebrow">The bakery, San Salvario</p><h2>The shop wins too.</h2></Show>
            <Show at={5.4} t={t}><p className="f-note"><Icon name="eyeoff" size={26} />No names. No budgets. Only totals.</p></Show>
            <Show at={8} t={t}>
              <dl className="f-trio">
                <div><dt>{S.day.capacity}</dt><dd>loaves baked</dd></div>
                <div><dt>{S.day.units}</dt><dd>loaves sold</dd></div>
                <div><dt>{eur(S.day.cents).replace('.00', '')}</dt><dd>paid by {S.day.customers} agents</dd></div>
              </dl>
            </Show>
          </div>
          <Show at={1.8} t={t} className="f-demand">
            <strong><CountTo value={t >= 2 ? S.want : 0} /></strong>
            <span>loaves wanted for Friday</span>
            <div className="mini-bars" aria-hidden>{S.levels.map((l) => <i key={l.priceCents} className={l.hidden ? 'hidden' : ''} style={{ height: `${l.hidden ? 12 : Math.max(10, (l.units / most) * 100)}%` }} />)}</div>
            <small>Demand at each price, from {eur(S.levels[0].priceCents)} to {eur(S.levels.at(-1)!.priceCents)}</small>
          </Show>
        </div>
      );
    },
  },
  {
    id: 'close', title: 'Close', dur: 10,
    line: 'You set the rules. Your agent acts inside them. Nexi checks every payment. Your AI agent pays. Your rules decide.',
    View: ({ t }) => (
      <div className="f-center">
        {t < 5.6 ? (
          <ol className="f-three">
            {['You set the rules.', 'Your agent acts inside them.', 'Nexi checks every payment.'].map((text, i) => <Show key={text} at={0.3 + i * 1.7} t={t}><li><b>{i + 1}</b>{text}</li></Show>)}
          </ol>
        ) : (
          <Show at={5.6} t={t} className="f-end"><NexiLogo /><h1>Your AI agent pays. <em>Your rules decide.</em></h1></Show>
        )}
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
  }, []);

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
      const dt = Math.min(0.1, (now - last) / 1000);
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
          <button className="film-btn" aria-pressed={captions} onClick={() => setCaptions((c) => !c)}>Captions</button>
          <button className="film-btn" onClick={() => setBare(true)} title="Press H to show the controls again">Hide</button>
        </div>
      )}
    </div>
  );
}
