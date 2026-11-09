// Redraws the rendered board the way the country map is drawn: a staggered grid of dots whose
// size follows the light, plus thin contour lines. The ground takes the sector's colour; cyan is
// water, amber and red are the alert states.
import * as THREE from 'three'

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform vec2 uSize;
  uniform float uCell;
  uniform float uDots;
  uniform float uReveal;
  uniform float uEdge;
  uniform vec3 uLow;
  uniform vec3 uHigh;
  varying vec2 vUv;

  float depthAt(vec2 p) {
    return texture2D(tDepth, p / uSize).x;
  }

  void main() {
    vec2 px = vUv * uSize;

    // The same staggered rows as the map.
    float rowHeight = uCell * 0.866;
    float row = floor(px.y / rowHeight);
    float shift = mod(row, 2.0) * 0.5 * uCell;
    vec2 center = vec2((floor((px.x - shift) / uCell) + 0.5) * uCell + shift, (row + 0.5) * rowHeight);

    // Four taps inside the cell, so an edge shades its dots instead of cutting them.
    float tap = uCell * 0.25;
    vec4 sampled = (texture2D(tColor, (center + vec2(-tap, -tap)) / uSize) + texture2D(tColor, (center + vec2(tap, -tap)) / uSize)
      + texture2D(tColor, (center + vec2(-tap, tap)) / uSize) + texture2D(tColor, (center + vec2(tap, tap)) / uSize)) * 0.25;
    float cover = sampled.a;
    vec3 c = sqrt(clamp(sampled.rgb / max(cover, 0.001), 0.0, 1.0));
    float lum = dot(c, vec3(0.3, 0.59, 0.11));

    // The picture opens from the middle, like the map's own reveal.
    float away = length(center / uSize - 0.5) * 1.5;
    float open = smoothstep(away - 0.15, away + 0.05, uReveal * 1.3);

    float radius = uCell * 0.5 * (0.2 + 0.8 * sqrt(lum)) * uDots * open * step(0.03, cover) * mix(0.4, 1.0, min(cover * 2.0, 1.0));
    float dist = distance(px, center);
    float dot_ = (1.0 - smoothstep(radius - 0.7, radius + 0.7, dist)) * step(0.05, radius);

    float warm = c.r - c.b;
    float ratio = c.g / max(c.r, 0.01);
    float hot = smoothstep(0.45, 0.6, warm);
    float red = hot * (1.0 - smoothstep(0.45, 0.6, ratio));
    float amber = hot * smoothstep(0.45, 0.6, ratio) * (1.0 - smoothstep(0.72, 0.85, ratio));
    float cold = smoothstep(0.16, 0.32, c.b - c.r);

    vec3 tone = mix(uLow, uHigh, lum);
    tone = mix(tone, mix(vec3(0.05, 0.3, 0.42), vec3(0.5, 0.95, 1.0), lum), cold);
    tone = mix(tone, vec3(1.0, 0.56, 0.1), amber);
    tone = mix(tone, vec3(1.0, 0.3, 0.24), red);
    tone = mix(tone, mix(uHigh, vec3(1.0), 0.8), smoothstep(0.9, 1.0, lum) * (1.0 - red));

    // Contours: where the depth breaks, not where a surface merely slopes.
    float step_ = 1.5;
    float d0 = depthAt(px);
    float dl = depthAt(px - vec2(step_, 0.0));
    float dr = depthAt(px + vec2(step_, 0.0));
    float du = depthAt(px + vec2(0.0, step_));
    float dd = depthAt(px - vec2(0.0, step_));
    float bend = abs(dl + dr - 2.0 * d0) + abs(du + dd - 2.0 * d0);
    float line = smoothstep(0.0005, 0.0016, bend) * open * uDots;

    vec3 lineTone = mix(uHigh, tone, 0.5);
    vec3 colour = mix(lineTone, tone, dot_);
    float alpha = max(dot_, line * 0.72);
    // Up close the picture melts into the card instead of stopping at a hard edge.
    float rim = min(min(px.x, uSize.x - px.x), min(px.y, uSize.y - px.y));
    alpha *= mix(1.0, smoothstep(0.0, 40.0 * uCell / 3.3, rim), uEdge);
    gl_FragColor = vec4(colour * alpha, alpha);
  }
`

/** A CSS colour as the shader writes it, straight to the screen. */
const display = (hex: string) => new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace)

export class DotPass {
  private target: THREE.WebGLRenderTarget
  private material: THREE.ShaderMaterial
  private screen = new THREE.Scene()
  private flat = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  constructor(low: string, high: string) {
    this.target = new THREE.WebGLRenderTarget(1, 1, { depthTexture: new THREE.DepthTexture(1, 1), minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter })
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
      uniforms: {
        tColor: { value: this.target.texture },
        tDepth: { value: this.target.depthTexture },
        uSize: { value: new THREE.Vector2(1, 1) },
        uCell: { value: 8 },
        uDots: { value: 1 },
        uReveal: { value: 1 },
        uEdge: { value: 0 },
        uLow: { value: display(low) },
        uHigh: { value: display(high) },
      },
    })
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material)
    quad.frustumCulled = false
    this.screen.add(quad)
  }

  setSize(width: number, height: number) {
    this.target.setSize(width, height)
    this.material.uniforms.uSize.value.set(width, height)
  }

  render(renderer: THREE.WebGLRenderer, world: THREE.Scene, camera: THREE.Camera, frame: { cell: number; dots: number; reveal: number; edge: number }) {
    const u = this.material.uniforms
    u.uCell.value = frame.cell
    u.uDots.value = frame.dots
    u.uReveal.value = frame.reveal
    u.uEdge.value = frame.edge
    renderer.setRenderTarget(this.target)
    renderer.setClearColor(0x000000, 0)
    renderer.clear()
    renderer.render(world, camera)
    renderer.setRenderTarget(null)
    renderer.render(this.screen, this.flat)
  }

  dispose() {
    this.target.depthTexture?.dispose()
    this.target.dispose()
    this.material.dispose()
  }
}
