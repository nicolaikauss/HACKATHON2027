// The customer's home: the map of their shops, their rules, and the agent they talk to.
import { motion } from 'motion/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { EuropeMap, ITALY, type Level, type MapHandle } from '../components/EuropeMap';
import { Icon, Seg, Tag, Toggle, TAP, type Tone } from '../components/parts';
import europe from '../data/europe.json';
import { historyOf, nameIn, pendingOf, RECOMMENDED, respond, sentence, setup, SETUP, signed, wantsRecommended, type Seen, type SetupStep } from '../lib/agent';
import { CHECKS, eur, trace } from '../lib/guard';
import { act, setMe, useWorld } from '../lib/store';
import { useVoice } from '../lib/voice';
import { marketOf, MARKETS, plural, reduce, type Action, type Person } from '../lib/world';

type Phase = SetupStep | 'done';
type Msg = { id: number; from: 'you' | 'agent'; text: string; spoken?: boolean; entries?: Seen[]; rules?: boolean };
type Reply = Pick<Msg, 'text' | 'entries' | 'rules'>;

const LEVELS: { id: Level; label: string }[] = [{ id: 'europe', label: 'Europe' }, { id: 'italy', label: 'Italy' }, { id: 'turin', label: 'Torino' }];
const KEY = 'nexi.agent';
const EVERY = MARKETS.map((m) => m.id);
/** The talk stays when the customer opens another page and comes back. */
const session = { msgs: [] as Msg[], n: 0 };

function recall(): { who: string; phase: Phase } {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as { who?: string; phase?: Phase } | null;
    if (saved?.who && saved.phase) return { who: saved.who, phase: saved.phase };
  } catch { /* optional */ }
  return { who: '', phase: 'name' };
}
function remember(who: string, phase: Phase) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ who, phase })); } catch { /* optional */ }
}

/** The rules of one customer in one shop, as short labels. The tiles and the chat card share them. */
function rulesOf(me: Person, shops: number, focus: string) {
  const m = marketOf(focus);
  const r = me.mandate;
  return [
    { step: 'shops', label: 'Shops', value: `${shops} of ${MARKETS.length}`, hint: shops === MARKETS.length ? 'All shops are allowed' : 'The other shops are closed to your agent' },
    { step: 'price', label: 'Price limit', value: eur(r.limitCents), hint: `For one ${m.noun}, ${m.shop.toLowerCase()}` },
    { step: 'budget', label: 'Weekly budget', value: eur(r.weeklyCents), hint: `${eur(me.spentCents)} used, ${m.shop.toLowerCase()}` },
    { step: 'ask', label: 'Ask me first', value: r.askAboveCents === null ? 'Never' : r.askAboveCents === 0 ? 'Always' : `Above ${eur(r.askAboveCents)}`, hint: r.askAboveCents === null ? 'The agent pays without asking' : 'You approve these payments' },
    { step: 'hours', label: 'Hours', value: r.hoursOnly ? 'Daytime' : 'Any time', hint: r.hoursOnly ? 'Weekdays, 08:00 to 20:00' : 'Day and night' },
  ] as const;
}

function Decision({ e, open, onAnswer }: { e: Seen; open: boolean; onAnswer: (text: string) => void }) {
  const test = e.hop === 'test';
  const stopped = e.outcome === 'stopped' || e.outcome === 'declined';
  // A stopped test is good news: the rules held.
  const tone: Tone = test ? (stopped ? 'good' : 'wait') : e.outcome === 'paid' ? 'good' : e.outcome === 'ask' ? 'wait' : 'bad';
  const label = test ? (stopped ? 'Blocked' : 'Not blocked') : e.outcome === 'paid' ? 'Paid' : e.outcome === 'ask' ? 'Asks you' : e.outcome === 'declined' ? 'Not paid' : 'Stopped';
  const at = CHECKS.findIndex((c) => c.id === e.rule);
  const verdict = e.outcome === 'declined' ? e.ruleName : at < 0 ? (e.rule === 'ok' ? '7 of 7 checks passed' : e.ruleName) : `${e.outcome === 'ask' ? 'Waits' : 'Stopped'} at check ${at + 1} of 7: ${e.ruleName}`;
  return (
    <motion.div className={`decision ${tone}`} initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.25 }}>
      <header><Tag tone={tone}>{label}</Tag><b>{test ? 'Test' : eur(e.totalCents)}</b></header>
      <p>{test ? e.what.replace(/^Test: /, '').replace(/^./, (c) => c.toUpperCase()) : e.what.replace(/^./, (c) => c.toUpperCase())}</p>
      <ol className="dots" aria-label={verdict}>
        {trace(e.rule, e.outcome).map((state, i) => (
          <motion.li key={CHECKS[i].id} className={state} title={CHECKS[i].name} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.12 + i * 0.07, type: 'spring', stiffness: 420, damping: 22 }} />
        ))}
      </ol>
      <small>{verdict}</small>
      {e.token && <small className="token"><Icon name="lock" size={14} />One-time token {e.token}</small>}
      {open && (
        <div className="answer">
          <motion.button {...TAP} className="btn primary small" onClick={() => onAnswer('Yes, pay')}>Approve {eur(e.totalCents)}</motion.button>
          <motion.button {...TAP} className="btn ghost small" onClick={() => onAnswer('No')}>Say no</motion.button>
        </div>
      )}
    </motion.div>
  );
}

export function Agent() {
  const { world } = useWorld();
  const map = useRef<MapHandle>(null);
  const thread = useRef<HTMLOListElement>(null);
  const [id, setId] = useState(recall);
  const [focus, setFocus] = useState(MARKETS[0].id);
  const [level, setLevel] = useState<Level>('europe');
  const [msgs, setMsgs] = useState(session.msgs);
  const [picked, setPicked] = useState(EVERY);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(true);
  const seen = useRef(world.seq);
  const lastTurn = useRef(Date.now());

  const { who, phase } = id;
  const m = marketOf(focus);
  const me = who ? world.markets[focus].people.find((p) => p.id === who) : undefined;
  const pending = who ? pendingOf(world, who) : null;
  const allowed = who ? MARKETS.filter((x) => world.markets[x.id].people.find((p) => p.id === who)?.mandate.shops.length) : [];
  const now = useRef({ world, id, focus, level });
  now.current = { world, id, focus, level };

  const push = (msg: Omit<Msg, 'id'>) => {
    session.n += 1;
    session.msgs = [...session.msgs, { ...msg, id: session.n }].slice(-80);
    setMsgs(session.msgs);
  };
  const go = (nextWho: string, nextPhase: Phase) => {
    setId({ who: nextWho, phase: nextPhase });
    remember(nextWho, nextPhase);
  };
  const commit = (actions: Action[]) => {
    lastTurn.current = Date.now();
    actions.forEach(act);
  };

  /** What the agent does with one sentence, during onboarding and after it. */
  const think = (said: string): Reply => {
    const { world: w, id: at, focus: f, level: l } = now.current;
    if (at.phase === 'name') {
      if (/\b(luca|example)\b/i.test(said)) {
        setMe('p0');
        go('p0', 'done');
        return { text: `You use the agent of Luca, an example customer. ${signed(w, 'p0')}`, rules: true };
      }
      const name = nameIn(said);
      if (!name) return { text: 'Please tell me your first name.' };
      const join = { type: 'join' as const, id: `g${Math.random().toString(36).slice(2, 10)}`, name };
      if (reduce(w, join) === w) return { text: 'This demo is full. Say "use Luca" to try the agent of an example customer.' };
      commit([join]);
      setMe(join.id);
      go(join.id, 'shops');
      return { text: `Nice to meet you, ${name}. ${SETUP[1].ask}` };
    }
    if (at.phase !== 'done') {
      const index = SETUP.findIndex((s) => s.id === at.phase);
      if (wantsRecommended(said)) {
        commit(SETUP.slice(index).flatMap((s) => setup(s.id, s.usual, at.who).actions));
        go(at.who, 'done');
        return { text: `I used the recommended rules. ${signed(w, at.who)}`, rules: true };
      }
      const answer = setup(at.phase, said, at.who);
      if (!answer.ok) return { text: answer.say };
      commit(answer.actions);
      const next = SETUP[index + 1];
      go(at.who, next ? next.id : 'done');
      return next ? { text: `${answer.say} ${next.ask}` } : { text: `${answer.say} ${signed(w, at.who)}`, rules: true };
    }
    const turn = respond(w, at.who, said, f);
    seen.current = turn.world.seq;
    commit(turn.actions);
    if (turn.focus !== f) setFocus(turn.focus);
    if (turn.show) map.current?.fly(turn.show.level);
    else if (l !== 'turin' && (turn.entries.length || turn.focus !== f)) map.current?.fly('turin');
    return { text: turn.say, entries: turn.entries, rules: turn.rules };
  };

  const voice = useVoice((text) => handle(text, true));
  function handle(raw: string, spoken = false) {
    const said = raw.trim();
    if (!said || busy) return;
    voice.quiet();
    setDraft('');
    push({ from: 'you', text: said, spoken });
    setBusy(true);
    window.setTimeout(() => {
      const reply = think(said);
      setBusy(false);
      push({ from: 'agent', ...reply });
      // A spoken command gets a spoken answer, and then the agent listens again.
      voice.speak(reply.text, spoken ? voice.listen : undefined);
    }, 420);
  }

  // The first line of the agent. After a restart of the demo, the saved customer is gone: start again.
  const known = !who || !!me;
  useEffect(() => {
    if (known) {
      if (!session.msgs.length) push({ from: 'agent', text: phase === 'done' && me ? `Hello again, ${me.name}. What do I buy for you?` : SETUP.find((s) => s.id === phase)?.ask ?? SETUP[0].ask });
      return undefined;
    }
    const timer = window.setTimeout(() => {
      session.msgs = [];
      go('', 'name');
      push({ from: 'agent', text: SETUP[0].ask });
    }, 1500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [known]);

  // A decision that this customer did not start here, for example when the shop publishes an offer.
  useEffect(() => {
    const at = now.current.id;
    if (at.who && at.phase === 'done' && Date.now() - lastTurn.current > 1500) {
      const news = historyOf(world, at.who).filter((e) => e.n > seen.current);
      if (news.length) push({ from: 'agent', text: `News from ${news.length === 1 ? `the ${marketOf(news[0].market).shop.toLowerCase()}` : 'your shops'}. ${news.map(sentence).join(' ')}`, entries: news });
    }
    seen.current = world.seq;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);

  const named = phase !== 'name';
  useEffect(() => {
    if (!named) return undefined;
    const timer = window.setTimeout(() => map.current?.fly('turin'), 500);
    return () => window.clearTimeout(timer);
  }, [named]);

  useEffect(() => {
    const el = thread.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [msgs, busy, voice.state, voice.interim, open]);

  const listening = voice.state === 'listening';
  const lastAgent = [...msgs].reverse().find((x) => x.from === 'agent');
  const stoppedLast = lastAgent?.entries?.some((e) => e.hop !== 'test' && e.outcome === 'stopped');
  const step = SETUP.find((s) => s.id === phase);
  const stepIndex = phase === 'done' ? SETUP.length : SETUP.findIndex((s) => s.id === phase);
  const other = marketOf(focus === 'flowers' ? 'fish' : 'flowers');
  const chips = phase === 'name' ? ['Use Luca, an example customer']
    : step ? [...step.chips, RECOMMENDED]
    : pending ? ['Yes, pay', 'No']
    : me?.mandate.revoked ? ['Resume', 'What are my rules?']
    : [...(stoppedLast ? ['Why?'] : []), `Buy ${plural(Math.min(2, m.maxQty), m)}`, `Buy ${other.label.toLowerCase()}`, 'Test the guardrails', 'Stop everything'];
  const status = listening ? 'Listening…' : busy ? 'Checking with Nexi…' : voice.state === 'speaking' ? 'Speaking' : me ? `Key ${me.agent}, signed at Nexi` : 'Not signed yet';
  const off = phase === 'shops' ? EVERY.filter((x) => !picked.includes(x)) : who ? EVERY.filter((x) => !allowed.some((a) => a.id === x)) : [];
  const italy = europe.countries[ITALY];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    handle(draft);
  };
  const onShop = (shop: string, click: boolean) => {
    if (!click) return;
    if (phase === 'shops') setPicked((list) => (list.includes(shop) ? list.filter((x) => x !== shop) : [...list, shop]));
    else setFocus(shop);
  };
  const mic = (
    <motion.button {...TAP} type="button" className={`mic ${voice.state}`} aria-pressed={listening} aria-label={listening ? 'Stop listening' : 'Talk to your agent'} onClick={() => (listening ? voice.stop() : voice.listen())}>
      <Icon name={listening ? 'stop' : 'mic'} size={24} />
    </motion.button>
  );

  return (
    <div className={`agent-page${open ? '' : ' wide'}`}>
      <section className="agent-home" aria-label="Your shops and your rules">
        <header className="agent-head">
          <div>
            <p className="eyebrow">{phase === 'done' ? 'Your agent · Torino' : 'Set up your agent'}</p>
            <h1>{phase === 'done' && me ? <>Hello, {me.name}. <em>Your rules decide.</em></> : <>Six questions. <em>Then your agent can pay.</em></>}</h1>
          </div>
          {me && phase === 'done' && (
            <div className={`mandate${me.mandate.revoked ? ' off' : ''}`}>
              <span><b>{me.mandate.revoked ? 'Mandate revoked' : 'Mandate active'}</b><small>{me.mandate.revoked ? 'Your agent cannot pay' : 'Turn off to stop every payment'}</small></span>
              <Toggle label="Mandate active" on={!me.mandate.revoked} danger onChange={(on) => handle(on ? 'Resume' : 'Stop everything')} />
            </div>
          )}
        </header>

        <div className="map-card">
          <div className="map-stage">
            <EuropeMap ref={map} country={ITALY} shop={focus} off={off} onLevel={setLevel} onCountry={() => undefined} onShop={onShop} />
          </div>
          <div className="map-info">
            <Seg id="agent-level" label="Map level" options={LEVELS} value={level} onChange={(next) => map.current?.fly(next)} />
            <div className="shop-line">
              {level === 'turin' ? (
                <>
                  <p><b>{m.shop}, {m.area}</b>One {m.noun} costs {eur(m.baseCents)} today. Example shop, made up.</p>
                  {me && phase === 'done' && (
                    <span className="pair">
                      <small>{me.mandate.shops.length ? 'Allowed' : 'Not allowed'}</small>
                      <Toggle label={`${m.shop} allowed`} on={me.mandate.shops.length > 0} onChange={(on) => handle(`${on ? 'Allow' : 'Block'} the ${m.shop.toLowerCase()}`)} />
                    </span>
                  )}
                </>
              ) : (
                <p><b>{italy.kg} kg of food thrown away per person in {italy.name}</b>Eurostat, {italy.year}. Shops guess how much to prepare. Your agent tells them. <button className="link" onClick={() => map.current?.fly('turin')}>See your shops in Torino</button></p>
              )}
            </div>
          </div>
        </div>

        <ul className="guards" aria-label="Your rules">
          {(me ? rulesOf(me, allowed.length, focus) : SETUP.slice(1).map((s) => ({ step: s.id, label: s.label, value: '', hint: '' }))).map((rule, i) => {
            const state = i + 1 < stepIndex ? 'set' : i + 1 === stepIndex ? 'now' : 'todo';
            return (
              <li key={rule.step} className={state}>
                <small>{rule.label}</small>
                <b>{state === 'set' ? rule.value : state === 'now' ? 'Your answer' : 'Not set'}</b>
                <span>{state === 'set' ? rule.hint : state === 'now' ? 'The agent asks you now' : 'A later question'}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {open ? (
        <aside className="chat" aria-label="Talk to your agent">
          <header className="chat-head">
            <span className={`orb ${busy ? 'thinking' : voice.state}`} aria-hidden />
            <div><b>Your agent</b><small role="status">{status}</small></div>
            {voice.canSpeak && <button className="icon-btn" aria-pressed={voice.muted} aria-label={voice.muted ? 'Turn the voice on' : 'Turn the voice off'} onClick={() => voice.setMuted(!voice.muted)}><Icon name={voice.muted ? 'mute' : 'volume'} /></button>}
            <button className="icon-btn" aria-label="Make the chat small" onClick={() => setOpen(false)}><Icon name="down" /></button>
          </header>

          <ol className="thread" ref={thread} aria-live="polite">
            {msgs.map((msg) => (
              <motion.li key={msg.id} className={`msg ${msg.from === 'agent' ? 'bot' : 'you'}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
                <p>{msg.spoken && <Icon name="mic" size={15} />}{msg.text}</p>
                {msg.entries?.map((e) => <Decision key={`${e.market}-${e.n}-${e.outcome}`} e={e} open={pending?.n === e.n && pending.market === e.market} onAnswer={handle} />)}
                {msg.rules && me && (
                  <dl className="rule-card">
                    {rulesOf(me, allowed.length, focus).map((rule) => <div key={rule.step}><dt>{rule.label}</dt><dd>{rule.value}</dd></div>)}
                  </dl>
                )}
              </motion.li>
            ))}
            {listening && <li className="msg you ghost"><p>{voice.interim || 'Listening…'}</p></li>}
            {busy && <li className="typing" aria-label="The agent checks with Nexi"><i /><i /><i /></li>}
          </ol>

          {voice.error && <p className="chat-note" role="alert">{voice.error}</p>}
          <div className="chips suggest" role="group" aria-label="Things to say">
            {phase === 'shops' && MARKETS.map((x) => <button key={x.id} aria-pressed={picked.includes(x.id)} onClick={() => onShop(x.id, true)}>{x.shop}</button>)}
            {phase === 'shops' && <button className="go" disabled={!picked.length || busy} onClick={() => handle(picked.length === EVERY.length ? 'All five shops' : picked.map((x) => marketOf(x).shop).join(', '))}>Use {picked.length === EVERY.length ? 'all five' : picked.length === 1 ? 'this shop' : `these ${picked.length}`}</button>}
            {(phase === 'shops' ? [RECOMMENDED] : chips).map((chip) => <button key={chip} disabled={busy} onClick={() => handle(chip)}>{chip}</button>)}
          </div>
          <form className="composer" onSubmit={submit}>
            {mic}
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={phase === 'name' ? 'Your first name' : 'Say it, or type it'} aria-label="Message to your agent" autoComplete="off" enterKeyHint="send" />
            <button type="submit" className="send" aria-label="Send" disabled={!draft.trim() || busy}><Icon name="arrow" /></button>
          </form>
          <p className="chat-foot">Demo agent: it understands a set of commands. Nexi decides every payment.</p>
        </aside>
      ) : createPortal(
        <div className="voice-pill" role="group" aria-label="Voice control">
          {mic}
          <p role="status">{listening ? voice.interim || 'Listening…' : busy ? 'Checking with Nexi…' : lastAgent?.text ?? 'Talk to your agent'}</p>
          <button className="icon-btn" aria-label="Open the chat" onClick={() => setOpen(true)}><Icon name="chat" /></button>
        </div>,
        document.body,
      )}
    </div>
  );
}
