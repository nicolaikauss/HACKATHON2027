import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { CountTo, Examples, Facts, NextButton, SPRING } from '../components/parts';
import { SHOP_EXAMPLES } from '../data/examples';
import shops from '../data/shops.json';
import { SHOP_SKUS, shopTomorrow } from '../lib/forecast';
import { useFridayRain } from '../lib/weather';
import { ProductTray } from '../three/ProductTray';

const COLS = 8;
const ROWS = 5;
const FRIDAY = 3;

const startingShop = () => {
  const id = new URLSearchParams(window.location.hash.split('?')[1]).get('shop');
  return SHOP_EXAMPLES.some((e) => e.id === id) ? id! : SHOP_EXAMPLES[0].id;
};

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

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Main feature</p>
        <h1>How much should the shop prepare?</h1>
        <p className="lead">Customers send their shopping lists the day before. Nexi counts the items. The shop gets one number.</p>
      </header>

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
                <p className="say"><b>{day.lists} {example.unit}</b> are on shopping lists. <b>{day.walkIn} {example.unit}</b> are for other customers.</p>
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

      <Facts uses="The shop's order book and the Nexi card terminal." forWhom={`A ${example.shop.toLowerCase()} in ${example.area}, Torino.`} solves={`Less waste. Enough ${example.label.toLowerCase()} on the shelf.`} />
      <footer className="page-foot">
        <p className="fine">Test with made-up customers: 600 households, 6 months. 4 of 10 customers use a list. One example day. The weather is real.</p>
        <NextButton href="#/limit">Next: spending limit</NextButton>
      </footer>
    </div>
  );
}
