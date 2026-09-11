import type { Vec } from "./geometry";

// Pan/zoom of the whole spread, in stage pixels: translate(x, y) scale(zoom)
// with origin at the stage's top-left.
export interface Camera extends Vec {
  zoom: number;
}

export const MAX_ZOOM = 4;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clampZoom = (z: number) => clamp(z, 1, MAX_ZOOM);

// Keeps the zoomed content covering the stage: no zooming out past 1, no
// panning the spread off-screen.
export function clampCamera(c: Camera, width: number, height: number): Camera {
  const zoom = clampZoom(c.zoom);
  return {
    zoom,
    x: clamp(c.x, width * (1 - zoom), 0),
    y: clamp(c.y, height * (1 - zoom), 0),
  };
}

// Zoom to `zoom`, keeping the content under `from` (stage px, at the start
// camera) under `to`. With from === to this is zoom-about-a-point.
export function zoomFromTo(c: Camera, from: Vec, to: Vec, zoom: number): Camera {
  const z = clampZoom(zoom);
  const content = { x: (from.x - c.x) / c.zoom, y: (from.y - c.y) / c.zoom };
  return { zoom: z, x: to.x - content.x * z, y: to.y - content.y * z };
}
