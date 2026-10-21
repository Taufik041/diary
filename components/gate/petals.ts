import { css, mix, type Palette, type RGB } from "./palette";

// Falling petals on a canvas. Budget for a mid-range phone: 25–40 petals, a
// single requestAnimationFrame loop, no per-frame allocation, no shadows or
// gradients per frame — each tint is drawn once into a sprite and stamped
// with drawImage. Device pixel ratio is capped at 2.

/** A rounded teardrop, 100 units tall, centred on the origin, tip up. */
export const PETAL_PATH =
  "M0 -50C18 -28 36 -2 33 20C30 42 14 50 0 50C-14 50 -30 42 -33 20C-36 -2 -18 -28 0 -50Z";

// Sprite: the petal is drawn PETAL px tall inside a SPRITE px square, leaving
// room for the night glow.
const SPRITE = 48;
const PETAL = 28;
const MAX_DPR = 2;
const MAX_BURST = 80;

type Tint = 0 | 1;

interface Petal {
  x: number; // centre of the sway
  y: number;
  z: number; // depth, 0.45 (far) – 1 (near)
  size: number; // visual height, css px
  vx: number;
  vy: number;
  swayAmp: number;
  swayFreq: number;
  phase: number;
  rot: number;
  vrot: number;
  flip: number; // turning over: drawn as a squash across the petal
  vflip: number;
  tint: Tint;
  burst: boolean; // shed by withering letters; not replaced when it falls out
  // Where it was last drawn, for catching.
  rx: number;
  ry: number;
}

export interface Caught {
  x: number;
  y: number;
  size: number;
  rot: number;
  tint: Tint;
}

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export class PetalField {
  private ctx: CanvasRenderingContext2D;
  private petals: Petal[] = [];
  private sprites: HTMLCanvasElement[] = [];
  private path = new Path2D(PETAL_PATH);
  private w = 0;
  private h = 0;
  private dpr = 1;
  private scale = 1; // petal size by screen size
  private raf = 0;
  private last = 0;
  private time = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private palette: Palette,
    private reduced: boolean,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.resize();
  }

  /** How many petals for this screen: 25 on a phone, up to 40 on a desktop. */
  private target() {
    if (this.reduced) return 8;
    return Math.round(clamp((this.w * this.h) / 28_000, 25, 40));
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w;
    this.h = h;
    this.scale = clamp(Math.min(w, h) / 600, 0.85, 1.35);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    if (dpr !== this.dpr || this.sprites.length === 0) {
      this.dpr = dpr;
      this.buildSprites();
    }
    const resting = this.petals.filter((p) => !p.burst);
    const n = this.target();
    while (resting.length < n) {
      const p = this.spawn(true);
      resting.push(p);
      this.petals.push(p);
    }
    if (resting.length > n) {
      const drop = new Set(resting.slice(n));
      this.petals = this.petals.filter((p) => !drop.has(p));
    }
    for (const p of this.petals) p.x = Math.min(p.x, w);
  }

  setPalette(palette: Palette) {
    this.palette = palette;
    this.buildSprites();
  }

  setReduced(reduced: boolean) {
    if (reduced === this.reduced) return;
    this.reduced = reduced;
    this.petals = [];
    this.w = 0; // force a refill
    this.resize();
  }

  start() {
    if (this.raf) return;
    this.last = performance.now();
    const frame = (now: number) => {
      // Clamped so a backgrounded tab doesn't jump on return.
      const dt = Math.min((now - this.last) / 1000, 0.05);
      this.last = now;
      this.step(dt);
      this.draw();
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  isOver(x: number, y: number): boolean {
    return this.find(x, y) !== null;
  }

  /** The petal under (x, y), removed from the fall. */
  catchAt(x: number, y: number): Caught | null {
    const best = this.find(x, y);
    if (!best) return null;
    const caught = { x: best.rx, y: best.ry, size: best.size, rot: best.rot, tint: best.tint };
    // It is replaced from the top, as if it had fallen out of view.
    Object.assign(best, this.spawn(false));
    return caught;
  }

  /** The catch radius is at least 22px — a 44px target, whatever the
   *  petal's size. Petals shed by letters can't be caught. */
  private find(x: number, y: number): Petal | null {
    let best: Petal | null = null;
    let bestScore = Infinity;
    for (const p of this.petals) {
      if (p.burst) continue;
      const d = Math.hypot(p.rx - x, p.ry - y);
      const reach = Math.max(22, p.size * 0.9);
      // Nearest wins; nearer the viewer breaks ties.
      const score = d / reach - p.z * 0.05;
      if (d <= reach && score < bestScore) {
        best = p;
        bestScore = score;
      }
    }
    return best;
  }

  /** Petals shed from (x, y) points — letters falling apart. */
  burst(points: { x: number; y: number }[], perPoint: number) {
    for (const pt of points) {
      for (let i = 0; i < perPoint; i++) {
        if (this.petals.filter((p) => p.burst).length >= MAX_BURST) return;
        const p = this.spawn(false);
        p.burst = true;
        p.x = pt.x + rand(-8, 8);
        p.y = pt.y + rand(-12, 12);
        p.z = rand(0.75, 1);
        p.size = this.sizeFor(p.z) * 0.85;
        p.vx = rand(-70, 70);
        p.vy = rand(-90, -20);
        p.swayAmp = 0;
        this.petals.push(p);
      }
    }
  }

  private sizeFor(z: number) {
    return (8 + 12 * z) * this.scale;
  }

  private spawn(anywhere: boolean): Petal {
    const z = rand(0.45, 1);
    const size = this.sizeFor(z);
    const still = this.reduced;
    return {
      x: rand(0, this.w),
      y: anywhere ? rand(-size, this.h) : rand(-size * 4, -size),
      z,
      size,
      vx: rand(4, 12) * z, // a light breeze
      vy: (still ? 0.5 : 1) * (14 + 30 * z), // nearer falls faster
      swayAmp: (still ? 6 : rand(14, 34)) * z,
      swayFreq: rand(0.5, 1.1),
      phase: rand(0, Math.PI * 2),
      rot: rand(-0.6, 0.6),
      vrot: still ? 0 : rand(-0.8, 0.8),
      flip: rand(0, Math.PI * 2),
      vflip: still ? 0 : rand(0.6, 1.6),
      tint: Math.random() < 0.55 ? 0 : 1,
      burst: false,
      rx: 0,
      ry: 0,
    };
  }

  private step(dt: number) {
    this.time += dt;
    const { w, h } = this;
    for (let i = this.petals.length - 1; i >= 0; i--) {
      const p = this.petals[i];
      if (p.burst) {
        // Thrown, then settling to an ordinary fall.
        p.vy = Math.min(p.vy + 160 * dt, 30 + 30 * p.z);
        p.vx *= 1 - 1.5 * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
      p.flip += p.vflip * dt;
      if (p.y - p.size > h) {
        if (p.burst) this.petals.splice(i, 1);
        else Object.assign(p, this.spawn(false));
        continue;
      }
      // Off one side, back in on the other.
      const margin = p.swayAmp + p.size;
      if (p.x > w + margin) p.x = -margin;
      else if (p.x < -margin) p.x = w + margin;
    }
  }

  private draw() {
    const { ctx, dpr } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const p of this.petals) {
      const x = p.x + Math.sin(this.time * p.swayFreq + p.phase) * p.swayAmp;
      p.rx = x;
      p.ry = p.y;
      const s = (p.size / PETAL) * dpr;
      // Turning over reads as a squash across the petal.
      const sx = s * (0.35 + 0.65 * Math.abs(Math.cos(p.flip)));
      const cos = Math.cos(p.rot);
      const sin = Math.sin(p.rot);
      ctx.setTransform(sx * cos, sx * sin, -s * sin, s * cos, x * dpr, p.y * dpr);
      // Farther petals are fainter.
      ctx.globalAlpha = 0.35 + 0.6 * p.z;
      ctx.drawImage(this.sprites[p.tint], -SPRITE / 2, -SPRITE / 2, SPRITE, SPRITE);
    }
    ctx.globalAlpha = 1;
  }

  private buildSprites() {
    const { palette, dpr } = this;
    this.sprites = ([palette.petalA, palette.petalB] as RGB[]).map((fill) => {
      const c = document.createElement("canvas");
      c.width = c.height = Math.ceil(SPRITE * dpr);
      const g = c.getContext("2d")!;
      g.scale(dpr, dpr);
      g.translate(SPRITE / 2, SPRITE / 2);
      g.scale(PETAL / 100, PETAL / 100);
      if (palette.glow > 0) {
        g.shadowColor = css(mix(fill, [255, 255, 255], 0.3), 0.85 * palette.glow);
        g.shadowBlur = 14 * palette.glow * dpr;
      }
      // Lighter toward the tip.
      const grad = g.createLinearGradient(0, -50, 0, 50);
      grad.addColorStop(0, css(mix(fill, palette.speckCentre, 0.45)));
      grad.addColorStop(1, css(fill));
      g.fillStyle = grad;
      g.fill(this.path);
      g.shadowColor = "transparent";
      g.strokeStyle = css(palette.edge, 0.35);
      g.lineWidth = 100 / PETAL / 2; // half a css px
      g.stroke(this.path);
      return c;
    });
  }
}
