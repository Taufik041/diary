import { PAGE_H, PAGE_W, type PageElement } from "@/lib/diary/types";

export interface Vec {
  x: number;
  y: number;
}

export type Box = Pick<PageElement, "x" | "y" | "w" | "h" | "rotation">;

export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
export const len = (a: Vec) => Math.hypot(a.x, a.y);
export const angle = (a: Vec) => Math.atan2(a.y, a.x);
export const rotate = (a: Vec, rad: number): Vec => ({
  x: a.x * Math.cos(rad) - a.y * Math.sin(rad),
  y: a.x * Math.sin(rad) + a.y * Math.cos(rad),
});

const DEG = Math.PI / 180;

export const normalizeDeg = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

// ── Client pixels ↔ page units ──────────────────────────────────────────────

// client = origin + x·ex + y·ey, where (x, y) are page units.
export interface PageMatrix {
  origin: Vec; // client position of page (0, 0)
  ex: Vec; // client pixels per page unit along page x
  ey: Vec; // client pixels per page unit along page y
  det: number;
}

// Reads the page's current mapping from three zero-size probes at page
// (0,0), (800,0) and (0,1100). A zero-size box's bounding rect is just the
// transformed point, so this captures every ancestor transform — page scale,
// camera pan/zoom, the book's tilt — without modelling any of them.
export function readPageMatrix(frame: ParentNode): PageMatrix | null {
  const at = (name: string): Vec | null => {
    const r = frame.querySelector(`[data-probe="${name}"]`)?.getBoundingClientRect();
    return r ? { x: r.left, y: r.top } : null;
  };
  const o = at("o");
  const px = at("x");
  const py = at("y");
  if (!o || !px || !py) return null;

  const ex = mul(sub(px, o), 1 / PAGE_W);
  const ey = mul(sub(py, o), 1 / PAGE_H);
  const det = ex.x * ey.y - ey.x * ex.y;
  // Zero when the page is display:none (the hidden page on mobile).
  if (Math.abs(det) < 1e-9) return null;
  return { origin: o, ex, ey, det };
}

// Inverse of the 2×2 [ex ey], applied to (client − origin).
export function clientToPage(m: PageMatrix, c: Vec): Vec {
  const d = sub(c, m.origin);
  return {
    x: (d.x * m.ey.y - d.y * m.ey.x) / m.det,
    y: (d.y * m.ex.x - d.x * m.ex.y) / m.det,
  };
}

// The mapping is rotation × uniform scale, so |det| = scale².
export const pxPerUnit = (m: PageMatrix) => Math.sqrt(Math.abs(m.det));

// ── Element geometry (page units) ───────────────────────────────────────────
// An element is its unrotated box (x, y, w, h) turned `rotation` degrees
// clockwise about its centre. u and v are its local x and y axes.

export const center = (b: Box): Vec => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

export function axes(b: Box) {
  const r = b.rotation * DEG;
  return {
    u: { x: Math.cos(r), y: Math.sin(r) },
    v: { x: -Math.sin(r), y: Math.cos(r) },
  };
}

const at = (b: Box, sx: number, sy: number): Vec => {
  const { u, v } = axes(b);
  return add(center(b), add(mul(u, (sx * b.w) / 2), mul(v, (sy * b.h) / 2)));
};

export function bounds(b: Box) {
  const pts = [at(b, -1, -1), at(b, 1, -1), at(b, 1, 1), at(b, -1, 1)];
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

const fromCenter = <T extends Box>(b: T, c: Vec, w: number, h: number): T => ({
  ...b,
  x: c.x - w / 2,
  y: c.y - h / 2,
  w,
  h,
});

export type Handle = "nw" | "ne" | "se" | "sw" | "e" | "w";

// Which side of the centre each handle sits on, along u and v.
const SIGN: Record<Handle, readonly [number, number]> = {
  nw: [-1, -1],
  ne: [1, -1],
  se: [1, 1],
  sw: [-1, 1],
  e: [1, 0],
  w: [-1, 0],
};

export const handlePoint = (b: Box, h: Handle) => at(b, SIGN[h][0], SIGN[h][1]);

// The point that stays put while `h` is dragged: the opposite corner, or the
// midpoint of the opposite edge.
const anchor = (b: Box, h: Handle) => at(b, -SIGN[h][0], -SIGN[h][1]);

export const MIN_SIZE = 16;

// Free resize. q is where the handle should be, in page units. The vector
// from the anchor to q is projected onto the element's own axes, so a
// rotated element grows along its sides, not along the screen's.
export function resizeFree<T extends Box>(b0: T, h: Handle, q: Vec): T {
  const [sx, sy] = SIGN[h];
  const { u, v } = axes(b0);
  const f = anchor(b0, h);
  const r = sub(q, f);
  const w = sx ? Math.max(MIN_SIZE, sx * dot(r, u)) : b0.w;
  const hh = sy ? Math.max(MIN_SIZE, sy * dot(r, v)) : b0.h;
  const c = add(f, add(mul(u, (sx * w) / 2), mul(v, (sy * hh) / 2)));
  return fromCenter(b0, c, w, hh);
}

// Aspect-locked resize from a corner. k is the projection of (q − anchor)
// onto the original anchor→corner diagonal.
export function resizeUniform<T extends Box>(b0: T, h: Handle, q: Vec): { box: T; k: number } {
  const [sx, sy] = SIGN[h];
  const { u, v } = axes(b0);
  const f = anchor(b0, h);
  const diag = add(mul(u, sx * b0.w), mul(v, sy * b0.h));
  const k = Math.max(MIN_SIZE / Math.min(b0.w, b0.h), dot(sub(q, f), diag) / dot(diag, diag));
  return { box: fromCenter(b0, add(f, mul(diag, k / 2)), b0.w * k, b0.h * k), k };
}

// New height with the top edge held in place (in the element's own frame),
// so refitting text on a tilted box grows it downward along its tilt.
export function withHeight<T extends Box>(b: T, h: number): T {
  const { v } = axes(b);
  const top = sub(center(b), mul(v, b.h / 2));
  return fromCenter(b, add(top, mul(v, h / 2)), b.w, h);
}

// Rotation handle: the change in the pointer's angle around the centre.
export const rotationAt = (b0: Box, c0: Vec, a0: number, p: Vec) =>
  normalizeDeg(b0.rotation + (angle(sub(p, c0)) - a0) / DEG);

// Two-finger transform. The element scales by the change in finger distance,
// turns by the change in finger angle, and its centre keeps its position
// relative to the fingers' midpoint — so it stays pinned under the fingers.
export function pinch<T extends Box>(
  b0: T,
  a0: Vec,
  b0p: Vec,
  a: Vec,
  b: Vec,
): { box: T; k: number } {
  const k = Math.max(MIN_SIZE / Math.min(b0.w, b0.h), len(sub(b, a)) / len(sub(b0p, a0)));
  const turn = angle(sub(b, a)) - angle(sub(b0p, a0));
  const mid0 = mul(add(a0, b0p), 0.5);
  const mid = mul(add(a, b), 0.5);
  const c = add(mid, rotate(mul(sub(center(b0), mid0), k), turn));
  const box = fromCenter(b0, c, b0.w * k, b0.h * k);
  return { box: { ...box, rotation: normalizeDeg(b0.rotation + turn / DEG) }, k };
}

// ── Snapping ────────────────────────────────────────────────────────────────

export interface Guide {
  axis: "x" | "y";
  at: number;
}

const PAGE_LINES_X = [0, PAGE_W / 2, PAGE_W];
const PAGE_LINES_Y = [0, PAGE_H / 2, PAGE_H];
const ALIGNED = 0.5;

// Snaps a moving element's bounding box (edges and centre) to the page edges,
// the page centre lines, and other elements' bounding-box edges and centres.
// Returns every line the element touches once snapped, for drawing guides.
export function snapMove<T extends Box>(
  b: T,
  others: Box[],
  threshold: number,
): { box: T; guides: Guide[] } {
  const self = bounds(b);
  const tx = [...PAGE_LINES_X];
  const ty = [...PAGE_LINES_Y];
  for (const o of others) {
    const ob = bounds(o);
    tx.push(ob.minX, (ob.minX + ob.maxX) / 2, ob.maxX);
    ty.push(ob.minY, (ob.minY + ob.maxY) / 2, ob.maxY);
  }
  const sx = [self.minX, (self.minX + self.maxX) / 2, self.maxX];
  const sy = [self.minY, (self.minY + self.maxY) / 2, self.maxY];

  const dx = nearestOffset(sx, tx, threshold);
  const dy = nearestOffset(sy, ty, threshold);

  const guides: Guide[] = [];
  const touching = (axis: Guide["axis"], sources: number[], targets: number[], d: number) => {
    for (const t of new Set(targets)) {
      if (sources.some((s) => Math.abs(s + d - t) < ALIGNED)) guides.push({ axis, at: t });
    }
  };
  if (dx !== null) touching("x", sx, tx, dx);
  if (dy !== null) touching("y", sy, ty, dy);

  return { box: { ...b, x: b.x + (dx ?? 0), y: b.y + (dy ?? 0) }, guides };
}

function nearestOffset(sources: number[], targets: number[], threshold: number) {
  let best: number | null = null;
  for (const s of sources) {
    for (const t of targets) {
      const d = t - s;
      if (Math.abs(d) <= threshold && (best === null || Math.abs(d) < Math.abs(best))) best = d;
    }
  }
  return best;
}
