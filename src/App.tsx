import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { useEffect, useState } from 'react';
import { NexiLogo } from './components/parts';
import { Home } from './pages/Home';
import { Limit } from './pages/Limit';
import { Names } from './pages/Names';
import { Order } from './pages/Order';

const STEPS = [
  { hash: '#/order', label: 'How much to prepare' },
  { hash: '#/limit', label: 'Spending limit' },
  { hash: '#/names', label: 'Numbers, not names' },
];

const PAGES: Record<string, () => React.JSX.Element> = { '#/order': Order, '#/limit': Limit, '#/names': Names };
const route = () => (window.location.hash || '#/').split('?')[0];

export function App() {
  const [hash, setHash] = useState(route);
  useEffect(() => {
    const onChange = () => {
      setHash(route());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const Page = PAGES[hash] ?? Home;
  const current = STEPS.findIndex((s) => s.hash === hash);

  return (
    <MotionConfig reducedMotion="user">
      <div className="app">
        <div className="glow" aria-hidden />
        <nav className="top">
          <a href="#/" className="brand" aria-label="Go to the start"><NexiLogo /></a>
          {current >= 0 && (
            <ol className="timeline">
              {STEPS.map((s, i) => (
                <li key={s.hash} className={i === current ? 'now' : i < current ? 'done' : ''}>
                  <a href={s.hash} aria-current={i === current ? 'step' : undefined}><i>{i + 1}</i><span>{s.label}</span></a>
                </li>
              ))}
            </ol>
          )}
        </nav>
        <main>
          <AnimatePresence mode="wait">
            <motion.div key={hash} initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}>
              <Page />
            </motion.div>
          </AnimatePresence>
        </main>
        <p className="legal">School project for the ESCP Turin hackathon. This is not a Nexi product.</p>
      </div>
    </MotionConfig>
  );
}
