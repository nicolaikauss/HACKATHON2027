import { motion } from 'motion/react';
import { useState } from 'react';
import { CountTo, Field, Icon, Stepper, Tag, TAP } from '../components/parts';
import { eur } from '../lib/guard';
import { act, useWorld } from '../lib/store';
import { askNexi, demand, inputNeed, QUESTIONS, suggestPrice, today, wanted, type Question } from '../lib/world';

function Body() {
  const { market: m, ms } = useWorld();
  const [price, setPrice] = useState(() => suggestPrice(ms, m, m.capacity));
  const [capacity, setCapacity] = useState(m.capacity);
  const [question, setQuestion] = useState<Question | null>(null);
  const levels = demand(ms, m);
  const want = wanted(ms, m);
  const day = today(ms, m);
  const shown = ms.offer?.priceCents ?? price;
  const level = levels.find((l) => l.priceCents === shown);
  const most = Math.max(...levels.map((l) => l.units), 1);
  const best = suggestPrice(ms, m, capacity);
  const expected = Math.min(level?.units ?? 0, capacity);
  const need = inputNeed(m, capacity);
  const limit = ms.merchant.mandate.limitCents;
  const tokens = Object.values(ms.attempts).filter((e) => e.token);
  const answer = question && askNexi(question, ms, m);

  return (
    <>
      <div className="kpi">
        <strong><CountTo value={want.units} /></strong>
        <p><b>{m.unit} wanted for {m.day}</b>From {want.customers} signed mandates. Nexi shows totals, never names.</p>
      </div>

      <div className="chart">
        <div className="bars" role="group" aria-label="Demand at each price">
          {levels.map((l, i) => (
            <button
              key={l.priceCents}
              className={`bar${l.hidden ? ' hidden' : ''}${l.priceCents === shown ? ' on' : ''}`}
              disabled={day.live || l.hidden}
              onClick={() => setPrice(l.priceCents)}
              aria-label={l.hidden ? `${eur(l.priceCents)}: hidden, fewer than 50 customers` : `${eur(l.priceCents)}: ${l.units} ${m.unit}`}
            >
              <i style={{ height: `${l.hidden ? 12 : Math.max(8, (l.units / most) * 100)}%` }} />
              <span className={i % 3 === 0 || l.priceCents === shown ? '' : 'quiet'}>{(l.priceCents / 100).toFixed(2)}</span>
            </button>
          ))}
        </div>
        <p className="fine">{level && !level.hidden ? `At ${eur(shown)}: ${level.units} ${m.unit} from ${level.customers} customers.` : `At ${eur(shown)}: fewer than 50 customers.`} Striped bars are groups under 50 customers. Nexi hides them.</p>
      </div>

      {day.live ? (
        <div className="live">
          <h3><span className="pulse" />Offer live: {eur(shown)} for one {m.noun}</h3>
          <dl className="trio">
            <div><dt><CountTo value={day.customers} /></dt><dd>customers matched</dd></div>
            <div><dt><CountTo value={day.units} /><small> of {day.capacity}</small></dt><dd>{m.unit} sold</dd></div>
            <div><dt><CountTo value={day.cents} format={(n) => eur(Math.round(n))} /></dt><dd>paid to you</dd></div>
          </dl>
          <p className="fine">After {eur(day.supplyCents)} for {m.input}: <b>{eur(day.cents - day.supplyCents)}</b>. Prepare {day.units} {m.unit}, no more.</p>
          <ul className="tally" aria-label="Why agents did not buy">
            {day.waiting > 0 && <li><Tag tone="wait">{day.waiting}</Tag>Waiting for the owner</li>}
            {day.stopped.slice(0, 4).map((s) => <li key={s.rule}><Tag tone="bad">{s.count}</Tag>{s.label}</li>)}
          </ul>
          <ul className="receipts" aria-label="Payments with a one-time token">
            {tokens.slice(-3).reverse().map((e) => <li key={e.token}><Icon name="lock" size={15} /><code>{e.token}</code><span>{e.qty} × {eur(e.unitCents)}</span></li>)}
            <li className="more">and {Math.max(day.customers - Math.min(tokens.length, 3), 0)} more payments, each with its own token. No names.</li>
          </ul>
          <motion.button {...TAP} className="btn ghost" onClick={() => act({ type: 'close' })}>Close the day<Icon name="arrow" /></motion.button>
        </div>
      ) : (
        <div className="offer">
          <h3>Your offer for {m.day}</h3>
          <Field label="Price" hint={`for one ${m.noun}`}>
            <Stepper label="Price" value={price} step={m.stepCents} min={m.stepCents} max={m.baseCents * 4} format={eur} onChange={setPrice} />
          </Field>
          <Field label="Quantity" hint={`${m.unit} you can make`}>
            <Stepper label="Quantity" value={capacity} step={10} min={10} max={2000} format={String} onChange={setCapacity} />
          </Field>
          <p className="fine">Expected: <b>{expected} {m.unit}</b>, {eur(expected * price)}.{price !== best && <> <button className="link" onClick={() => setPrice(best)}>Use {eur(best)}, the price with the highest revenue</button></>}</p>
          <Field label={`Your limit for ${m.input}`} hint={`Your agent buys ${need} ${m.inputUnit} from the ${m.supplier.toLowerCase()}`}>
            <Stepper label="Supply limit" value={limit} step={m.inputStep} min={m.inputStep} max={m.inputCents * 4} format={(n) => `${eur(n)} / ${m.inputNoun}`} onChange={(limitCents) => act({ type: 'merchantRules', limitCents })} />
          </Field>
          {ms.supply?.outcome === 'stopped' && (
            <div className="agent bad" role="status">
              <Icon name="shield" size={26} />
              <div><b>Your agent did not buy {m.input}. No money moved.</b><p>{ms.supply.reason} The offer is not live.</p></div>
            </div>
          )}
          <motion.button {...TAP} className="btn primary" onClick={() => act({ type: 'offer', priceCents: price, capacity })}>Publish the offer<Icon name="arrow" /></motion.button>
        </div>
      )}

      <div className="ask">
        <h3>Ask Nexi</h3>
        <div className="chips">
          {QUESTIONS.map((q) => <button key={q.id} aria-pressed={q.id === question} onClick={() => setQuestion(q.id)}>{q.text(m)}</button>)}
        </div>
        {answer && (
          <motion.p key={question} className={`reply ${answer.allowed ? 'good' : 'bad'}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <Icon name={answer.allowed ? 'check' : 'eyeoff'} size={18} />{answer.text}
          </motion.p>
        )}
      </div>
    </>
  );
}

export function MerchantView() {
  const { market: m, ms } = useWorld();
  return (
    <section className="view merchant" aria-label="Merchant">
      <header className="view-head">
        <span className="badge"><Icon name="store" /></span>
        <div><h2>{m.shop}, {m.area}</h2><p>Merchant, day {ms.round}. Example shop, made up.</p></div>
      </header>
      <Body key={`${m.id}-${ms.round}`} />
    </section>
  );
}
