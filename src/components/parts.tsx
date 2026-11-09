import { motion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export const SPRING = { type: 'spring', stiffness: 280, damping: 28 } as const;
export const TAP = { whileTap: { scale: 0.97 }, whileHover: { scale: 1.02 }, transition: SPRING };

/** Moves smoothly to a new number. */
function useTween(target: number, ms = 900) {
  const [value, setValue] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    const from = current.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      current.current = from + (target - from) * (1 - (1 - t) ** 3);
      setValue(current.current);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

/** The real Nexi wordmark. Its colour comes from the surface it sits on. */
export function NexiLogo({ className = '' }: { className?: string }) {
  return <span role="img" aria-label="Nexi" className={`nexi-logo ${className}`} />;
}

export function Examples({ items, value, onChange }: { items: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="examples" role="group" aria-label="Choose an example">
      <span>Choose an example:</span>
      {items.map((item) => (
        <button key={item.id} aria-pressed={item.id === value} onClick={() => onChange(item.id)}>
          {item.id === value && <motion.i layoutId="example" className="example-pill" transition={SPRING} />}
          <b>{item.label}</b>
        </button>
      ))}
    </div>
  );
}

export function CountTo({ value }: { value: number }) {
  return <>{Math.round(useTween(value))}</>;
}

export function Facts({ uses, forWhom, solves }: { uses: string; forWhom: string; solves: string }) {
  return (
    <dl className="facts">
      <div><dt>Built on</dt><dd>{uses}</dd></div>
      <div><dt>For</dt><dd>{forWhom}</dd></div>
      <div><dt>Solves today</dt><dd>{solves}</dd></div>
    </dl>
  );
}

export function NextButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <motion.a {...TAP} className="btn primary" href={href}>
      {children}
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    </motion.a>
  );
}
