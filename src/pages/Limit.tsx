import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Examples, Facts, NextButton, TAP } from '../components/parts';
import { LIMIT_EXAMPLES, type LimitExample } from '../data/examples';
import { check, eur, type Result } from '../lib/guard';
import { ProductTray } from '../three/ProductTray';

function Demo({ example }: { example: LimitExample }) {
  const [limitCents, setLimit] = useState(example.limit);
  const [on, setOn] = useState(true);
  const [last, setLast] = useState<(Result & { key: number; label: string }) | null>(null);
  const [log, setLog] = useState<{ key: number; text: string; ok: boolean }[]>([]);

  const buy = (label: string, cents: number) => {
    const result = check({ on, limitCents }, cents);
    const key = Date.now();
    setLast({ ...result, key, label });
    setLog((l) => [{ key, text: `${label}, ${eur(cents)}: ${result.allowed ? 'paid' : 'stopped'}`, ok: result.allowed }, ...l].slice(0, 3));
  };

  return (
    <>
      <div className="split">
        <div className="controls">
          <label className="limit">
            <span>Limit for one purchase</span>
            <b>{eur(limitCents)}</b>
            <input type="range" min={100} max={8000} step={50} value={limitCents} onChange={(e) => setLimit(Number(e.target.value))} />
          </label>
          <p className="step-label">Ask the assistant to buy:</p>
          <div className="choices">
            {[example.fair, example.extra].map((s) => (
              <motion.button {...TAP} key={s.label} className="choice" onClick={() => buy(s.label, s.cents)}>
                <span>{s.label}</span><b>{eur(s.cents)}</b>
              </motion.button>
            ))}
          </div>
          <motion.button {...TAP} className={`btn ${on ? 'danger' : 'primary'}`} onClick={() => setOn((v) => !v)}>
            {on ? 'Turn off the assistant' : 'Turn on the assistant'}
          </motion.button>
        </div>

        <div className="tray-card result-card">
          <ProductTray goods={example.goods} cols={1} rows={1} bad={last && !last.allowed ? 1 : 0} span={1.5} cell={4} label={last ? `${last.label}: ${last.title}` : example.label} />
          <AnimatePresence mode="wait">
            <motion.div
              key={last?.key ?? 'empty'}
              className={`verdict ${last ? (last.allowed ? 'ok' : 'no') : ''}`}
              initial={{ opacity: 0, y: 14 }}
              animate={last && !last.allowed ? { opacity: 1, y: 0, x: [0, -8, 8, -5, 5, 0] } : { opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.34 }}
            >
              {last ? (<><h2>{last.title}</h2><p>{last.reason}</p></>) : <p>Choose a purchase.</p>}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {log.length > 0 && (
        <section className="log" aria-label="What your assistant did">
          <h2>What your assistant did</h2>
          <ul>{log.map((l) => <li key={l.key} className={l.ok ? 'ok' : 'no'}>{l.text}</li>)}</ul>
        </section>
      )}
    </>
  );
}

export function Limit() {
  const [id, setId] = useState(LIMIT_EXAMPLES[0].id);
  const example = LIMIT_EXAMPLES.find((e) => e.id === id)!;
  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Feature 2 of 3</p>
        <h1>Your assistant cannot spend too much.</h1>
        <p className="lead">Set one limit. Nexi checks every payment before the money moves.</p>
      </header>

      <Examples items={LIMIT_EXAMPLES} value={id} onChange={setId} />
      <Demo key={id} example={example} />

      <Facts uses="Card spending limits and virtual cards." forWhom="People who let an AI assistant buy for them." solves="No purchase above your limit." />
      <footer className="page-foot">
        <p className="fine">Test only. No real money moves. Example prices.</p>
        <NextButton href="#/names">Next: numbers, not names</NextButton>
      </footer>
    </div>
  );
}
