import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { EuropeMap, ITALY, type Level, type MapHandle } from '../components/EuropeMap';
import { CountTo, Icon, Seg, TAP, type IconName } from '../components/parts';
import europe from '../data/europe.json';
import { WHY_NOW } from '../data/sources';
import { CHECKS, eur } from '../lib/guard';
import { act, useWorld } from '../lib/store';
import { demand, marketOf, MARKETS, plural, wanted } from '../lib/world';

const CYCLE = ['IT', 'DE', 'FR', 'ES', 'PL', 'NL', 'SE', 'EL', 'DK', 'RO'].map((id) => europe.countries.findIndex((c) => c.id === id));
const LEVELS: { id: Level; label: string }[] = [{ id: 'europe', label: 'Europe' }, { id: 'italy', label: 'Italy' }, { id: 'turin', label: 'Torino' }];
const BREAD = MARKETS[0];

const ROLES: { hash: string; icon: IconName; title: string; does: string; never: string }[] = [
  { hash: '#/customer', icon: 'user', title: 'Customer', does: 'Sets the rules one time. The AI agent buys inside them, and can be stopped at any moment.', never: 'No payment outside the rules.' },
  { hash: '#/merchant', icon: 'store', title: 'Merchant', does: 'Sees how much customers want at each price. Makes one offer and prepares the exact number.', never: 'Never sees names, budgets or limits.' },
  { hash: '#/supplier', icon: 'truck', title: 'Supplier', does: 'Sees one total in its own units, and sets one price. The shop’s agent has rules too.', never: 'Never sees the shop’s customers or prices.' },
];

export function Home() {
  const map = useRef<MapHandle>(null);
  const { world } = useWorld();
  const [level, setLevel] = useState<Level>('europe');
  const [cycle, setCycle] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [shopId, setShopId] = useState(BREAD.id);

  useEffect(() => {
    if (level !== 'europe' || hover !== null) return undefined;
    const timer = setInterval(() => setCycle((c) => (c + 1) % CYCLE.length), 3200);
    return () => clearInterval(timer);
  }, [level, hover]);

  const countryIndex = level === 'europe' ? hover ?? CYCLE[cycle] : ITALY;
  const country = europe.countries[countryIndex];
  const shop = marketOf(shopId);
  const bread = world.markets[BREAD.id];
  const luca = bread.people[0];
  const levels = demand(bread, BREAD);
  const most = Math.max(...levels.map((l) => l.units), 1);
  const open = (id: string) => {
    act({ type: 'market', id });
    window.location.hash = '#/demo';
  };

  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <p className="eyebrow">2028 · AI agents pay for people</p>
          <h1>Your AI agent pays. <em>Your rules decide.</em></h1>
          <p className="lead">Nexi checks every agent payment against the rules you set. Shops learn how much to prepare. They never learn who you are.</p>
          <div className="cta-row">
            <motion.a {...TAP} className="btn primary" href="#/demo">Open the live demo<Icon name="arrow" /></motion.a>
            <button className="btn ghost" onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}>How it works</button>
          </div>
        </div>

        <div className="map-card">
          <div className="map-stage">
            <EuropeMap
              ref={map}
              country={countryIndex}
              shop={shopId}
              onLevel={setLevel}
              onCountry={setHover}
              onShop={(id, go) => {
                setShopId(id);
                if (go) open(id);
              }}
            />
          </div>
          <div className="map-info">
            <Seg id="level" label="Map level" options={LEVELS} value={level} onChange={(id) => map.current?.fly(id)} />
            <div className="readout">
              <strong><CountTo value={level === 'turin' ? wanted(world.markets[shop.id], shop).units : country.kg ?? 0} /></strong>
              {level === 'turin' ? (
                <p><b>{shop.unit} wanted for {shop.day}</b>{shop.shop}, {shop.area}. Example shop, made up. <button className="link" onClick={() => open(shop.id)}>Open this shop</button></p>
              ) : (
                <p><b>kg of food thrown away per person in {country.name}</b>Eurostat, {country.year}. Shops guess how much to prepare. Zoom in to Torino.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <header className="section-head">
          <p className="eyebrow">How it works</p>
          <h2>Three steps. The numbers below are live.</h2>
        </header>
        <div className="steps">
          <article className="step">
            <span className="num">1</span>
            <h3>You set the rules</h3>
            <p>One time, in the Nexi app. Your agent gets a signed key, and your rules go with it.</p>
            <ul className="mini-rules">
              <li><b>{luca.name} wants</b>{plural(luca.qty, BREAD)} for {BREAD.day}</li>
              <li><b>Pays at most</b>{eur(luca.mandate.limitCents)} for one {BREAD.noun}</li>
              <li><b>Weekly budget</b>{eur(luca.mandate.weeklyCents)}</li>
            </ul>
          </article>
          <article className="step">
            <span className="num">2</span>
            <h3>Shops see totals, never people</h3>
            <p>Nexi adds the rules of all customers together. The bakery sees demand at each price.</p>
            <div className="mini-chart">
              <strong><CountTo value={wanted(bread, BREAD).units} /></strong>
              <span>{BREAD.unit} wanted for {BREAD.day}</span>
              <div className="mini-bars" aria-hidden>{levels.map((l) => <i key={l.priceCents} className={l.hidden ? 'hidden' : ''} style={{ height: `${l.hidden ? 14 : Math.max(10, (l.units / most) * 100)}%` }} />)}</div>
            </div>
          </article>
          <article className="step dark">
            <span className="num">3</span>
            <h3>Nexi checks every payment</h3>
            <p>Seven checks, always in the same order. If one check fails, no money moves.</p>
            <ol className="mini-checks">{CHECKS.map((c) => <li key={c.id}><Icon name="check" size={14} />{c.name}</li>)}</ol>
          </article>
        </div>
      </section>

      <section className="section">
        <header className="section-head">
          <p className="eyebrow">The working demo</p>
          <h2>One market, three sides. Open a side, or see them together.</h2>
        </header>
        <div className="roles">
          {ROLES.map((r) => (
            <motion.a {...TAP} key={r.hash} className="role" href={r.hash}>
              <span className="badge"><Icon name={r.icon} /></span>
              <h3>{r.title}</h3>
              <p>{r.does}</p>
              <p className="never-line"><Icon name="shield" size={18} />{r.never}</p>
              <span className="go">Open as {r.title.toLowerCase()}<Icon name="arrow" size={18} /></span>
            </motion.a>
          ))}
        </div>
        <div className="band">
          <div>
            <h3>All three on one screen</h3>
            <p>Change a rule on the left. See the shop’s numbers move on the right. On the local server, phones in the room can join as customers.</p>
          </div>
          <motion.a {...TAP} className="btn sun" href="#/demo">Open the live demo<Icon name="arrow" /></motion.a>
        </div>
      </section>

      <section className="section why">
        <figure className="clip">
          <blockquote>“I let ChatGPT’s new ‘agent’ manage my life. It spent $31 on a dozen eggs.”</blockquote>
          <figcaption>The Washington Post, 2025</figcaption>
        </figure>
        <div>
          <p className="eyebrow">Why now</p>
          <dl className="why-now">
            {WHY_NOW.map((s) => <div key={s.figure}><dt>{s.figure}</dt><dd>{s.claim}. <i>{s.publisher}</i></dd></div>)}
          </dl>
          <a className="link" href="#/sources">All sources</a>
        </div>
      </section>
    </>
  );
}
