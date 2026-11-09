import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { useEffect, useState } from 'react';
import { NexiLogo } from './components/parts';
import { DemoProvider } from './lib/demo';
import { Customers } from './pages/Customers';
import { Home } from './pages/Home';
import { Limit } from './pages/Limit';
import { Names } from './pages/Names';
import { Offer } from './pages/Offer';
import { Order } from './pages/Order';
import { Sources } from './pages/Sources';
import { Supplier } from './pages/Supplier';

const STEPS = [
  { hash: '#/customers', label: 'Customers' },
  { hash: '#/supplier', label: 'Supplier' },
  { hash: '#/offer', label: 'Offer, matched by Nexi' },
];

const PAGES: Record<string, () => React.JSX.Element> = {
  '#/customers': Customers, '#/supplier': Supplier, '#/offer': Offer,
  '#/order': Order, '#/limit': Limit, '#/names': Names, '#/sources': Sources,
};
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
      <DemoProvider>
        <div className="app">
          <div className="glow" aria-hidden />
          <nav className="top">
            <a href="#/" className="brand" aria-label="Go to the start"><NexiLogo /></a>
            {hash !== '#/' && (
              <ol className="timeline">
                {STEPS.map((s, i) => (
                  <li key={s.hash} className={i === current ? 'now' : current > i ? 'done' : ''}>
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
          <footer className="legal">
            <span>School project for the ESCP Turin hackathon. This is not a Nexi product.</span>
            <span className="links"><a href="#/limit">Spending limit</a><a href="#/order">How much to prepare</a><a href="#/names">Live data</a><a href="#/sources">Sources</a></span>
          </footer>
        </div>
      </DemoProvider>
    </MotionConfig>
  );
}
