// One shared world. With the local server, every device on the network sees the same state.
// Without it (static hosting), the tabs of one browser share the state.
import { useSyncExternalStore } from 'react';
import { initialWorld, marketOf, reduce, type Action, type World } from './world';

const KEY = 'nexi.world.v2';
const listeners = new Set<() => void>();
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(KEY);
let mode: 'browser' | 'network' = 'browser';
let world = load();
let joinUrl = '';

function load(): World {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as World | null;
    if (saved?.markets?.[saved.market]?.people) return saved;
  } catch { /* storage can be blocked: start fresh */ }
  return initialWorld();
}

function set(next: World, share: boolean) {
  if (next === world) return;
  world = next;
  listeners.forEach((f) => f());
  if (mode === 'network') return;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* optional */ }
  if (share) channel?.postMessage(next);
}

channel?.addEventListener('message', (e) => { if (mode === 'browser') set(e.data as World, false); });

async function connect() {
  try {
    const res = await fetch('/api/world');
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) return;
    const first = (await res.json()) as World;
    mode = 'network';
    set(first, false);
    new EventSource('/api/events').onmessage = (e) => set(JSON.parse(e.data) as World, false);
    const info = (await (await fetch('/api/info')).json()) as { urls: string[] };
    joinUrl = info.urls[0] ? `${info.urls[0].replace(/\/$/, '')}/#/customer?join=1` : '';
    listeners.forEach((f) => f());
  } catch { /* no local server: stay in this browser */ }
}
void connect();

export function act(action: Action) {
  set(reduce(world, action), true);
  if (mode === 'network') void fetch('/api/act', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action) }).catch(() => undefined);
}

const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => { listeners.delete(f); };
};

export function useWorld() {
  const w = useSyncExternalStore(subscribe, () => world);
  const market = marketOf(w.market);
  return { world: w, market, ms: w.markets[market.id] };
}

export function useSync() {
  return { mode: useSyncExternalStore(subscribe, () => mode), joinUrl: useSyncExternalStore(subscribe, () => joinUrl) };
}

const ME = 'nexi.me';
let me = 'p0';
try { me = sessionStorage.getItem(ME) ?? 'p0'; } catch { /* optional */ }

export function setMe(id: string) {
  me = id;
  try { sessionStorage.setItem(ME, id); } catch { /* optional */ }
  listeners.forEach((f) => f());
}
export const useMe = () => useSyncExternalStore(subscribe, () => me);
