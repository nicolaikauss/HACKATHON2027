// One dot map, from Europe down to the streets of Torino. Gestures match the Marsad map.
import { forwardRef, useEffect, useImperativeHandle, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { MARKETS } from '../lib/world';
import europe from '../data/europe.json';
import zoomData from '../data/zoom.json';
import { FOLLOW, Glide, notch, safariPinch, SCROLL_ZOOM, STEP as NOTCH, wheelReader } from '../lib/gestures';

export type Level = 'europe' | 'italy' | 'turin';
/** `ms` sets the length of the flight; without it, the length follows the zoom change. */
export type MapHandle = { fly: (level: Level, ms?: number) => void };
type Props = {
  country: number;
  shop: string;
  /** Shops that the customer's agent may not use. They show as closed to the agent. */
  off?: string[];
  onLevel: (level: Level) => void;
  onCountry: (index: number | null) => void;
  onShop: (id: string, open: boolean) => void;
};

const W = europe.width;
const H = europe.height;
const SCALE = W / 46;
const K = Math.cos(53 * (Math.PI / 180));
const toWorld = (lon: number, lat: number) => [(lon + 11) * SCALE, ((71 - lat) * SCALE) / K] as const;
const MAX_ZOOM = 320;
const smooth = (x: number, a: number, b: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

const kgs = europe.countries.map((c) => c.kg).filter((v): v is number => v !== null);
const KG_MIN = Math.min(...kgs);
const KG_MAX = Math.max(...kgs);
export const ITALY = europe.countries.findIndex((c) => c.id === 'IT');

const flat = (list: number[]) => {
  const n = list.length / 3;
  const xy = new Float32Array(n * 2);
  const kind = new Int8Array(n);
  for (let i = 0; i < n; i += 1) {
    xy[i * 2] = list[i * 3];
    xy[i * 2 + 1] = list[i * 3 + 1];
    kind[i] = list[i * 3 + 2];
  }
  return { xy, kind, n };
};
const LAYERS = [
  { ...flat(europe.dots.flat()), spacing: europe.step },
  { ...flat(zoomData.italy), spacing: 3.2 },
  { ...flat(zoomData.region), spacing: 0.8 },
  { ...flat(zoomData.turin), spacing: 0.09 },
];

const CITIES = [
  { id: 'torino', name: 'Torino', lon: 7.69, lat: 45.07, side: 'left' as const },
  { id: 'milano', name: 'Milano', lon: 9.19, lat: 45.46, side: 'right' as const },
  { id: 'bologna', name: 'Bologna', lon: 11.34, lat: 44.49, side: 'right' as const },
  { id: 'roma', name: 'Roma', lon: 12.5, lat: 41.9, side: 'left' as const },
  { id: 'napoli', name: 'Napoli', lon: 14.27, lat: 40.85, side: 'right' as const },
  { id: 'palermo', name: 'Palermo', lon: 13.36, lat: 38.12, side: 'left' as const },
].map((c) => ({ ...c, at: toWorld(c.lon, c.lat) }));
const SHOPS = MARKETS.map((s) => ({ ...s, at: toWorld(s.lon, s.lat) }));
const TORINO = toWorld(7.68, 45.07);

const FITS: Record<Level, { x: number; y: number; w: number; h: number } | null> = {
  europe: null,
  italy: { x: toWorld(12.4, 42)[0], y: toWorld(12.4, 42)[1], w: 260, h: 420 },
  turin: { x: TORINO[0], y: TORINO[1], w: 3.6, h: 3.6 },
};

type Hit = { id: string; kind: 'city' | 'shop'; x: number; y: number; w: number; h: number };

export const EuropeMap = forwardRef<MapHandle, Props>(function EuropeMap(props, ref) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const s = useRef({
    w: 1, h: 1, dpr: 1,
    view: { k: 1, x: W / 2, y: H / 2 },
    target: { k: 1, x: W / 2, y: H / 2 },
    follow: FOLLOW,
    fly: null as null | { t0: number; ms: number; from: { k: number; x: number; y: number }; to: { k: number; x: number; y: number } },
    glide: new Glide(),
    last: 0,
    born: 0,
    level: 'europe' as Level,
    pointer: null as null | { x: number; y: number },
    hits: [] as Hit[],
    down: new Map<number, { x: number; y: number }>(),
    drag: null as null | { x: number; y: number; moved: number },
    pinch: null as null | { gap: number; x: number; y: number },
    reduced: false,
  });

  const unit = () => Math.min(s.current.w / W, s.current.h / H) * 0.97;
  const settle = () => {
    const t = s.current.target;
    t.k = clamp(t.k, 1, MAX_ZOOM);
    t.x = clamp(t.x, -W * 0.2, W * 1.2);
    t.y = clamp(t.y, -H * 0.1, H * 1.1);
  };
  const grab = () => {
    s.current.fly = null;
    s.current.glide.stop();
  };
  const startFly = (to: { k: number; x: number; y: number }, length?: number) => {
    const st = s.current;
    st.glide.stop();
    Object.assign(st.target, to);
    if (st.reduced) {
      Object.assign(st.view, to);
      return;
    }
    const ms = length ?? clamp(700 + Math.abs(Math.log(to.k / st.view.k)) * 260, 700, 2100);
    st.fly = { t0: performance.now(), ms, from: { ...st.view }, to: { ...to } };
  };
  const fly = (level: Level, ms?: number) => {
    const fit = FITS[level];
    if (!fit) return startFly({ k: 1, x: W / 2, y: H / 2 }, ms);
    const u = unit();
    startFly({ k: clamp(Math.min(s.current.w / (fit.w * u), s.current.h / (fit.h * u)) * 0.92, 1, MAX_ZOOM), x: fit.x, y: fit.y }, ms);
  };
  useImperativeHandle(ref, () => ({ fly }));

  const zoomAround = (px: number, py: number, k: number) => {
    const st = s.current;
    const t = st.target;
    const next = clamp(k, 1, MAX_ZOOM);
    const u = unit();
    const wx = (px - st.w / 2) / (t.k * u) + t.x;
    const wy = (py - st.h / 2) / (t.k * u) + t.y;
    t.k = next;
    t.x = wx - (px - st.w / 2) / (next * u);
    t.y = wy - (py - st.h / 2) / (next * u);
    settle();
  };

  const draw = (now: number) => {
    const st = s.current;
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dt = Math.min(60, now - (st.last || now));
    st.last = now;
    const { view, target } = st;
    if (st.fly) {
      const { t0, ms, from, to } = st.fly;
      const raw = Math.min(1, (now - t0) / ms);
      const e = raw * raw * raw * (raw * (raw * 6 - 15) + 10);
      const k = Math.exp(Math.log(from.k) + (Math.log(to.k) - Math.log(from.k)) * e);
      if (Math.abs(to.k - from.k) > 1e-3) {
        // A straight zoom about the one point that stays still, so the destination never swings away.
        const fx = (to.k * to.x - from.k * from.x) / (to.k - from.k);
        const fy = (to.k * to.y - from.k * from.y) / (to.k - from.k);
        view.x = fx + ((from.x - fx) * from.k) / k;
        view.y = fy + ((from.y - fy) * from.k) / k;
      } else {
        view.x = from.x + (to.x - from.x) * e;
        view.y = from.y + (to.y - from.y) * e;
      }
      view.k = k;
      if (raw >= 1) st.fly = null;
    } else {
      if (st.glide.moving && st.drag === null) {
        const moved = st.glide.step(dt);
        target.x -= moved.x / (target.k * unit());
        target.y -= moved.y / (target.k * unit());
        settle();
      }
      const blend = 1 - Math.exp(-dt / st.follow);
      view.k = Math.exp(Math.log(view.k) + (Math.log(target.k) - Math.log(view.k)) * blend);
      view.x += (target.x - view.x) * blend;
      view.y += (target.y - view.y) * blend;
    }

    const level: Level = view.k < 1.9 ? 'europe' : view.k < 30 ? 'italy' : 'turin';
    if (level !== st.level) {
      st.level = level;
      latest.current.onLevel(level);
    }

    const a0 = 1 - smooth(view.k, 1.5, 2.3);
    const a1 = smooth(view.k, 1.5, 2.3) * (1 - smooth(view.k, 8, 13));
    const a2 = smooth(view.k, 8, 13) * (1 - smooth(view.k, 40, 64));
    const a3 = smooth(view.k, 40, 64);
    const alphas = [a0, a1, a2, a3];

    const { w, h, dpr } = st;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const u = unit() * view.k;
    const sx = (x: number) => (x - view.x) * u + w / 2;
    const sy = (y: number) => (y - view.y) * u + h / 2;
    const age = now - st.born;
    const reveal = st.reduced ? Infinity : age * 0.95;
    const selected = latest.current.country;
    const active = latest.current.shop;

    const waves: { x: number; y: number; t: number }[] = [];
    if (!st.reduced) {
      const anchors: (readonly [number, number])[] =
        a3 > 0.5 ? SHOPS.map((p) => p.at) : a0 > 0.5 ? [[europe.countries[selected].x, europe.countries[selected].y]] : [CITIES[0].at];
      anchors.forEach((p, i) => {
        const t = ((now / 2400 + i * 0.37) % 1);
        waves.push({ x: sx(p[0]), y: sy(p[1]), t });
      });
    }

    const pointer = st.pointer;
    LAYERS.forEach((layer, index) => {
      const alpha = alphas[index];
      if (alpha < 0.01) return;
      const sp = layer.spacing * u;
      const paths = { ink: new Path2D(), main: new Path2D(), hot: new Path2D(), water: new Path2D() };
      for (let i = 0; i < layer.n; i += 1) {
        const wx = layer.xy[i * 2];
        const wy = layer.xy[i * 2 + 1];
        const x = (wx - view.x) * u + w / 2;
        const y = (wy - view.y) * u + h / 2;
        if (x < -12 || y < -12 || x > w + 12 || y > h + 12) continue;
        if (index === 0 && Math.hypot(wx - TORINO[0], wy - TORINO[1]) > reveal) continue;
        const kind = layer.kind[i];
        let r: number;
        let path: Path2D;
        if (index === 0) {
          const country = kind >= 0 ? europe.countries[kind] : null;
          if (country && country.kg !== null) {
            r = sp * (0.17 + 0.27 * ((country.kg - KG_MIN) / (KG_MAX - KG_MIN)));
            path = kind === selected ? paths.hot : paths.main;
            if (kind === selected) r *= 1.14;
          } else {
            r = sp * 0.13;
            path = paths.ink;
          }
        } else if (index === 3) {
          path = kind === 0 ? paths.ink : kind === 3 ? paths.water : paths.main;
          r = sp * (kind === 0 ? 0.13 : kind === 1 ? 0.27 : kind === 2 ? 0.4 : 0.3);
        } else {
          path = kind === 1 ? paths.main : paths.ink;
          r = sp * (kind === 1 ? 0.3 : 0.13);
        }
        let swell = 0;
        for (const wave of waves) {
          const d = Math.hypot(x - wave.x, y - wave.y);
          const ring = wave.t * 110;
          swell += (1 - wave.t) * Math.exp(-((d - ring) ** 2) / 170);
        }
        r += Math.min(sp * 0.24, 3) * swell;
        if (pointer) {
          const d = Math.hypot(x - pointer.x, y - pointer.y);
          r += Math.min(sp * 0.2, 2.4) * Math.exp(-(d * d) / 2600);
        }
        r = clamp(r, 0.7, 10);
        path.moveTo(x + r, y);
        path.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.globalAlpha = alpha * 0.18;
      ctx.fillStyle = '#17161f';
      ctx.fill(paths.ink);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#2d32aa';
      ctx.fill(paths.main);
      ctx.fillStyle = '#ff8d45';
      ctx.fill(paths.hot);
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = '#7f9fe6';
      ctx.fill(paths.water);
    });
    ctx.globalAlpha = 1;

    // The left edge fades into the page, so dots never cross the text at full strength.
    ctx.globalCompositeOperation = 'destination-out';
    const fade = ctx.createLinearGradient(0, 0, Math.min(150, w * 0.2), 0);
    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, Math.min(150, w * 0.2), h);
    ctx.globalCompositeOperation = 'source-over';

    const hits: Hit[] = [];
    const pill = (px: number, py: number, text: string, side: 'left' | 'right', loud: boolean, alpha: number, hit?: Hit['kind'], id?: string, off = false) => {
      if (alpha < 0.02 || px < -200 || py < -30 || px > w + 200 || py > h + 30) return;
      ctx.globalAlpha = alpha;
      ctx.font = '600 17px "DM Sans Variable", sans-serif';
      const tw = ctx.measureText(text).width + 26;
      const left = clamp(side === 'right' ? px + 12 : px - 12 - tw, 6, Math.max(6, w - tw - 6));
      const top = clamp(py - 17, 6, h - 40);
      ctx.fillStyle = loud ? '#2d32aa' : '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = off ? '#fbe5e0' : loud ? '#f4ee2b' : '#ffffff';
      ctx.beginPath();
      ctx.roundRect(left, top, tw, 34, 17);
      ctx.fill();
      ctx.fillStyle = off ? '#c42a1a' : '#17161f';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, left + 13, top + 18);
      ctx.globalAlpha = 1;
      if (hit && id) hits.push({ id, kind: hit, x: left, y: top, w: tw, h: 34 });
    };
    if (a0 > 0.02) {
      const c0 = europe.countries[selected];
      pill(sx(c0.x), sy(c0.y), `${c0.name}: ${c0.kg} kg`, c0.x > W * 0.55 ? 'left' : 'right', true, a0);
    }
    if (a1 + a2 > 0.02) {
      for (const city of CITIES) {
        if (city.id !== 'torino' && a2 > 0.5) continue;
        pill(sx(city.at[0]), sy(city.at[1]), city.id === 'torino' ? 'Torino, zoom in' : city.name, city.side, city.id === 'torino', a1 + a2, city.id === 'torino' ? 'city' : undefined, city.id);
      }
    }
    if (a3 > 0.02) {
      const off = latest.current.off ?? [];
      for (const shop of SHOPS) {
        const closed = off.includes(shop.id);
        pill(sx(shop.at[0]), sy(shop.at[1]), closed ? `${shop.shop}: not allowed` : `${shop.area}: ${shop.shop}`, shop.side, shop.id === active, a3, 'shop', shop.id, closed);
      }
    }
    st.hits = hits;
  };

  useEffect(() => {
    const el = box.current;
    const c = canvas.current;
    if (!el || !c) return;
    const st = s.current;
    st.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    st.born = performance.now();
    let raf = 0;
    let visible = true;
    const loop = (now: number) => {
      draw(now);
      raf = visible ? requestAnimationFrame(loop) : 0;
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(loop);
    });
    io.observe(el);
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      st.w = Math.max(1, rect.width);
      st.h = Math.max(1, rect.height);
      st.dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(st.w * st.dpr);
      c.height = Math.round(st.h * st.dpr);
    });
    ro.observe(el);
    raf = requestAnimationFrame(loop);

    const local = (e: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const read = wheelReader();
    const onWheel = (e: WheelEvent) => {
      const intent = read(e, st.target.k <= 1.001);
      if (intent === 'page') return;
      e.preventDefault();
      if (intent === 'wait') return;
      grab();
      if (intent === 'pan') {
        st.follow = FOLLOW;
        st.target.x += e.deltaX / (st.target.k * unit());
        st.target.y += e.deltaY / (st.target.k * unit());
        settle();
        return;
      }
      const p = local(e);
      st.follow = intent === 'notch' ? NOTCH : FOLLOW;
      const change = intent === 'pinch' ? -e.deltaY * 0.012 : intent === 'zoom' ? -e.deltaY * SCROLL_ZOOM : -notch(e) * 0.0022;
      zoomAround(p.x, p.y, st.target.k * Math.exp(change));
    };
    const dropPinch = safariPinch(el, (factor, x, y) => {
      const p = local({ clientX: x, clientY: y });
      grab();
      st.follow = FOLLOW;
      zoomAround(p.x, p.y, st.target.k * factor);
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fly('europe');
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      visible = false;
      io.disconnect();
      ro.disconnect();
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      dropPinch();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const position = (e: ReactPointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const hitAt = (p: { x: number; y: number }) => s.current.hits.find((h) => p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h);
  const countryAt = (p: { x: number; y: number }) => {
    const st = s.current;
    const u = unit() * st.view.k;
    const wx = (p.x - st.w / 2) / u + st.view.x;
    const wy = (p.y - st.h / 2) / u + st.view.y;
    const layer = LAYERS[0];
    let best = -1;
    let dist = 150;
    for (let i = 0; i < layer.n; i += 1) {
      const dx = layer.xy[i * 2] - wx;
      const dy = layer.xy[i * 2 + 1] - wy;
      const d = dx * dx + dy * dy;
      if (d < dist && layer.kind[i] >= 0 && europe.countries[layer.kind[i]].kg !== null) {
        dist = d;
        best = layer.kind[i];
      }
    }
    return best;
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = s.current;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = position(e);
    st.down.set(e.pointerId, p);
    grab();
    if (st.down.size === 2) {
      const [a, b] = [...st.down.values()];
      st.pinch = { gap: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      st.drag = null;
    } else {
      st.drag = { ...p, moved: 0 };
    }
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = s.current;
    const p = position(e);
    st.pointer = e.pointerType === 'mouse' ? p : null;
    if (st.down.has(e.pointerId)) st.down.set(e.pointerId, p);
    if (st.pinch && st.down.size === 2) {
      const [a, b] = [...st.down.values()];
      const gap = Math.hypot(a.x - b.x, a.y - b.y);
      const x = (a.x + b.x) / 2;
      const y = (a.y + b.y) / 2;
      st.follow = FOLLOW;
      st.target.x -= (x - st.pinch.x) / (st.target.k * unit());
      st.target.y -= (y - st.pinch.y) / (st.target.k * unit());
      zoomAround(x, y, st.target.k * (gap / st.pinch.gap));
      st.pinch = { gap, x, y };
      return;
    }
    if (st.drag) {
      const dx = p.x - st.drag.x;
      const dy = p.y - st.drag.y;
      st.drag.moved += Math.hypot(dx, dy);
      st.drag.x = p.x;
      st.drag.y = p.y;
      st.follow = FOLLOW;
      st.target.x -= dx / (st.target.k * unit());
      st.target.y -= dy / (st.target.k * unit());
      st.glide.add(e.timeStamp, p.x, p.y);
      settle();
      return;
    }
    const hit = hitAt(p);
    if (hit?.kind === 'shop') latest.current.onShop(hit.id, false);
    if (st.level === 'europe') {
      const found = countryAt(p);
      latest.current.onCountry(found >= 0 ? found : null);
      e.currentTarget.style.cursor = found === ITALY ? 'zoom-in' : 'grab';
    } else {
      e.currentTarget.style.cursor = hit ? 'pointer' : 'grab';
    }
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = s.current;
    st.down.delete(e.pointerId);
    if (st.pinch) {
      st.pinch = null;
      st.drag = null;
      return;
    }
    const drag = st.drag;
    st.drag = null;
    if (!drag) return;
    if (drag.moved > 5) {
      st.glide.release(e.timeStamp);
      return;
    }
    const p = position(e);
    const hit = hitAt(p);
    if (hit?.kind === 'city') fly('turin');
    else if (hit?.kind === 'shop') latest.current.onShop(hit.id, true);
    else if (st.level === 'europe') {
      const found = countryAt(p);
      if (found === ITALY) fly('italy');
      else if (found >= 0) latest.current.onCountry(found);
    }
  };
  const onDouble = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = position(e);
    grab();
    s.current.follow = NOTCH;
    zoomAround(p.x, p.y, s.current.target.k * 2.6);
  };

  return (
    <div
      ref={box}
      className="map-box"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={() => { s.current.pointer = null; latest.current.onCountry(null); }}
      onDoubleClick={onDouble}
    >
      <canvas ref={canvas} role="img" aria-label="Dot map of Europe. Zoom in to Italy and Torino." />
    </div>
  );
});
