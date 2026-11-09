import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Examples, NextButton, TAP } from '../components/parts';
import { eur } from '../lib/guard';
import { useDemo } from '../lib/demo';
import { NAMED, POOL, PRODUCTS } from '../lib/market';

export function Customers() {
  const { product, pool, onboarded, busy, setProduct, onboardNext, onboardAll, edit } = useDemo();
  const [editing, setEditing] = useState<number | null>(null);
  const done = onboarded === NAMED.length;

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Step 1 of 3</p>
        <h1>Customers tell their AI agents what to buy.</h1>
        <p className="lead">Each customer signs one mandate at Nexi. The mandate says what the AI agent may buy, and the most it may pay.</p>
      </header>

      <Examples items={PRODUCTS} value={product.id} onChange={(id) => { setEditing(null); setProduct(id); }} />

      <div className="actions">
        <motion.button {...TAP} className="btn primary" disabled={done || busy} onClick={onboardNext}>Onboard the next customer</motion.button>
        <motion.button {...TAP} className="btn ghost" disabled={done || busy} onClick={onboardAll}>Onboard all ten</motion.button>
        <span className="count"><b>{onboarded}</b> of {NAMED.length} onboarded</span>
      </div>

      <div className="people">
        {pool.slice(0, NAMED.length).map((c, i) => {
          const active = i < onboarded;
          return (
            <motion.article key={c.id} layout className={`person ${active ? 'on' : ''}`} onClick={() => active && setEditing(editing === c.id ? null : c.id)}>
              <h2>{c.name}<span>{c.age}</span></h2>
              {active ? (
                <>
                  <p><b>{c.qty} {c.qty === 1 ? product.noun : product.unit}</b>, {product.when}</p>
                  <p>At most {eur(c.maxCents)} a {product.noun}</p>
                  <p>Weekly budget {eur(c.weeklyCents)}</p>
                  <p className={c.allowed ? 'yes' : 'no'}>{product.supplier} {c.allowed ? 'allowed' : 'not allowed'}</p>
                  <p className="signed">Agent signed, mandate at Nexi</p>
                  <AnimatePresence>
                    {editing === c.id && (
                      <motion.div className="edit" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} onClick={(e) => e.stopPropagation()}>
                        <label>Quantity<input type="number" min={1} max={9} value={c.qty} onChange={(e) => edit(c.id, { qty: Math.max(1, Number(e.target.value)) })} /></label>
                        <label>Most per {product.noun} (€)<input type="number" min={0} step={product.stepCents / 100} value={c.maxCents / 100} onChange={(e) => edit(c.id, { maxCents: Math.round(Number(e.target.value) * 100) })} /></label>
                        <label className="check"><input type="checkbox" checked={c.allowed} onChange={(e) => edit(c.id, { allowed: e.target.checked })} />{product.supplier} allowed</label>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : <p className="wait">Not onboarded yet</p>}
            </motion.article>
          );
        })}
      </div>

      <footer className="page-foot">
        <p className="fine">{done ? `Nexi holds ${POOL} mandates: these 10 and ${POOL - NAMED.length} simulated with the same mix. Click a customer to change a mandate.` : 'All customers are made up.'}</p>
        <NextButton href="#/supplier">Next: the supplier</NextButton>
      </footer>
    </div>
  );
}
