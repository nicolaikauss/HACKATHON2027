import { useEffect, useRef, type PointerEvent } from 'react';
import * as THREE from 'three';
import { DotPass } from './dots';
import { buildTray, type Goods, type Item } from './products';

const RATIO = 2;

class Tray {
  private renderer: THREE.WebGLRenderer;
  private world = new THREE.Scene();
  private camera = new THREE.OrthographicCamera();
  private pass = new DotPass('#3a40b8', '#f6f4ff');
  private root: THREE.Group | null = null;
  private items: Item[] = [];
  private born = 0;
  private w = 1;
  private h = 1;
  turn = 0;

  constructor(canvas: HTMLCanvasElement, private span: number, private cell: number) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(RATIO);
    this.renderer.autoClear = false;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.world.add(new THREE.HemisphereLight(0xffffff, 0xcdbfa6, 2.1));
    const sun = new THREE.DirectionalLight(0xfff0dc, 2.3);
    sun.position.set(-11, 24, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 60 });
    this.world.add(sun);
  }

  resize(w: number, h: number) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.renderer.setSize(this.w, this.h, false);
    this.pass.setSize(Math.round(this.w * RATIO), Math.round(this.h * RATIO));
  }

  setGoods(goods: Goods, cols: number, rows: number, bad: number, t: number) {
    if (this.root) this.world.remove(this.root);
    const tray = buildTray(goods, cols, rows, bad);
    this.root = tray.root;
    this.items = tray.items;
    this.born = t;
    this.world.add(this.root);
  }

  draw(t: number) {
    const aspect = this.w / this.h;
    const cam = this.camera;
    const halfH = Math.max(this.span / aspect, this.span * 0.56);
    cam.left = -halfH * aspect;
    cam.right = halfH * aspect;
    cam.top = halfH;
    cam.bottom = -halfH;
    cam.near = 1;
    cam.far = 120;
    const az = Math.PI / 5 + this.turn + Math.sin(t * 0.35) * 0.1;
    const el = 0.66;
    const r = 60;
    cam.position.set(r * Math.cos(el) * Math.sin(az), r * Math.sin(el), r * Math.cos(el) * Math.cos(az));
    cam.lookAt(0, 0.3, 0);
    cam.updateProjectionMatrix();
    const age = t - this.born;
    for (const item of this.items) {
      const u = Math.max(0, Math.min(1, (age - item.delay) / 0.45));
      item.group.position.y = (1 - u) ** 3 * 5;
      item.group.scale.setScalar(0.4 + 0.6 * Math.min(1, u * 1.4));
    }
    this.pass.render(this.renderer, this.world, cam, { cell: this.cell * RATIO, dots: 1, reveal: 1, edge: 0 });
  }

  dispose() {
    this.world.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    this.pass.dispose();
    this.renderer.dispose();
  }
}

type Props = { goods: Goods; cols: number; rows: number; bad: number; span: number; cell?: number; label: string };

export function ProductTray({ goods, cols, rows, bad, span, cell = 3.2, label }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const tray = useRef<Tray | null>(null);
  const clock = useRef(0);
  const drag = useRef<number | null>(null);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const instance = new Tray(element, span, cell);
    tray.current = instance;
    const fit = () => instance.resize(element.clientWidth, element.clientHeight);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      clock.current = (now - start) / 1000;
      instance.draw(clock.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      instance.dispose();
      tray.current = null;
    };
  }, [span, cell]);

  useEffect(() => {
    tray.current?.setGoods(goods, cols, rows, bad, clock.current);
  }, [goods, cols, rows, bad, span, cell]);

  const onMove = (e: PointerEvent) => {
    if (drag.current === null || !tray.current) return;
    tray.current.turn -= (e.clientX - drag.current) * 0.01;
    drag.current = e.clientX;
  };

  return (
    <canvas
      ref={canvas}
      className="tray"
      role="img"
      aria-label={label}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = e.clientX; }}
      onPointerMove={onMove}
      onPointerUp={() => { drag.current = null; }}
    />
  );
}
