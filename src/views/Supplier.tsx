import { AnimatePresence, motion } from 'motion/react';
import { Checks, CountTo, Field, Icon, NexiLogo, Stepper, Tag, toneOf, TAP } from '../components/parts';
import { eur } from '../lib/guard';
import { act, useMe, useWorld } from '../lib/store';
import { supplyView, TESTS, type Entry, type TestKind } from '../lib/world';

export function SupplierView() {
  const { market: m, ms } = useWorld();
  const view = supplyView(ms, m);
  return (
    <section className="view supplier" aria-label="Supplier">
      <header className="view-head">
        <span className="badge"><Icon name="truck" /></span>
        <div><h2>{m.supplier}</h2><p>Supplier to the {m.shop.toLowerCase()}. Example, made up.</p></div>
      </header>
      <div className="kpi">
        <strong><CountTo value={view.need} /></strong>
        <p><b>{m.inputUnit} of {m.input} for {m.day}</b>{view.firm ? 'Ordered and paid by the shop’s agent.' : 'Forecast from live customer mandates.'}</p>
      </div>
      <Field label="Your price" hint={`for one ${m.inputNoun}`}>
        <Stepper label="Supplier price" value={ms.inputCents} step={m.inputStep} min={m.inputStep} max={m.inputCents * 4} format={eur} onChange={(cents) => act({ type: 'inputPrice', cents })} disabled={view.firm} />
      </Field>
      {view.order && (
        <div className={`agent ${view.firm ? 'good' : 'bad'}`} role="status">
          <Icon name={view.firm ? 'check' : 'shield'} size={26} />
          <div>
            <b>{view.firm ? `Paid: ${eur(view.order.totalCents)}.` : 'No order at this price.'}</b>
            <p>{view.firm ? `${view.order.qty} ${m.inputUnit}, token ${view.order.token}.` : 'The shop’s agent did not buy. Nexi does not show you its limit.'}</p>
          </div>
        </div>
      )}
      <ul className="never">
        <li><Icon name="eyeoff" size={18} />You never see the shop’s customers.</li>
        <li><Icon name="eyeoff" size={18} />You never see the shop’s prices or limits.</li>
      </ul>
    </section>
  );
}

const WORD: Record<Entry['outcome'], string> = { paid: 'Paid', stopped: 'Stopped', ask: 'Asked', declined: 'Stopped' };

/** Nexi in the middle: the checks for the last payment, four attacks to try, and the audit log. */
export function NexiView() {
  const { ms } = useWorld();
  const me = useMe();
  const person = ms.people.find((p) => p.id === me) ?? ms.people[0];
  const last = ms.log.filter((e) => e.who === person.id).at(-1);
  const log = ms.log.slice(-6).reverse();
  return (
    <section className="view nexi" aria-label="Nexi">
      <header className="view-head">
        <NexiLogo />
        <p>checks every payment, in a fixed order</p>
      </header>
      <div>
        <h3>{last ? `${person.name}: ${last.what.replace(/^Test: /, '')}` : `No payment from ${person.name} yet`}</h3>
        <Checks entry={last} />
        {last && <p className={`verdict ${toneOf(last.outcome)}`}>{last.outcome === 'paid' ? 'Paid.' : last.outcome === 'ask' ? 'Waiting for the owner.' : 'Stopped. No money moved.'} {last.outcome !== 'paid' && last.reason}</p>}
      </div>
      <div>
        <h3>Try to break {person.name}’s rules</h3>
        <div className="chips dark">
          {(Object.keys(TESTS) as TestKind[]).map((kind) => (
            <motion.button {...TAP} key={kind} onClick={() => act({ type: 'test', who: person.id, kind })}>{TESTS[kind].label}</motion.button>
          ))}
        </div>
      </div>
      <div>
        <h3>Audit log</h3>
        {log.length === 0 && <p className="fine">Every decision goes here, with the rule that made it.</p>}
        <ul className="log">
          <AnimatePresence initial={false}>
            {log.map((e) => (
              <motion.li key={`${e.n}-${e.who}-${e.outcome}`} layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <Tag tone={toneOf(e.outcome)}>{WORD[e.outcome]}</Tag>
                <span><b>{e.name}</b> <code>{e.agent}</code><small>{e.what}. {e.ruleName}.</small></span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </section>
  );
}
