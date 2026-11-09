import type { CSSProperties, ReactNode } from 'react';
import { Img, interpolate } from 'remotion';
import nexiLogo from '../src/assets/nexi-logo.svg';
import signals from '../src/data/signals.json';
import { Backdrop, DarkBackdrop, Display, Grey, ramp, Rise, Source, useSec } from './kit';

const PAPER_EDGE =
  'polygon(0% 2%, 4% 0%, 9% 1.6%, 15% 0.2%, 22% 1.8%, 30% 0.3%, 38% 1.6%, 47% 0%, 55% 1.8%, 64% 0.4%, 72% 1.7%, 81% 0.2%, 90% 1.8%, 96% 0.4%, 100% 2%, 99.3% 30%, 100% 62%, 99.2% 98%, 94% 99.6%, 87% 98.3%, 79% 100%, 70% 98.4%, 61% 99.8%, 52% 98.2%, 43% 100%, 34% 98.4%, 25% 99.7%, 16% 98.3%, 8% 100%, 0.6% 98%, 0% 64%, 0.8% 30%)';

function Clipping({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ filter: 'drop-shadow(0 34px 44px rgb(0 0 0 / .46))', ...style }}>
      <div style={{ background: '#f1e9d8', clipPath: PAPER_EDGE, padding: '56px 66px', color: '#15120e' }}>{children}</div>
    </div>
  );
}

export function ColdOpen() {
  const sec = useSec();
  const a = ramp(sec, 0.3, 1.1);
  const b = ramp(sec, 8.2, 9.1);
  const shift = ramp(sec, 8.2, 9.1);
  const year = sec < 7.6 ? '2025' : sec < 12.4 ? '2026' : '2028';
  return (
    <>
      <DarkBackdrop />
      <div style={{ position: 'absolute', right: 70, top: 44, fontFamily: 'var(--display)', fontSize: 94, fontWeight: 300, color: '#f4ee2b', fontVariantNumeric: 'tabular-nums' }}>{year}</div>
      <Clipping style={{ position: 'absolute', left: 130 - shift * 60, top: 150 - shift * 74, width: 1120, rotate: `${-2 - shift * 1.5}deg`, opacity: a, scale: `${1.12 - a * 0.12 - shift * 0.12}`, transformOrigin: 'left top' }}>
        <div style={{ fontFamily: 'var(--mark)', fontSize: 84, lineHeight: 1.06 }}>
          “I let ChatGPT’s new ‘agent’ manage my life. It spent $31 on a dozen eggs.”
        </div>
        <div style={{ marginTop: 26, fontSize: 28, color: 'rgb(21 18 14 / .68)' }}>The Washington Post, 2025 · AI Incident Database, no. 1028</div>
      </Clipping>
      <Rise at={3.6} style={{ position: 'absolute', left: 140, bottom: 120, width: 1500, color: '#f6f1ea', opacity: 1 }}>
        <div style={{ fontFamily: 'var(--display)', fontSize: 66, fontWeight: 500, opacity: 1 - shift }}>Asked only to compare prices, the agent bought.</div>
      </Rise>
      <Clipping style={{ position: 'absolute', right: 96, top: 560, width: 1040, rotate: '1.6deg', opacity: b, translate: `${(1 - b) * 200}px 0` }}>
        <div style={{ fontFamily: 'var(--mark)', fontSize: 58, lineHeight: 1.1 }}>Six banks warn they often can’t tell which AI agent made a purchase</div>
        <div style={{ marginTop: 22, fontSize: 28, color: 'rgb(21 18 14 / .68)' }}>Bank of America, ING, NatWest and others · reported 22 Sep 2026</div>
      </Clipping>
    </>
  );
}

export function Future() {
  const sec = useSec();
  const wall = ramp(sec, 9.2, 10.2);
  return (
    <>
      <Backdrop />
      <div style={{ position: 'absolute', left: 100, top: 90, opacity: 1 - ramp(sec, 8.6, 9.2) }}>
        <Display size={330} style={{ fontWeight: 300, letterSpacing: '-0.04em' }}>2028</Display>
        <Rise at={0.7}><Display size={82}>Agents do the routine buying.</Display></Rise>
        <Rise at={2.6}><Display size={82}><Grey>Budgets, needs, values: set once.</Grey></Display></Rise>
        <Rise at={5}><Display size={82}>Payments disappear.</Display></Rise>
        <Rise at={6.3}><Display size={82}><Grey>Control can’t.</Grey></Display></Rise>
      </div>
      <div style={{ position: 'absolute', left: 959, top: 80, width: 2, height: `${wall * 900}px`, background: '#15120e' }} />
      <div style={{ position: 'absolute', left: 110, top: 300, width: 760, opacity: ramp(sec, 9.8, 10.5) }}>
        <Display size={92}>Every agent knows what it will buy on Thursday.</Display>
      </div>
      <div style={{ position: 'absolute', right: 110, top: 300, width: 760, opacity: ramp(sec, 11.8, 12.5) }}>
        <Display size={92}><Grey>The shop filling the shelf has no idea.</Grey></Display>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 112, textAlign: 'center', opacity: ramp(sec, 14, 14.7) }}>
        <Display size={60}>Blind on both sides of the same payment.</Display>
      </div>
    </>
  );
}

type Stat = { value: string; label: string; source: string; bg: string; dark?: boolean; at: number };

function StatCard({ s, size = 128 }: { s: Stat; size?: number }) {
  const sec = useSec();
  const p = ramp(sec, s.at, s.at + 0.7);
  return (
    <div style={{ background: s.bg, color: s.dark ? '#f6f1ea' : '#15120e', borderRadius: 46, padding: '38px 44px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', opacity: p, translate: `0 ${(1 - p) * 40}px`, boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / .35)' }}>
      <Display size={size} style={{ fontWeight: 400 }}>{s.value}</Display>
      <div>
        <div style={{ fontSize: 38, lineHeight: 1.18, fontWeight: 500 }}>{s.label}</div>
        <Source light={s.dark} style={{ marginTop: 12 }}>{s.source}</Source>
      </div>
    </div>
  );
}

export function Evidence() {
  const stats: Stat[] = [
    { value: '+393%', label: 'AI traffic to US retail sites, year on year', source: 'Adobe, Q1 2026', bg: '#f4ee2b', at: 0.8 },
    { value: '30+', label: 'card issuers live on Visa agent payments in Europe', source: 'Visa Payments Forum, July 2026', bg: '#15120e', dark: true, at: 3.4 },
    { value: 'Nexi', label: 'has already run an agent-initiated payment, with Visa', source: 'Aziendabanca, 2 July 2026', bg: '#ff8d45', at: 6 },
    { value: '14%', label: 'of US AI shoppers would let it buy without checking', source: 'Product.ai survey, April 2026', bg: '#c5dffb', at: 8.8 },
  ];
  return (
    <>
      <Backdrop />
      <Rise at={0} style={{ position: 'absolute', left: 80, top: 54 }}>
        <Display size={84}>It has started. <Grey>Trust hasn’t.</Grey></Display>
      </Rise>
      <div style={{ position: 'absolute', left: 80, right: 80, top: 186, bottom: 64, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 24 }}>
        {stats.map((s) => <StatCard key={s.value} s={s} />)}
      </div>
    </>
  );
}

export function Cost() {
  const sec = useSec();
  const tn = interpolate(ramp(sec, 0.5, 2.4), [0, 1], [0, 1.7]);
  const fw = signals.foodWaste!;
  const toll = ramp(sec, 11.4, 12.2);
  return (
    <>
      <Backdrop />
      <div style={{ position: 'absolute', left: 80, top: 56, width: 1000 }}>
        <Rise at={0}><div style={{ fontSize: 40, fontWeight: 500 }}>What guessing costs, every year</div></Rise>
        <Display size={310} style={{ fontWeight: 300, letterSpacing: '-0.04em', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
          ${tn.toFixed(1)}<span style={{ fontSize: 150, color: 'rgb(21 18 14 / .4)' }}>tn</span>
        </Display>
        <Rise at={2}>
          <div style={{ fontSize: 42, lineHeight: 1.2 }}>Overstock and empty shelves: 6.2% of global retail sales.</div>
          <Source style={{ marginTop: 10 }}>IHL Group, Inventory Distortion 2026</Source>
        </Rise>
      </div>
      <div style={{ position: 'absolute', right: 80, top: 66, width: 680, display: 'grid', gap: 22 }}>
        <Rise at={4.6}>
          <div style={{ background: 'repeating-linear-gradient(135deg, rgb(21 18 14 / .1) 0 3px, transparent 3px 11px), #d5ddd2', borderRadius: 42, padding: '32px 38px' }}>
            <Display size={92} style={{ fontWeight: 400 }}>{(fw.totalT / 1e6).toFixed(1)} Mt</Display>
            <div style={{ fontSize: 34, lineHeight: 1.2, marginTop: 8 }}>of EU food wasted in {fw.year}, {(fw.retailT / 1e6).toFixed(1)} Mt of it in retail and distribution</div>
            <Source style={{ marginTop: 8 }}>Eurostat, env_wasfw</Source>
          </div>
        </Rise>
        <Rise at={7.6}>
          <div style={{ background: '#fcc7c6', borderRadius: 42, padding: '32px 38px' }}>
            <Display size={78} style={{ fontWeight: 400 }}>Now illegal</Display>
            <div style={{ fontSize: 34, lineHeight: 1.2, marginTop: 8 }}>for large firms to destroy unsold clothes and shoes in the EU</div>
            <Source style={{ marginTop: 8 }}>ESPR, from 19 July 2026</Source>
          </div>
        </Rise>
      </div>
      <div style={{ position: 'absolute', left: 80, right: 80, bottom: 54, height: 262, background: '#15120e', color: '#f6f1ea', borderRadius: 46, padding: '36px 50px', display: 'flex', alignItems: 'center', gap: 60, opacity: toll, translate: `0 ${(1 - toll) * 60}px` }}>
        <div style={{ flex: '0 0 auto' }}>
          <Display size={150} style={{ fontWeight: 300, color: '#f4ee2b' }}>2–3%</Display>
          <Source light style={{ marginTop: 2 }}>Card fees · “The 2028 Global Intelligence Crisis”, Citrini Research</Source>
        </div>
        <div style={{ fontSize: 46, lineHeight: 1.18, fontWeight: 500 }}>And for Nexi: an agent has no loyalty to a card or a rail. In 2028, the toll alone won’t hold.</div>
      </div>
    </>
  );
}

export function Intro() {
  const sec = useSec();
  const p = ramp(sec, 0.2, 1.2);
  return (
    <>
      <Backdrop />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 40, opacity: p }}>In 2028, one network connects both sides</div>
        <Img src={nexiLogo} alt="Nexi" style={{ height: 150, marginTop: 34, opacity: p, scale: `${0.94 + p * 0.06}` }} />
        <div style={{ fontSize: 36, marginTop: 34, opacity: ramp(sec, 1.2, 1.8) }}>Demand foresight, inside the payment network</div>
        <Rise at={2.6} style={{ marginTop: 56 }}>
          <Display size={92}>Know what is wanted.</Display>
          <Display size={92}><Grey>Never who wants it.</Grey></Display>
        </Rise>
      </div>
    </>
  );
}

function Box({ title, sub, x, y, w, h, at, tone = '#fff', dark }: { title: string; sub: string; x: number; y: number; w: number; h: number; at: number; tone?: string; dark?: boolean }) {
  const sec = useSec();
  const p = ramp(sec, at, at + 0.6);
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, background: tone, color: dark ? '#f6f1ea' : '#15120e', borderRadius: 30, padding: '20px 26px', opacity: p, scale: `${0.94 + p * 0.06}`, boxShadow: '0 16px 30px -18px rgb(70 40 10 / .45)' }}>
      <div style={{ fontSize: 34, fontWeight: 650, fontFamily: 'var(--display)', lineHeight: 1.05 }}>{title}</div>
      <div style={{ fontSize: 24, lineHeight: 1.22, marginTop: 7, opacity: 0.74 }}>{sub}</div>
    </div>
  );
}

function Arrow({ x1, y1, x2, y2, at, dashed }: { x1: number; y1: number; x2: number; y2: number; at: number; dashed?: boolean }) {
  const sec = useSec();
  const p = ramp(sec, at, at + 0.6);
  const x = x1 + (x2 - x1) * p;
  const y = y1 + (y2 - y1) * p;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const a = 13;
  return (
    <g opacity={p > 0 ? 1 : 0} stroke="#15120e" strokeWidth={3} fill="none" strokeLinecap="round">
      <line x1={x1} y1={y1} x2={x} y2={y} strokeDasharray={dashed ? '3 10' : undefined} />
      <path d={`M${x - a * Math.cos(angle - 0.5)} ${y - a * Math.sin(angle - 0.5)} L${x} ${y} L${x - a * Math.cos(angle + 0.5)} ${y - a * Math.sin(angle + 0.5)}`} />
    </g>
  );
}

export function Architecture() {
  const sec = useSec();
  const wall = ramp(sec, 0.4, 1.3);
  return (
    <>
      <Backdrop />
      <div style={{ position: 'absolute', left: 70, top: 44 }}>
        <Display size={68}>Two systems. <Grey>One way through.</Grey></Display>
      </div>
      <div style={{ position: 'absolute', left: 70, top: 142, fontSize: 30, fontWeight: 600 }}>Consumer side</div>
      <div style={{ position: 'absolute', left: 1130, top: 142, fontSize: 30, fontWeight: 600 }}>Merchant side</div>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <line x1={960} y1={150} x2={960} y2={150 + wall * 730} stroke="#15120e" strokeWidth={3} />
        <Arrow x1={400} y1={270} x2={470} y2={270} at={2} />
        <Arrow x1={645} y1={345} x2={645} y2={420} at={3.2} />
        <Arrow x1={470} y1={530} x2={400} y2={530} at={4.4} />
        <Arrow x1={230} y1={620} x2={230} y2={700} at={5.2} />
        <Arrow x1={830} y1={270} x2={940} y2={396} at={7} dashed />
        <Arrow x1={400} y1={800} x2={880} y2={560} at={9.2} dashed />
        <Arrow x1={1060} y1={440} x2={1130} y2={320} at={9.8} />
        <Arrow x1={1400} y1={345} x2={1400} y2={420} at={11} />
        <Arrow x1={1400} y1={620} x2={1400} y2={700} at={12.6} />
      </svg>
      <Box x={70} y={195} w={330} h={150} at={1.4} title="Any agent" sub="Signed, AP2-style intent" />
      <Box x={470} y={195} w={360} h={150} at={2.2} tone="#ff8d45" title="Mandate Registry" sub="Sign 1 spends. Sign 2 shares." />
      <Box x={470} y={420} w={360} h={200} at={3.4} tone="#15120e" dark title="Mandate Guard" sub="7 rules before authorization. Every reason is logged." />
      <Box x={70} y={470} w={330} h={150} at={4.6} tone="#fff" title="Nexi rails" sub="Authorize, settle" />
      <Box x={70} y={700} w={330} h={150} at={5.6} tone="#c5dffb" title="Paid baskets" sub="The proof of intent" />
      <div style={{ position: 'absolute', left: 860, top: 400, width: 200, background: '#f4ee2b', borderRadius: 26, padding: '16px 18px', opacity: ramp(sec, 8, 8.6), textAlign: 'center', fontSize: 26, lineHeight: 1.2, fontWeight: 600 }}>
        Consent filter<br />Group ≥ 50<br />Noise, rounding
      </div>
      <Box x={1130} y={195} w={540} h={150} at={7.6} tone="#fff" title="Aggregated intent only" sub="Items, days, areas. No people, budgets or permissions." />
      <Box x={1130} y={420} w={540} h={200} at={11.2} tone="#d5ddd2" title="Forecast engine" sub="Intent × past payment proof + walk-in baseline. Weather, holidays and prices from free public APIs." />
      <Box x={1130} y={700} w={540} h={150} at={12.8} tone="#f4ee2b" title="Merchant board and API" sub="Order suggestions in the Nexi merchant portal" />
      <div style={{ position: 'absolute', left: 70, right: 70, bottom: 54, textAlign: 'center', fontSize: 34, opacity: ramp(sec, 14.4, 15) }}>
        Extends what Nexi has already announced: its MCP server and planned AP2 support.
      </div>
    </>
  );
}

export function Ecosystem() {
  const nodes = [
    { x: 330, y: 270, t: 'Banks', d: 'offer mandates to their cardholders', at: 0.8, bg: '#c5dffb' },
    { x: 330, y: 620, t: 'Agents', d: 'plug into one trusted guard', at: 1.8, bg: '#ff8d45' },
    { x: 980, y: 620, t: 'Merchants', d: 'pay to plan with real intent', at: 2.8, bg: '#f4ee2b' },
    { x: 980, y: 270, t: 'Suppliers', d: 'buy category-level foresight', at: 3.8, bg: '#fcc7c6' },
  ];
  const sec = useSec();
  return (
    <>
      <Backdrop />
      <div style={{ position: 'absolute', left: 80, top: 56 }}>
        <Display size={80}>Why Nexi ends up <Grey>on top.</Grey></Display>
      </div>
      {nodes.map((n) => (
        <div key={n.t} style={{ position: 'absolute', left: n.x - 240, top: n.y - 118 + 90, width: 540, height: 236, borderRadius: 44, background: n.bg, padding: '30px 38px', opacity: ramp(sec, n.at, n.at + 0.6) }}>
          <Display size={70}>{n.t}</Display>
          <div style={{ fontSize: 36, lineHeight: 1.2, marginTop: 6 }}>{n.d}</div>
        </div>
      ))}
      <div style={{ position: 'absolute', right: 80, top: 244, width: 480, opacity: ramp(sec, 5, 5.7) }}>
        <Display size={64}>A marketplace sees demand too.</Display>
        <Display size={64} style={{ marginTop: 18, color: 'rgb(21 18 14 / .42)' }}>But it sells the eggs.</Display>
        <div style={{ fontSize: 40, lineHeight: 1.22, marginTop: 34, fontWeight: 500 }}>Nexi only moves the money. That neutrality is the moat.</div>
      </div>
      <div style={{ position: 'absolute', left: 90, right: 90, bottom: 62, display: 'flex', alignItems: 'center', gap: 34, opacity: ramp(sec, 7, 7.7), fontSize: 38, fontWeight: 500 }}>
        <span style={{ color: 'rgb(21 18 14 / .55)' }}>New revenue beyond the toll:</span>
        <span>Guard fee per check</span><span>·</span><span>Merchant subscription</span><span>·</span><span>Category insights</span>
      </div>
    </>
  );
}

export function Close() {
  const sec = useSec();
  return (
    <>
      <DarkBackdrop />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 150px', color: '#f6f1ea' }}>
        <Rise at={0.3}><Display size={118}>Same dozen eggs.</Display></Rise>
        <Rise at={1.6}><Display size={118} style={{ color: '#f4ee2b' }}>€4.38. Explained.</Display></Rise>
        <Rise at={3}><Display size={118} style={{ color: 'rgb(246 241 234 / .55)' }}>And the shop already knew.</Display></Rise>
        <div style={{ marginTop: 74, opacity: ramp(sec, 4.8, 5.5), display: 'flex', alignItems: 'center', gap: 36 }}>
          <span style={{ background: '#f6f1ea', borderRadius: 30, padding: '20px 30px', display: 'flex' }}><Img src={nexiLogo} alt="Nexi" style={{ height: 62 }} /></span>
          <span style={{ fontSize: 44 }}>Know what is wanted. Never who wants it.</span>
        </div>
        <div style={{ marginTop: 26, fontSize: 26, opacity: ramp(sec, 5.2, 5.9), color: 'rgb(246 241 234 / .66)' }}>
          ESCP Turin hackathon concept. Not a Nexi product. Demo and forecast results use simulated data.
        </div>
      </div>
    </>
  );
}
