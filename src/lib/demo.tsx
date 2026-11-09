import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { makePool, NAMED, PRODUCTS, type Customer, type Offer, type Product } from './market';

type Demo = {
  product: Product;
  pool: Customer[];
  onboarded: number;
  busy: boolean;
  offer: Offer;
  confirmed: boolean;
  setProduct: (id: string) => void;
  onboardNext: () => void;
  onboardAll: () => void;
  edit: (id: number, patch: Partial<Customer>) => void;
  setOffer: (offer: Offer) => void;
  confirm: () => void;
};

const Context = createContext<Demo | null>(null);
const firstOffer = (p: Product): Offer => ({ priceCents: p.baseCents, capacity: p.capacity });

export function DemoProvider({ children }: { children: ReactNode }) {
  const [product, setProductState] = useState(PRODUCTS[0]);
  const [pool, setPool] = useState(() => makePool(PRODUCTS[0]));
  const [onboarded, setOnboarded] = useState(0);
  const [busy, setBusy] = useState(false);
  const [offer, setOfferState] = useState(() => firstOffer(PRODUCTS[0]));
  const [confirmed, setConfirmed] = useState(false);
  const timer = useRef(0);

  const stopTimer = () => {
    window.clearInterval(timer.current);
    setBusy(false);
  };
  useEffect(() => () => window.clearInterval(timer.current), []);

  const value = useMemo<Demo>(() => ({
    product, pool, onboarded, busy, offer, confirmed,
    setProduct: (id) => {
      const next = PRODUCTS.find((p) => p.id === id)!;
      stopTimer();
      setProductState(next);
      setPool(makePool(next));
      setOnboarded(0);
      setOfferState(firstOffer(next));
      setConfirmed(false);
    },
    onboardNext: () => setOnboarded((n) => Math.min(NAMED.length, n + 1)),
    onboardAll: () => {
      window.clearInterval(timer.current);
      setBusy(true);
      timer.current = window.setInterval(() => {
        setOnboarded((n) => {
          if (n + 1 >= NAMED.length) stopTimer();
          return Math.min(NAMED.length, n + 1);
        });
      }, 260);
    },
    edit: (id, patch) => {
      setPool((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      setConfirmed(false);
    },
    setOffer: (next) => {
      setOfferState(next);
      setConfirmed(false);
    },
    confirm: () => setConfirmed(true),
  }), [product, pool, onboarded, busy, offer, confirmed]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useDemo() {
  const demo = useContext(Context);
  if (!demo) throw new Error('useDemo needs DemoProvider');
  return demo;
}
