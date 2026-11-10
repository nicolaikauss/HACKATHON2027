import { motion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CHECKS, trace } from '../lib/guard';

export const SPRING = { type: 'spring', stiffness: 280, damping: 28 } as const;
export const TAP = { whileTap: { scale: 0.97 }, transition: SPRING };

const ICONS = {
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  minus: 'M5 12h14',
  plus: 'M5 12h14M12 5v14',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2',
  shield: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1zM9 12l2 2 4-4',
  bot: 'M12 8V4H8M6 8h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zM2 14h2M20 14h2M15 13v2M9 13v2',
  store: 'M3 9l1.5-5h15L21 9M4.5 12v8h15v-8M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M10 20v-5h4v5',
  truck: 'M2 6h12v10H2zM14 9h4l4 4v3h-8zM6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  phone: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
  reset: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  eyeoff: 'M2 2l20 20M6.7 6.7C4 8.3 2 12 2 12s3.6 7 10 7c1.9 0 3.5-.5 5-1.3M10 5.2c.6-.1 1.3-.2 2-.2 6.4 0 10 7 10 7s-.7 1.4-2 3M9.9 9.9a3 3 0 0 0 4.2 4.2',
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={ICONS[name]} /></svg>;
}

/** The real Nexi wordmark. Its colour comes from the surface it sits on. */
export function NexiLogo({ className = '' }: { className?: string }) {
  return <span role="img" aria-label="Nexi" className={`nexi-logo ${className}`} />;
}

/** Moves smoothly to a new number. */
export function CountTo({ value, format = (n: number) => String(Math.round(n)) }: { value: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    const from = current.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 700);
      current.current = from + (value - from) * (1 - (1 - t) ** 3);
      setShown(current.current);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(shown)}</>;
}

type StepperProps = { label: string; value: number; step: number; min: number; max: number; format: (n: number) => string; onChange: (n: number) => void; disabled?: boolean };

export function Stepper({ label, value, step, min, max, format, onChange, disabled }: StepperProps) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button aria-label={`Less: ${label}`} disabled={disabled || value <= min} onClick={() => onChange(Math.max(min, value - step))}><Icon name="minus" size={18} /></button>
      <output>{format(value)}</output>
      <button aria-label={`More: ${label}`} disabled={disabled || value >= max} onClick={() => onChange(Math.min(max, value + step))}><Icon name="plus" size={18} /></button>
    </div>
  );
}

export function Toggle({ label, on, onChange, danger }: { label: string; on: boolean; onChange: (on: boolean) => void; danger?: boolean }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={`toggle${danger ? ' danger' : ''}`} onClick={() => onChange(!on)}><i /></button>;
}

export function Seg<T extends string>({ id, label, options, value, onChange }: { id: string; label: string; options: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} aria-pressed={o.id === value} onClick={() => onChange(o.id)}>
          {o.id === value && <motion.i layoutId={id} className="seg-pill" transition={SPRING} />}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export type Tone = 'good' | 'bad' | 'wait' | 'plain';
export const toneOf = (outcome: string): Tone => (outcome === 'paid' ? 'good' : outcome === 'ask' ? 'wait' : 'bad');
export const Tag = ({ tone, children }: { tone: Tone; children: ReactNode }) => <span className={`tag ${tone}`}>{children}</span>;

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <div><b>{label}</b>{hint && <small>{hint}</small>}</div>
      {children}
    </div>
  );
}

const STATE_ICON = { pass: 'check', fail: 'x', wait: 'clock' } as const;

/** The seven checks in their fixed order, with what each one did for the last payment. */
export function Checks({ entry }: { entry?: { n: number; rule: string; outcome: string } }) {
  const states = entry ? trace(entry.rule, entry.outcome) : null;
  return (
    <ol className="checks">
      {CHECKS.map((c, i) => {
        const state = states?.[i] ?? 'idle';
        return (
          <motion.li key={`${entry?.n ?? 0}-${c.id}`} className={state} initial={entry ? { opacity: 0, x: -10 } : false} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08, duration: 0.25 }}>
            <i>{state === 'pass' || state === 'fail' || state === 'wait' ? <Icon name={STATE_ICON[state]} size={15} /> : i + 1}</i>
            <span>{c.name}</span>
          </motion.li>
        );
      })}
    </ol>
  );
}
