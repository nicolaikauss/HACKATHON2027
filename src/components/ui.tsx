"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export const eur = (cents: number) => `€${(cents / 100).toFixed(2)}`;
export const eur0 = (cents: number) =>
  cents % 100 === 0 ? `€${cents / 100}` : eur(cents);

const paths: Record<string, ReactNode> = {
  home: <path d="M4 11.5 12 5l8 6.5V20h-5.5v-5h-5v5H4z" />,
  receipt: (
    <path d="M6 3.5h12v17l-2.4-1.5-2.4 1.5-1.2-.8-1.2.8-2.4-1.5L6 20.5zM9.5 8.5h5M9.5 12.5h5" />
  ),
  shield: <path d="M12 3.5 19 6v5.5c0 4.3-2.9 7.4-7 9-4.1-1.6-7-4.7-7-9V6z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  pause: <path d="M9 6v12M15 6v12" />,
};

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

const HOLD_MS = 2000;

export function HoldButton({
  label,
  holdingLabel,
  onComplete,
}: {
  label: string;
  holdingLabel: string;
  onComplete: () => void;
}) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };

  const start = () => {
    if (timer.current) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onComplete();
    }, HOLD_MS);
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <button
      type="button"
      className="hold"
      data-holding={holding}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") stop();
      }}
      onBlur={stop}
    >
      <span className="fill" />
      <span className="text">{holding ? holdingLabel : label}</span>
    </button>
  );
}
