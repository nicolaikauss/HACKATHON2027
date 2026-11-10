import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Checks, Field, Icon, Stepper, Tag, Toggle, toneOf, TAP } from '../components/parts';
import { eur } from '../lib/guard';
import { act, setMe, useMe, useWorld } from '../lib/store';
import { plural, type Entry, type Market, type RulesPatch } from '../lib/world';

const HEADLINE: Record<Entry['outcome'], string> = { paid: 'Paid.', stopped: 'Stopped. No money moved.', ask: 'Your agent asks you first.', declined: 'You said no. No money moved.' };

function AgentCard({ attempt, agent, market: m, who, live }: { attempt?: Entry; agent: string; market: Market; who: string; live: boolean }) {
  if (!attempt) {
    return (
      <div className="agent plain">
        <Icon name="bot" size={28} />
        <div>
          <b>{live ? 'Your agent is checking the offer.' : 'Your agent waits for an offer.'}</b>
          <p>Agent {agent} is signed at Nexi. It can pay only inside your rules.</p>
        </div>
      </div>
    );
  }
  const tone = toneOf(attempt.outcome);
  return (
    <motion.div key={`${attempt.n}-${attempt.outcome}`} className={`agent ${tone}`} initial={{ scale: 0.97, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }}>
      <Icon name={tone === 'good' ? 'check' : tone === 'wait' ? 'clock' : 'shield'} size={28} />
      <div>
        <b>{HEADLINE[attempt.outcome]}</b>
        <p>{attempt.outcome === 'paid' ? `${eur(attempt.totalCents)} for ${plural(attempt.qty, m)}, at ${eur(attempt.unitCents)} each.` : attempt.reason}</p>
        {attempt.token && <p className="token"><Icon name="lock" size={15} /> One-time token {attempt.token}: one shop, one amount, 10 minutes.</p>}
        {attempt.outcome === 'stopped' && <Tag tone="bad">Rule: {attempt.ruleName}</Tag>}
        {attempt.outcome === 'ask' && (
          <div className="answer">
            <motion.button {...TAP} className="btn primary small" onClick={() => act({ type: 'answer', who, approve: true })}>Approve {eur(attempt.totalCents)}</motion.button>
            <motion.button {...TAP} className="btn ghost small" onClick={() => act({ type: 'answer', who, approve: false })}>Say no</motion.button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function CustomerView({ join = false, checks = true }: { join?: boolean; checks?: boolean }) {
  const { market: m, ms } = useWorld();
  const me = useMe();
  const [joining, setJoining] = useState(join);
  const [name, setName] = useState('');
  const person = ms.people.find((p) => p.id === me) ?? ms.people[0];
  const r = person.mandate;
  const attempt = ms.attempts[person.id];
  const mine = ms.log.filter((e) => e.who === person.id).slice(-4).reverse();
  const patch = (k: RulesPatch) => act({ type: 'rules', who: person.id, patch: k });
  const used = r.weeklyCents ? Math.min(1, person.spentCents / r.weeklyCents) : 1;

  const submit = () => {
    if (!name.trim()) return;
    const id = `g${Math.random().toString(36).slice(2, 10)}`;
    act({ type: 'join', id, name });
    setMe(id);
    setJoining(false);
    setName('');
  };

  return (
    <section className="view customer" aria-label="Customer">
      <header className="view-head">
        <span className="badge"><Icon name="user" /></span>
        <div><h2>{person.name}</h2><p>Customer{person.live ? ', joined live' : ', example person'}</p></div>
      </header>

      <div className="people" role="group" aria-label="Choose a customer">
        {ms.people.map((p) => (
          <button key={p.id} aria-pressed={p.id === person.id} onClick={() => setMe(p.id)}>
            <i className={ms.attempts[p.id] ? toneOf(ms.attempts[p.id].outcome) : ''} />{p.name}
          </button>
        ))}
        <button className="add" onClick={() => setJoining(true)}><Icon name="plus" size={16} />You</button>
      </div>

      {joining && (
        <form className="join" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label htmlFor="join-name">Your first name</label>
          <div>
            <input id="join-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={14} autoFocus autoComplete="off" placeholder="For example: Nonna" />
            <button className="btn primary small" type="submit" disabled={!name.trim()}>Join</button>
          </div>
        </form>
      )}

      <AgentCard attempt={attempt} agent={person.agent} market={m} who={person.id} live={!!ms.offer} />
      {checks && <Checks entry={ms.log.filter((e) => e.who === person.id).at(-1)} />}

      <div className={`rules${r.revoked ? ' off' : ''}`}>
        <h3>{person.name}’s rules</h3>
        <Field label="Buy" hint={`for ${m.day}`}>
          <Stepper label="Quantity" value={person.qty} step={1} min={1} max={m.maxQty} format={(n) => plural(n, m)} onChange={(qty) => patch({ qty })} />
        </Field>
        <Field label="Pay at most" hint={`for one ${m.noun}`}>
          <Stepper label="Price limit" value={r.limitCents} step={m.stepCents} min={m.stepCents} max={m.baseCents * 4} format={eur} onChange={(limitCents) => patch({ limitCents })} />
        </Field>
        <Field label="Weekly budget" hint={`${eur(person.spentCents)} used`}>
          <Stepper label="Weekly budget" value={r.weeklyCents} step={m.stepCents * 5} min={0} max={m.baseCents * 100} format={eur} onChange={(weeklyCents) => patch({ weeklyCents })} />
        </Field>
        <div className="meter" aria-hidden><i style={{ width: `${used * 100}%` }} /></div>
        <Field label="Ask me first" hint={r.askAboveCents === null ? 'The agent pays without asking' : 'above this amount'}>
          <span className="pair">
            {r.askAboveCents !== null && <Stepper label="Ask above" value={r.askAboveCents} step={m.stepCents * 5} min={0} max={m.baseCents * 20} format={eur} onChange={(askAboveCents) => patch({ askAboveCents })} />}
            <Toggle label="Ask me first" on={r.askAboveCents !== null} onChange={(on) => patch({ askAboveCents: on ? m.baseCents : null })} />
          </span>
        </Field>
        <Field label={`The ${m.shop.toLowerCase()} is allowed`} hint={m.area}>
          <Toggle label="Shop allowed" on={r.shops.length > 0} onChange={(allowShop) => patch({ allowShop })} />
        </Field>
        <Field label="Daytime only" hint="Weekdays, 08:00 to 20:00">
          <Toggle label="Daytime only" on={r.hoursOnly} onChange={(hoursOnly) => patch({ hoursOnly })} />
        </Field>
        <Field label={r.revoked ? 'Mandate revoked' : 'Mandate active'} hint={r.revoked ? 'The agent cannot pay' : 'Turn off to stop the agent at once'}>
          <Toggle label="Mandate active" on={!r.revoked} danger onChange={(on) => patch({ revoked: !on })} />
        </Field>
      </div>

      {mine.length > 0 && (
        <ul className="feed" aria-label="Your last decisions">
          <AnimatePresence initial={false}>
            {mine.map((e) => (
              <motion.li key={`${e.n}-${e.outcome}`} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                <Tag tone={toneOf(e.outcome)}>{e.outcome === 'ask' ? 'Asked' : e.outcome === 'paid' ? 'Paid' : 'Stopped'}</Tag>
                <span>{e.what}<small>{e.ruleName}</small></span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
