// What the map and the 3D boards share: reading trackpad gestures the way a Mac does.

/** How fast the view catches a finger, in ms. Short enough to feel attached, long enough to hide event jitter. */
export const FOLLOW = 24
/** How fast it catches a mouse notch or a zoom button, in ms. */
export const STEP = 110
/** How quickly a released drag loses speed, in ms. */
const GLIDE = 325

/** Scroll past this much to settle which way a gesture goes, in px. */
const LOCK_AT = 3
/** A longer silence than this ends a gesture, in ms. */
const GESTURE_GAP = 160
/** How much a two-finger scroll zooms, per px. */
export const SCROLL_ZOOM = 0.006

export type WheelIntent = 'pinch' | 'pan' | 'zoom' | 'notch' | 'page' | 'wait'

let pageScrolledAt = -Infinity
document.addEventListener('scroll', (e) => (pageScrolledAt = e.timeStamp), { capture: true, passive: true })

/**
 * Two fingers sideways move the view, two fingers up and down zoom, a pinch zooms, a mouse notch zooms.
 * A gesture keeps its first reading, so a swipe never drifts into a zoom halfway. The page keeps a scroll
 * that was already running when it reached the view, and one heading out of a view that is fully zoomed out.
 */
export function wheelReader() {
  let at = -Infinity
  let lock: WheelIntent | null = null
  let across = 0
  let along = 0
  return (e: WheelEvent, zoomedOut: boolean): WheelIntent => {
    if (e.ctrlKey) return 'pinch'
    if (e.timeStamp - at > GESTURE_GAP) {
      across = along = 0
      const mouse = e.deltaMode !== 0 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 50)
      lock = e.timeStamp - pageScrolledAt < GESTURE_GAP ? 'page' : mouse ? (zoomedOut && e.deltaY > 0 ? 'page' : 'notch') : null
    }
    at = e.timeStamp
    if (lock) return lock
    across += Math.abs(e.deltaX)
    along += Math.abs(e.deltaY)
    if (Math.max(across, along) < LOCK_AT) return 'wait'
    lock = across > along ? 'pan' : zoomedOut && e.deltaY > 0 ? 'page' : 'zoom'
    return lock
  }
}

/** A mouse notch, in pixels whatever unit the browser reports. */
export const notch = (e: WheelEvent) => e.deltaY * (e.deltaMode === 1 ? 33 : 1)

/** Safari reports a trackpad pinch as gesture events, not as a wheel with ctrl. */
export function safariPinch(el: HTMLElement, onScale: (factor: number, clientX: number, clientY: number) => void) {
  type Gesture = Event & { scale: number; clientX: number; clientY: number }
  let scale = 1
  const start = (e: Event) => {
    e.preventDefault()
    scale = 1
  }
  const change = (e: Event) => {
    const g = e as Gesture
    e.preventDefault()
    onScale(g.scale / scale, g.clientX, g.clientY)
    scale = g.scale
  }
  el.addEventListener('gesturestart', start)
  el.addEventListener('gesturechange', change)
  return () => {
    el.removeEventListener('gesturestart', start)
    el.removeEventListener('gesturechange', change)
  }
}

/** Remembers the end of a drag, so that letting go carries on at the same speed. */
export class Glide {
  private moves: { t: number; x: number; y: number }[] = []
  vx = 0
  vy = 0

  add(t: number, x: number, y: number) {
    this.moves.push({ t, x, y })
    if (this.moves.length > 6) this.moves.shift()
  }

  /** Reads the speed at release, in px per ms. A finger that paused first does not throw. */
  release(t: number) {
    const recent = this.moves.filter((m) => t - m.t < 90)
    const first = recent[0]
    const last = recent[recent.length - 1]
    this.moves = []
    const span = first && last ? last.t - first.t : 0
    this.vx = span > 8 ? (last.x - first.x) / span : 0
    this.vy = span > 8 ? (last.y - first.y) / span : 0
    return this.moving
  }

  stop() {
    this.moves = []
    this.vx = this.vy = 0
  }

  get moving() {
    return Math.hypot(this.vx, this.vy) > 0.02
  }

  /** The distance covered in `ms`, losing speed as it goes. */
  step(ms: number) {
    const moved = { x: this.vx * ms, y: this.vy * ms }
    const decay = Math.exp(-ms / GLIDE)
    this.vx *= decay
    this.vy *= decay
    return moved
  }
}
