import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { CountTo, Examples, Facts, NextButton, PersonaCard, SPRING, TAP } from '../components/parts';
import { SHOP_EXAMPLES, type ShopExample } from '../data/examples';
import { PERSONAS } from '../data/personas';
import shops from '../data/shops.json';
import { incoming, negotiate, settle, type Ask } from '../lib/agents';
import { SHOP_SKUS, shopTomorrow } from '../lib/forecast';
import { eur } from '../lib/guard';
import { useFridayRain } from '../lib/weather';
import { ProductTray } from '../three/ProductTray';

const COLS = 8;
const ROWS = 5;
const FRIDAY = 3;
const PREPAID_SHARE = 0.8;

const startingShop = () => {
  const id = new URLSearchParams(window.location.hash.split('?')[1]).get('shop');
  return SHOP_EXAMPLES.some((e) => e.id === id) ? id! : SHOP_EXAMPLES[0].id;
};

function MerchantChat({ example }: { example: ShopExample }) {
  const { deal, unit } = example;
  const [lines, setLines] = useState<{ who: string; text: string }[]>([]);
  const asks: { label: string; ask: Ask }[] = [
    { label: `Buy ${deal.bundleQty} ${unit}`, ask: { qty: deal.bundleQty, maxCents: deal.priceCents } },
    { label: `Offer ${eur(Math.ceil(deal.priceCents * 0.93))} each`, ask: { qty: 2, maxCents: Math.ceil(deal.priceCents * 0.93) } },
    { label: `Buy ${deal.available + 20} ${unit}`, ask: { qty: deal.available + 20, maxCents: deal.priceCents } },
    { label: `Offer ${eur(Math.ceil(deal.priceCents * 0.7))} each`, ask: { qty: 2, maxCents: Math.ceil(deal.priceCents * 0.7) } },
  ];
  return (
    <section className="chat">
      <h2>Your merchant agent</h2>
      <p className="fine">It answers buyer agents. It never goes above the buyer's maximum, or more than 10% off.</p>
      <div className="questions">
        {asks.map((a) => <motion.button {...TAP} key={a.label} onClick={() => setLines((l) => [...l, { who: 'Buyer agent', text: a.label }, { who: 'Your agent', text: negotiate(deal, a.ask, unit).text }].slice(-4))}>{a.label}</motion.button>)}
      </div>
      <ul>{lines.map((l, i) => <li key={i} className={l.who === 'Your agent' ? 'mine' : ''}><b>{l.who}</b>{l.text}</li>)}</ul>
    </section>
  );
}

export function Order() {
  const [id, setId] = useState(startingShop);
  const [withNexi, setWithNexi] = useState(false);
  const rain = useFridayRain();
  const example = SHOP_EXAMPLES.find((e) => e.id === id)!;
  const sku = SHOP_SKUS.find((s) => s.id === id)!;
  const day = useMemo(() => shopTomorrow(id, shops.coverage, FRIDAY, (rain ?? 0) / 100), [id, rain]);
  const stats = shops.rows.find((r) => r.sku === id)!;
  const waste = withNexi ? stats.wasteAfter : stats.wasteBefore;
  const per100 = Math.round(waste * 100);
  const bad = Math.round(waste * COLS * ROWS);
  const orders = useMemo(() => incoming(day.lists), [day.lists]);
  const prepaid = Math.round(day.lists * PREPAID_SHARE);

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Deep dive</p>
        <h1>How much should the shop prepare?</h1>
        <p className="lead">AI agents send their orders the day before. Nexi counts the items. The shop gets one number.</p>
      </header>

      <PersonaCard persona={PERSONAS.merchant} />
      <Examples items={SHOP_EXAMPLES} value={id} onChange={setId} />

      <div className="switch" role="group" aria-label="Compare">
        {[false, true].map((value) => (
          <button key={String(value)} aria-pressed={withNexi === value} onClick={() => setWithNexi(value)}>
            {withNexi === value && <motion.span layoutId="switch" className="switch-pill" transition={SPRING} />}
            <span className="switch-text">{value ? 'With Nexi' : 'Without Nexi'}</span>
          </button>
        ))}
      </div>

      <div className="split">
        <div className="answer">
          <p className="answer-label">{example.verb} for Friday</p>
          <p className="big"><CountTo value={withNexi ? day.total : day.guess} /> <span>{example.unit}</span></p>
          <AnimatePresence mode="wait">
            <motion.div key={`${id}${withNexi}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
              {withNexi ? (
                <>
                  <p className="say"><b>{day.lists} {example.unit}</b> are agent orders. <b>{day.walkIn} {example.unit}</b> are for other customers.</p>
                  <p className="note">{prepaid} of the {day.lists} are already paid by a verified agent with a one-time token.</p>
                </>
              ) : (
                <p className="say">The shop guesses from the past four weeks.</p>
              )}
              {withNexi && rain !== null && rain >= 50 && sku.rainLift < 0 && <p className="note">Rain is likely on Friday in Torino ({rain}%). Fewer people walk in.</p>}
            </motion.div>
          </AnimatePresence>
          <p className="bin"><b><CountTo value={per100} /></b> of every 100 {example.unit} go in the bin.</p>
        </div>
        <figure className="tray-card">
          <ProductTray goods={example.goods} cols={COLS} rows={ROWS} bad={bad} span={9.5} label={`Tray of ${COLS * ROWS} ${example.unit}. ${bad} are red and go in the bin.`} />
          <figcaption>Red items go in the bin.</figcaption>
        </figure>
      </div>

      <section className="log">
        <h2>Incoming agent orders</h2>
        <table className="grid-table small">
          <thead><tr><th>Agent</th><th>Quantity</th><th>Signed</th><th>Bank authorised</th><th>Result</th></tr></thead>
          <tbody>{orders.map((o) => {
            const s = settle(o);
            return <tr key={o.agent} className={s.accepted ? 'ok' : 'no'}><td>{o.agent}</td><td>{o.qty} {example.unit}</td><td>{o.signed ? 'Yes' : 'No'}</td><td>{o.bankAuthorised ? 'Yes' : 'No'}</td><td>{s.reason}</td></tr>;
          })}</tbody>
        </table>
      </section>

      <MerchantChat key={id} example={example} />

      <Facts uses="The shop's order book and the Nexi card terminal." forWhom={`A ${example.shop.toLowerCase()} in ${example.area}, Torino.`} solves={`Less waste. Enough ${example.label.toLowerCase()} on the shelf.`} />
      <footer className="page-foot">
        <p className="fine">Test with made-up customers: 600 households, 6 months. 4 of 10 customers use an AI agent. We assume 8 of 10 agent orders are prepaid. One example day. The weather is real.</p>
        <NextButton href="#/names">Next: live data</NextButton>
      </footer>
    </div>
  );
}
