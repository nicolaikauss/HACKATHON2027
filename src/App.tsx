import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { useEffect, useState } from 'react';
import { Icon, NexiLogo } from './components/parts';
import { SOURCES } from './data/sources';
import { act } from './lib/store';
import { Agent } from './pages/Agent';
import { Demo, type Role } from './pages/Demo';
import { Film } from './pages/Film';
import { Home } from './pages/Home';

const ROLES: { hash: string; role: Role; label: string }[] = [
  { hash: '#/customer', role: 'customer', label: 'Customer' },
  { hash: '#/merchant', role: 'merchant', label: 'Merchant' },
  { hash: '#/supplier', role: 'supplier', label: 'Supplier' },
];

function parse() {
  const [path, query = ''] = (window.location.hash || '#/').split('?');
  return { path: path || '#/', query: new URLSearchParams(query) };
}

function Sources() {
  return (
    <div className="sources">
      <p className="eyebrow">Sources</p>
      <h1>Where the figures come from.</h1>
      <p className="lead">Customers, shops and prices in the demo are made up. The figures below are from the named publishers.</p>
      <ul>{SOURCES.map((s) => <li key={s.figure}><b>{s.figure}</b><span>{s.claim}<small>{s.publisher}</small></span></li>)}</ul>
    </div>
  );
}

export function App() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const market = route.query.get('market');
  useEffect(() => {
    if (market) act({ type: 'market', id: market });
  }, [market]);

  const role = ROLES.find((r) => r.hash === route.path)?.role;
  const page = role ? <Demo role={role} join={route.query.has('join')} /> : route.path === '#/demo' ? <Demo /> : route.path === '#/agent' ? <Agent /> : route.path === '#/sources' ? <Sources /> : <Home />;

  if (route.path === '#/film') return <Film />;

  return (
    <MotionConfig reducedMotion="user">
      <div className="app">
        <div className="glow" aria-hidden />
        <nav className="top" aria-label="Main">
          <a href="#/" className="brand" aria-label="Nexi, go to the start"><NexiLogo /></a>
          <div className="top-links">
            {ROLES.map((r) => <a key={r.hash} href={r.hash} aria-current={route.path === r.hash ? 'page' : undefined}>{r.label}</a>)}
            <a href="#/agent" className="cta me" aria-current={route.path === '#/agent' ? 'page' : undefined}><Icon name="mic" size={18} />My agent</a>
            <a href="#/demo" className="cta" aria-current={route.path === '#/demo' ? 'page' : undefined}>Live demo</a>
          </div>
        </nav>
        <main>
          <AnimatePresence mode="wait">
            <motion.div key={route.path} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}>
              {page}
            </motion.div>
          </AnimatePresence>
        </main>
        <footer className="legal">
          <span>Student concept for the ESCP Turin hackathon. Not a Nexi product. All customers and shops are made up.</span>
          <a href="#/sources">Sources</a>
        </footer>
      </div>
    </MotionConfig>
  );
}
