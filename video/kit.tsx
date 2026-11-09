import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);

export function useSec() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
}

/** 0 before `a`, 1 after `b`, eased in between. */
export const ramp = (sec: number, a: number, b: number) =>
  interpolate(sec, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE });

export function Rise({ at, children, y = 34, dur = 0.7, style }: { at: number; children: ReactNode; y?: number; dur?: number; style?: CSSProperties }) {
  const sec = useSec();
  const p = ramp(sec, at, at + dur);
  return <div style={{ ...style, opacity: p, translate: `0 ${(1 - p) * y}px` }}>{children}</div>;
}

export function SceneFade({ len, children, dark }: { len: number; children: ReactNode; dark?: boolean }) {
  const sec = useSec();
  const opacity = interpolate(sec, [0, 0.45, len - 0.4, len], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ opacity, background: dark ? '#15120e' : undefined }}>{children}</AbsoluteFill>;
}

export const Backdrop = () => <div className="backdrop" />;

export const DarkBackdrop = () => (
  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(170deg, #7b4a22 0%, #5a4a1f 44%, #15120e 96%)' }} />
);

export function Source({ children, light, style }: { children: ReactNode; light?: boolean; style?: CSSProperties }) {
  return <div style={{ fontSize: 22, color: light ? 'rgb(246 241 234 / .72)' : 'rgb(21 18 14 / .62)', ...style }}>{children}</div>;
}

const SIDES = { center: { left: 0, right: 0 }, right: { left: 620, right: 40 }, left: { left: 24, right: 1270 } };

export function Caption({ from, to, children, side = 'center' }: { from: number; to: number; children: ReactNode; side?: keyof typeof SIDES }) {
  const sec = useSec();
  const opacity = interpolate(sec, [from, from + 0.3, to - 0.25, to], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (opacity <= 0) return null;
  return (
    <div style={{ position: 'absolute', ...SIDES[side], bottom: 44, display: 'flex', justifyContent: 'center', opacity }}>
      <div style={{ maxWidth: 1400, padding: '20px 38px', borderRadius: 40, background: '#15120e', color: '#f6f1ea', fontSize: 40, lineHeight: 1.2, fontWeight: 500, textAlign: 'center', fontFamily: 'var(--body)', boxShadow: '0 22px 44px -20px rgb(0 0 0 / .6)' }}>
        {children}
      </div>
    </div>
  );
}

export function Display({ children, size = 120, style }: { children: ReactNode; size?: number; style?: CSSProperties }) {
  return (
    <div style={{ fontFamily: 'var(--display)', fontSize: size, fontWeight: 500, lineHeight: 1.02, letterSpacing: '-0.02em', ...style }}>
      {children}
    </div>
  );
}

export const Grey = ({ children }: { children: ReactNode }) => <span style={{ color: 'rgb(21 18 14 / .4)' }}>{children}</span>;
