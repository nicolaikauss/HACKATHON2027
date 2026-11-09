// Bread and eggs as matte clay models, built in code the same way as the Marsad site boards.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const INK = {
  crust: 0xd8c6a0,
  crustDeep: 0x9f8d6d,
  shell: 0xf6efe2,
  carton: 0x8f897c,
  tray: 0x7a7468,
  /** The dot shader reads this colour as an alert. Only bad items use it. */
  bad: 0xff4d3d,
} as const;

const materials = new Map<number, THREE.MeshStandardMaterial>();

function clay(color: number) {
  let m = materials.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0 });
    materials.set(color, m);
  }
  return m;
}

const SPHERE = new THREE.SphereGeometry(0.5, 22, 16);
const SCORE = new THREE.CapsuleGeometry(0.035, 0.32, 3, 8);
const EGG = new THREE.LatheGeometry(
  Array.from({ length: 19 }, (_, i) => {
    const t = (i / 18) * Math.PI;
    return new THREE.Vector2(Math.sin(t) * (0.3 - 0.05 * Math.cos(t)) + 0.0001, -Math.cos(t) * 0.4);
  }),
  20,
);

function part(geometry: THREE.BufferGeometry, color: number) {
  const mesh = new THREE.Mesh(geometry, clay(color));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function loaf(tint?: number) {
  const g = new THREE.Group();
  const body = part(SPHERE, tint ?? INK.crust);
  body.scale.set(1.45, 0.72, 0.86);
  body.position.y = 0.3;
  g.add(body);
  for (const x of [-0.3, 0, 0.3]) {
    const score = part(SCORE, tint ? INK.tray : INK.crustDeep);
    score.rotation.set(Math.PI / 2, 0.45, 0);
    score.position.set(x, 0.655 - Math.abs(x) * 0.12, 0);
    g.add(score);
  }
  return g;
}

function eggBox(tint?: number) {
  const g = new THREE.Group();
  const base = part(new RoundedBoxGeometry(1.32, 0.2, 0.8, 2, 0.05), tint ?? INK.carton);
  base.position.y = 0.1;
  g.add(base);
  for (const x of [-0.42, 0, 0.42]) {
    for (const z of [-0.2, 0.2]) {
      const egg = part(EGG, tint ?? INK.shell);
      egg.scale.setScalar(0.52);
      egg.position.set(x, 0.36, z);
      g.add(egg);
    }
  }
  return g;
}

function pastry(tint?: number) {
  const g = new THREE.Group();
  const body = part(new THREE.TorusGeometry(0.42, 0.2, 12, 20, Math.PI * 1.15), tint ?? INK.crust);
  body.rotation.set(Math.PI / 2, 0, 0.45 * Math.PI);
  body.position.y = 0.22;
  g.add(body);
  return g;
}

function sandwich(tint?: number) {
  const g = new THREE.Group();
  const layers: [number, number, number][] = [[0.09, 0.14, INK.crust], [0.21, 0.08, 0x6f8a4e], [0.31, 0.1, INK.shell], [0.45, 0.14, INK.crust]];
  for (const [y, h, color] of layers) {
    const slice = part(new THREE.CylinderGeometry(0.68, 0.68, h, 3), tint ?? color);
    slice.position.y = y;
    slice.rotation.y = 0.5;
    g.add(slice);
  }
  return g;
}

function fish(tint?: number) {
  const g = new THREE.Group();
  const body = part(SPHERE, tint ?? 0xaeb4b8);
  body.scale.set(1.3, 0.34, 0.5);
  body.position.y = 0.2;
  g.add(body);
  const tail = part(new THREE.ConeGeometry(0.24, 0.42, 3), tint ?? INK.carton);
  tail.rotation.z = -Math.PI / 2;
  tail.scale.z = 0.3;
  tail.position.set(-0.76, 0.2, 0);
  g.add(tail);
  return g;
}

function flowers(tint?: number) {
  const g = new THREE.Group();
  const wrap = part(new THREE.ConeGeometry(0.34, 0.8, 12), tint ?? INK.carton);
  wrap.rotation.x = Math.PI;
  wrap.position.y = 0.42;
  g.add(wrap);
  for (const [x, z] of [[0, 0], [0.26, 0.05], [-0.25, 0.08], [0.06, 0.26], [-0.05, -0.26]]) {
    const head = part(SPHERE, tint ?? INK.shell);
    head.scale.setScalar(0.44);
    head.position.set(x, 0.92, z);
    g.add(head);
  }
  return g;
}

function ticket(tint?: number) {
  const g = new THREE.Group();
  const card = part(new RoundedBoxGeometry(1.6, 0.06, 0.8, 2, 0.03), tint ?? INK.shell);
  card.position.y = 0.34;
  g.add(card);
  const stripe = part(new THREE.BoxGeometry(0.24, 0.02, 0.8), tint ? INK.tray : INK.carton);
  stripe.position.set(0.48, 0.38, 0);
  g.add(stripe);
  return g;
}

function medicine(tint?: number) {
  const g = new THREE.Group();
  const box = part(new RoundedBoxGeometry(1.25, 0.7, 0.8, 2, 0.04), tint ?? INK.shell);
  box.position.y = 0.35;
  g.add(box);
  for (const [w, d] of [[0.5, 0.16], [0.16, 0.5]]) {
    const bar = part(new THREE.BoxGeometry(w, 0.03, d), tint ? INK.tray : INK.carton);
    bar.position.y = 0.71;
    g.add(bar);
  }
  return g;
}

function phone(tint?: number) {
  const g = new THREE.Group();
  const body = part(new RoundedBoxGeometry(0.76, 0.1, 1.5, 2, 0.05), tint ?? INK.carton);
  body.position.y = 0.2;
  g.add(body);
  const screen = part(new RoundedBoxGeometry(0.64, 0.02, 1.32, 1, 0.01), tint ? INK.tray : INK.shell);
  screen.position.y = 0.26;
  g.add(screen);
  return g;
}

const BUILD = { bread: loaf, eggs: eggBox, pastries: pastry, sandwiches: sandwich, fish, flowers, ticket, medicine, phone };

export type Goods = keyof typeof BUILD;
export type Item = { group: THREE.Group; delay: number; bad: boolean };

/** A tray of goods. The last `bad` items have the alert colour. */
export function buildTray(goods: Goods, cols: number, rows: number, bad: number) {
  const root = new THREE.Group();
  const stepX = 1.9;
  const stepZ = 1.32;
  if (cols * rows > 1) {
    const base = part(new RoundedBoxGeometry(cols * stepX + 0.7, 0.26, rows * stepZ + 0.7, 2, 0.16), INK.tray);
    base.position.y = -0.14;
    root.add(base);
  }
  const count = cols * rows;
  const items: Item[] = [];
  for (let i = 0; i < count; i += 1) {
    const isBad = i >= count - bad;
    const group = BUILD[goods](isBad ? INK.bad : undefined);
    group.position.set(((i % cols) - (cols - 1) / 2) * stepX, 0, (Math.floor(i / cols) - (rows - 1) / 2) * stepZ);
    if (count > 1) group.rotation.y = ((i * 37) % 11) * 0.03 - 0.15;
    root.add(group);
    items.push({ group, delay: i * 0.018, bad: isBad });
  }
  return { root, items };
}
