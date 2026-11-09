import { motion } from 'motion/react';
import { useMemo } from 'react';
import { CountTo, NextButton, TAP } from '../components/parts';
import { eur, issueToken } from '../lib/guard';
import { useDemo } from '../lib/demo';
import { match, NAMED, suggestPrice } from '../lib/market';

export function Offer() {
  const { product, pool, offer, confirmed, setOffer, confirm } = useDemo();
  const result = useMemo(() => match(pool, product, offer), [pool, product, offer]);
  const suggested = suggestPrice(pool, product, offer.capacity);

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Step 3 of 3</p>
        <h1>Make one offer. Nexi matches it.</h1>
        <p className="lead">Nexi checks the offer against every mandate. Only customers whose rules allow it are matched.</p>
      </header>

      <div className="offer-form">
        <label>Price per {product.noun} (€)<input type="number" min={0} step={product.stepCents / 100} value={offer.priceCents / 100} onChange={(e) => setOffer({ ...offer, priceCents: Math.round(Number(e.target.value) * 100) })} /></label>
        <label>{product.unit[0].toUpperCase() + product.unit.slice(1)} available<input type="number" min={0} value={offer.capacity} onChange={(e) => setOffer({ ...offer, capacity: Math.max(0, Math.round(Number(e.target.value))) })} /></label>
        <motion.button {...TAP} className="btn ghost" onClick={() => setOffer({ ...offer, priceCents: suggested })}>Use the price Nexi suggests: {eur(suggested)}</motion.button>
      </div>

      <div className="tiles">
        <div><b><CountTo value={result.customers} /></b><span>customers matched</span></div>
        <div><b><CountTo value={result.units} /></b><span>{product.unit} sold</span></div>
        <div className="sun"><b>{eur(result.amountCents)}</b><span>paid and bank-guaranteed</span></div>
      </div>

      <section className="matches">
        <h2>The ten named customers</h2>
        <ul>
          {result.rows.slice(0, NAMED.length).map((r, i) => (
            <li key={r.customer.id} className={r.units ? 'ok' : 'no'}>
              <b>{r.customer.name}</b>
              <span>{r.units ? `${r.units} ${r.units === 1 ? product.noun : product.unit}, ${eur(r.amountCents)}` : r.reason}</span>
              {confirmed && r.units > 0 && <code>{issueToken(product.supplier, r.amountCents, i).id}</code>}
            </li>
          ))}
        </ul>
      </section>

      {confirmed ? (
        <motion.p className="settled" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          Nexi confirmed {result.customers} payments, {eur(result.amountCents)}. Each payment has a one-time token. Prepare exactly {result.units} {product.unit}.
        </motion.p>
      ) : (
        <motion.button {...TAP} className="btn primary confirm" disabled={result.customers === 0} onClick={confirm}>Confirm the offer through Nexi</motion.button>
      )}

      <footer className="page-foot">
        <p className="fine">Test only. No real money moves. All customers are made up.</p>
        <NextButton href="#/limit">Next: deep dives</NextButton>
      </footer>
    </div>
  );
}
