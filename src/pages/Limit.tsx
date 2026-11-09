import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Examples, Facts, NextButton, PersonaCard, TAP } from '../components/parts';
import { ASK_ABOVE, LIMIT_EXAMPLES, purchaseOf, type LimitChoice, type LimitExample } from '../data/examples';
import { PERSONAS } from '../data/personas';
import { decide, eur, issueToken, priceCheck, type Decision, type Mandate, type Token } from '../lib/guard';
import { ProductTray } from '../three/ProductTray';

type LogRow = { key: number; time: string; shop: string; item: string; cents: number; rule: string; result: string };
type Last = { key: number; choice: LimitChoice; decision: Decision; token: Token | null };

function Demo({ example }: { example: LimitExample }) {
  const [limitCents, setLimit] = useState(example.limit);
  const [weeklyCents, setWeekly] = useState(example.weekly);
  const [shops, setShops] = useState(example.shops);
  const [ask, setAsk] = useState(example.askAbove);
  const [hoursOnly, setHours] = useState(example.hoursOnly);
  const [revoked, setRevoked] = useState(false);
  const [spent, setSpent] = useState(example.spent);
  const [last, setLast] = useState<Last | null>(null);
  const [log, setLog] = useState<LogRow[]>([]);
  const [checking, setChecking] = useState(false);

  const allShops = [...new Set([...example.shops, ...example.choices.map((c) => c.shop)])];
  const mandate: Mandate = { revoked, limitCents, weeklyCents, shops, askAboveCents: ask ? ASK_ABOVE : null, hoursOnly };

  const run = (choice: LimitChoice, approved: boolean) => {
    const decision = decide(mandate, purchaseOf(choice), spent, approved);
    const key = log.length + 1;
    const token = decision.outcome === 'paid' ? issueToken(choice.shop, choice.cents, key) : null;
    if (decision.outcome === 'paid') setSpent((s) => s + choice.cents);
    setLast({ key, choice, decision, token });
    const time = `${String(choice.hour ?? 12).padStart(2, '0')}:${String((key * 7 + 5) % 60).padStart(2, '0')}`;
    setLog((l) => [{ key, time, shop: choice.shop, item: choice.label, cents: choice.cents, rule: decision.ruleName, result: decision.outcome === 'paid' ? 'Paid' : decision.outcome === 'ask' ? 'Waiting' : 'Stopped' }, ...l].slice(0, 6));
  };
  const approve = () => {
    if (!last) return;
    setChecking(true);
    window.setTimeout(() => {
      setChecking(false);
      run(last.choice, true);
    }, 1100);
  };
  const price = last ? priceCheck(last.choice.cents, example.usual[0], example.usual[1], example.offers) : null;
  const tone = last?.decision.outcome === 'paid' ? 'ok' : last ? 'no' : '';

  return (
    <>
      <div className="split">
        <div className="controls">
          <p className="agent-id">Your agent ID <b>LU-7F3A</b>, signed key on file</p>
          <label className="limit">
            <span>Limit per purchase</span><b>{eur(limitCents)}</b>
            <input type="range" min={100} max={12000} step={50} value={limitCents} onChange={(e) => setLimit(Number(e.target.value))} />
          </label>
          <label className="limit small">
            <span>Weekly budget</span><b>{eur(weeklyCents)}</b>
            <input type="range" min={500} max={20000} step={100} value={weeklyCents} onChange={(e) => setWeekly(Number(e.target.value))} />
          </label>
          <div className="spend" aria-label={`Spent ${eur(spent)} of ${eur(weeklyCents)}`}><i style={{ width: `${Math.min(100, (spent / weeklyCents) * 100)}%` }} /></div>
          <p className="fine">Spent this week: {eur(spent)}</p>
          <div className="toggles">
            {allShops.map((s) => (
              <label key={s} className="check"><input type="checkbox" checked={shops.includes(s)} onChange={(e) => setShops((l) => (e.target.checked ? [...l, s] : l.filter((x) => x !== s)))} />{s}</label>
            ))}
            <label className="check"><input type="checkbox" checked={ask} onChange={(e) => setAsk(e.target.checked)} />Ask me above {eur(ASK_ABOVE)}</label>
            <label className="check"><input type="checkbox" checked={hoursOnly} onChange={(e) => setHours(e.target.checked)} />Weekdays 08:00 to 20:00 only</label>
          </div>
        </div>

        <div className="tray-card result-card">
          <ProductTray goods={example.goods} cols={1} rows={1} bad={last && last.decision.outcome === 'stopped' ? 1 : 0} span={1.5} cell={4} label={last ? `${last.choice.label}: ${last.decision.title}` : example.label} />
          <AnimatePresence mode="wait">
            <motion.div key={last?.key ?? 'empty'} className={`verdict ${tone}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.24 }}>
              {last ? (
                <>
                  <h2>{last.decision.title}</h2>
                  <p><b>{last.decision.ruleName}.</b> {last.decision.reason}</p>
                  {last.token && <p className="token">One-time token {last.token.id}: {last.token.shop}, {eur(last.token.cents)}, valid {last.token.validMinutes} minutes</p>}
                  {last.decision.outcome === 'ask' && <button className="btn sun" disabled={checking} onClick={approve}>{checking ? 'Checking fingerprint…' : 'Approve with fingerprint'}</button>}
                </>
              ) : <p>Choose a purchase.</p>}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="ask">
        <p className="step-label">Ask the AI agent to buy:</p>
        <div className="choices row">
          {example.choices.map((c) => (
            <motion.button {...TAP} key={c.label} className="choice" onClick={() => run(c, false)}>
              <span>{c.label}<small>{c.shop}</small></span><b>{eur(c.cents)}</b>
            </motion.button>
          ))}
        </div>
      </div>

      {price && last && (
        <div className={`price-index ${price.high ? 'high' : ''}`}>
          <div className="price-track"><span className="usual" /><i style={{ left: `${price.position * 100}%` }} /></div>
          <p>{price.text}</p>
        </div>
      )}

      {log.length > 0 && (
        <section className="log">
          <h2>Audit log</h2>
          <table className="grid-table small">
            <thead><tr><th>Time</th><th>Shop</th><th>Item</th><th>Price</th><th>Rule</th><th>Result</th></tr></thead>
            <tbody>{log.map((l) => <tr key={l.key} className={l.result === 'Paid' ? 'ok' : 'no'}><td>{l.time}</td><td>{l.shop}</td><td>{l.item}</td><td>{eur(l.cents)}</td><td>{l.rule}</td><td>{l.result}</td></tr>)}</tbody>
          </table>
        </section>
      )}

      <motion.button {...TAP} className={`btn ${revoked ? 'primary' : 'danger'} self-start`} onClick={() => setRevoked((v) => !v)}>{revoked ? 'Sign a new mandate' : 'Revoke the mandate'}</motion.button>
    </>
  );
}

export function Limit() {
  const [id, setId] = useState(LIMIT_EXAMPLES[0].id);
  const example = LIMIT_EXAMPLES.find((e) => e.id === id)!;
  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Deep dive</p>
        <h1>Your AI agent cannot break your rules.</h1>
        <p className="lead">Sign one mandate. Nexi checks every payment before the money moves.</p>
      </header>
      <PersonaCard persona={PERSONAS.luca} />
      <Examples items={LIMIT_EXAMPLES} value={id} onChange={setId} />
      <Demo key={id} example={example} />
      <Facts uses="Card spending limits, virtual cards and agent tokens." forWhom="People who let an AI agent pay for them." solves="No payment outside your mandate." />
      <footer className="page-foot">
        <p className="fine">Test only. No real money moves. Shops and prices are made up. Tokens are a mock.</p>
        <NextButton href="#/order">Next: how much to prepare</NextButton>
      </footer>
    </div>
  );
}
