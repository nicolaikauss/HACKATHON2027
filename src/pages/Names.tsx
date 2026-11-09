import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Examples, Facts, NexiLogo, NextButton, TAP } from '../components/parts';
import { PRIVACY_EXAMPLES, type PrivacyExample } from '../data/examples';
import { questionsFor, reply } from '../lib/wall';

function Demo({ example }: { example: PrivacyExample }) {
  const [id, setId] = useState<string | null>(null);
  const questions = questionsFor(example);
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
          <p className="shop-count">{example.seen}</p>
          <p className="fine">No names. No budgets.</p>
        </section>
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
  const example = PRIVACY_EXAMPLES.find((e) => e.id === id)!;
  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Feature 3 of 3</p>
        <h1>The shop sees numbers, not names.</h1>
        <p className="lead">Customers share what they want to buy. Nexi removes who they are.</p>
      </header>

      <Examples items={PRIVACY_EXAMPLES} value={id} onChange={setId} />
      <Demo key={id} example={example} />

      <Facts uses="An anonymous survey: the result has no names." forWhom="Shop owners and their customers." solves="The shop gets the count. The customer keeps their privacy." />
      <footer className="page-foot">
        <p className="fine">{example.person} is a made-up customer.</p>
        <NextButton href="#/">Back to the start</NextButton>
      </footer>
    </div>
  );
}
