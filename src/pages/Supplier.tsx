import { motion } from 'motion/react';
import { NexiLogo, NextButton } from '../components/parts';
import { eur } from '../lib/guard';
import { useDemo } from '../lib/demo';
import { demandCurve, NAMED, summary } from '../lib/market';
import { MIN_GROUP } from '../lib/wall';

export function Supplier() {
  const { product, pool, onboarded } = useDemo();
  const totals = summary(pool);
  const curve = demandCurve(pool, product);
  const top = Math.max(...curve.map((l) => l.units));

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Step 2 of 3</p>
        <h1>The {product.supplier.toLowerCase()} sees demand, through Nexi.</h1>
        <p className="lead">Nexi adds up the mandates. The {product.supplier.toLowerCase()} gets numbers, and no names.</p>
      </header>

      {onboarded < NAMED.length && <p className="warn">Only {onboarded} of 10 customers are onboarded. <a href="#/customers">Onboard all ten first.</a></p>}

      <div className="flow">
        <div className="dots" aria-label={`${totals.customers} customers`}>
          {pool.map((c) => <i key={c.id} className={!c.allowed ? 'off' : c.name ? 'named' : ''} />)}
        </div>
        <motion.div className="flow-line" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.5 }}><span><NexiLogo /></span></motion.div>
        <div className="flow-end">
          <h2>{product.supplier}</h2>
          <p className="shop-count">{totals.units} {product.unit} wanted for {product.when}</p>
          <p>{totals.allowing} of {totals.customers} customers allow this {product.supplier.toLowerCase()}.</p>
        </div>
      </div>

      <section className="curve">
        <h2>Demand by price</h2>
        <p className="fine">At each price: how many customers would buy, from their spending limits.</p>
        <ul>
          {curve.map((l) => (
            <li key={l.priceCents}>
              <b>{eur(l.priceCents)}</b>
              <span className="bar"><motion.i initial={{ width: 0 }} animate={{ width: `${(l.units / top) * 100}%` }} transition={{ duration: 0.5 }} /></span>
              <span>{l.customers} customers, {l.units} {product.unit}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="page-foot">
        <p className="fine">Prices with fewer than {MIN_GROUP} customers are hidden.</p>
        <NextButton href="#/offer">Next: make an offer</NextButton>
      </footer>
    </div>
  );
}
