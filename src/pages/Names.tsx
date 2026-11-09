import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Examples, Facts, NexiLogo, NextButton, PersonaCard, TAP } from '../components/parts';
import { PRIVACY_EXAMPLES, type PrivacyExample } from '../data/examples';
import { PERSONAS } from '../data/personas';
import { bundles, categories, MIN_GROUP, questionsFor, reply, wantedNow } from '../lib/wall';

const STEPS = ['AI agents send orders to Nexi.', 'Nexi removes names and budgets.', `Nexi adds up groups of ${MIN_GROUP} or more.`, 'Each party gets only its bundle.'];
const NEVER = ['Names', 'Budgets', 'Supplier names', 'Single purchases', `Groups under ${MIN_GROUP}`];

function Demo({ example, tick }: { example: PrivacyExample; tick: number }) {
  const [id, setId] = useState<string | null>(null);
  const wanted = wantedNow(example, tick);
  const questions = questionsFor(example, wanted);
  const question = questions.find((q) => q.id === id);
  const answer = question ? reply(question) : null;
  const shake = (field: 'name' | 'money') => (answer?.hides === field ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 });

  return (
    <>
      <div className="wall-view">
        <section className="side">
          <h2>What Nexi receives</h2>
          <ul>
            <motion.li animate={shake('name')} className={answer?.hides === 'name' ? 'hit' : ''}><span>Name</span><b>{example.person}</b></motion.li>
            <motion.li animate={shake('money')} className={answer?.hides === 'money' ? 'hit' : ''}><span>Budget</span><b>{example.budget}</b></motion.li>
            <li><span>Wants</span><b>{example.wants}</b></li>
          </ul>
        </section>
        <div className="wall-line"><span><NexiLogo /></span></div>
        <section className="side shop">
          <h2>What the {example.shop} sees</h2>
          <p className="shop-count">{example.seen.replace(/\d+/, String(Math.round(wanted / 5) * 5))}</p>
          <p className="fine">No names. No budgets.</p>
        </section>
      </div>

      <div className="bundles">
        {bundles(example, tick).map((b) => (
          <article key={b.party}>
            <h2>{b.party}</h2>
            <p className="fine">{b.channel}. Refresh: {b.refresh.toLowerCase()}.</p>
            <dl>{b.fields.map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>
          </article>
        ))}
      </div>

      <div className="ask">
        <p className="step-label">Ask as the {example.shop}:</p>
        <div className="questions">
          {questions.map((q) => (
            <motion.button {...TAP} key={q.id} className={id === q.id ? 'on' : ''} aria-pressed={id === q.id} onClick={() => setId(q.id)}>{q.text}</motion.button>
          ))}
        </div>
        <div className="reply-slot" aria-live="polite">
          <AnimatePresence mode="wait">
            {answer && (
              <motion.p key={id} className={`reply ${answer.allowed ? 'ok' : 'no'}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>{answer.text}</motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

export function Names() {
  const [id, setId] = useState(PRIVACY_EXAMPLES[0].id);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(timer);
  }, []);
  const example = PRIVACY_EXAMPLES.find((e) => e.id === id)!;
  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Deep dive</p>
        <h1>Live data, no names.</h1>
        <p className="lead">AI agents share what they want to buy. Nexi removes who they are, and sells only the totals.</p>
      </header>
      <PersonaCard persona={PERSONAS.analyst} />
      <Examples items={PRIVACY_EXAMPLES} value={id} onChange={setId} />
      <Demo key={id} example={example} tick={tick} />

      <section className="log">
        <h2>Demand across categories <span className="live">Live</span></h2>
        <table className="grid-table small">
          <thead><tr><th>Category</th><th>Wanted</th><th>Buying speed</th><th>Average price</th><th>Against last week</th><th>Customers</th></tr></thead>
          <tbody>{categories(PRIVACY_EXAMPLES, tick).map((c) => <tr key={c.id}><td>{c.label}</td><td>{c.wanted}</td><td>{c.speed}</td><td>{c.price}</td><td>{c.trend}</td><td>{c.customers}</td></tr>)}</tbody>
        </table>
      </section>

      <div className="privacy">
        <section><h2>How it stays private</h2><ol>{STEPS.map((s) => <li key={s}>{s}</li>)}</ol></section>
        <section><h2>Never in any bundle</h2><ul>{NEVER.map((s) => <li key={s}>{s}</li>)}</ul></section>
      </div>

      <Facts uses="An anonymous survey: the result has no names." forWhom="Shops, banks and market analysts." solves="Live demand data. Customers keep their privacy." />
      <footer className="page-foot">
        <p className="fine">{example.person} is a made-up customer. The live feed is simulated.</p>
        <NextButton href="#/sources">Next: sources</NextButton>
      </footer>
    </div>
  );
}
