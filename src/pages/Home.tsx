import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EuropeMap, ITALY, type Level, type MapHandle } from '../components/EuropeMap';
import { CountTo, NextButton, SPRING } from '../components/parts';
import europe from '../data/europe.json';
import { SHOP_EXAMPLES } from '../data/examples';
import { WHY_NOW } from '../data/sources';
import { shopTomorrow } from '../lib/forecast';
import { useFridayRain } from '../lib/weather';

const CYCLE = ['IT', 'DE', 'FR', 'ES', 'PL', 'NL', 'SE', 'EL', 'DK', 'RO'].map((id) => europe.countries.findIndex((c) => c.id === id));
const LEVELS: { id: Level; label: string }[] = [
  { id: 'europe', label: 'Europe' },
  { id: 'italy', label: 'Italy' },
  { id: 'turin', label: 'Torino' },
];

export function Home() {
  const map = useRef<MapHandle>(null);
  const [level, setLevel] = useState<Level>('europe');
  const [cycle, setCycle] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [shopId, setShopId] = useState(SHOP_EXAMPLES[0].id);
  const rain = useFridayRain();
  const friday = useMemo(() => Object.fromEntries(SHOP_EXAMPLES.map((e) => [e.id, shopTomorrow(e.id, 0.4, 3, (rain ?? 0) / 100).total])), [rain]);

  useEffect(() => {
    if (level !== 'europe' || hover !== null || picked !== null) return undefined;
    const timer = setInterval(() => setCycle((c) => (c + 1) % CYCLE.length), 3200);
    return () => clearInterval(timer);
  }, [level, hover, picked]);

  const countryIndex = level === 'europe' ? hover ?? picked ?? CYCLE[cycle] : ITALY;
  const country = europe.countries[countryIndex];
  const shop = SHOP_EXAMPLES.find((e) => e.id === shopId)!;

  return (
    <>
    <div className="home">
      <div className="home-map">
        <EuropeMap
          ref={map}
          country={countryIndex}
          shop={shopId}
          onLevel={setLevel}
          onCountry={(i) => setHover(i)}
          onShop={(id, open) => {
            setShopId(id);
            if (open) window.location.hash = `#/order?shop=${id}`;
          }}
        />
        <aside className="readout">
          <div className="levels" role="group" aria-label="Map level">
            {LEVELS.map((l) => (
              <button key={l.id} aria-pressed={level === l.id} onClick={() => map.current?.fly(l.id)}>
                {level === l.id && <motion.span layoutId="level" className="switch-pill" transition={SPRING} />}
                <span className="switch-text">{l.label}</span>
              </button>
            ))}
          </div>
          {level === 'turin' ? (
            <>
              <p className="readout-name">{shop.shop}, {shop.area}</p>
              <p className="readout-num"><CountTo value={friday[shop.id]} /><span>{shop.unit}</span></p>
              <p className="readout-note">One number for Friday. Example shops, made up. Click a shop.</p>
            </>
          ) : (
            <>
              <p className="readout-name">{country.name}</p>
              <p className="readout-num"><CountTo value={country.kg ?? 0} /><span>kg</span></p>
              <p className="readout-note">Food thrown away per person in a year. Eurostat, {country.year}. Scroll on the map to zoom.</p>
            </>
          )}
        </aside>
      </div>

      <div className="home-text">
        <motion.figure className="clip" initial={{ opacity: 0, rotate: -5, y: 24 }} animate={{ opacity: 1, rotate: -1.5, y: 0 }} transition={SPRING}>
          <blockquote>“I let ChatGPT’s new ‘agent’ manage my life. It spent $31 on a dozen eggs.”</blockquote>
          <figcaption>The Washington Post, 2025</figcaption>
        </motion.figure>
        <h1>In 2028, AI agents pay on their own.</h1>
        <p className="lead">An AI agent knows what it will buy. The shop does not know how much to prepare. Nexi connects the two, and keeps the money safe.</p>
        <NextButton href="#/customers">Start with the customers</NextButton>
      </div>
    </div>
    <section className="why-section" aria-label="Why now">
      <dl className="why-now">
        {WHY_NOW.map((s) => <div key={s.figure}><dt>{s.figure}</dt><dd>{s.claim}. <i>{s.publisher}</i></dd></div>)}
      </dl>
    </section>
    </>
  );
}
