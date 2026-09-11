import type {
  ClipElement,
  PageElement,
  PhotoElement,
  PhotoFrame,
  TapeElement,
  TapeVariant,
  TextElement,
  TextStyle,
} from "@/lib/diary/types";
import { DEFAULT_BODY_FONT_SIZE, frameInsets } from "@/lib/diary/presets";
import { r1 } from "./geometry";

// crypto.randomUUID only exists in secure contexts; a phone testing over the
// LAN on plain http doesn't get it.
export const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

// Nothing on the page is perfectly straight: new elements land at −3°…+3°.
export const randomTilt = () => Math.round((Math.random() * 6 - 3) * 10) / 10;

export const topZ = (els: PageElement[]) => els.reduce((m, e) => Math.max(m, e.z), 0) + 1;

// Position and z are filled in by the editor when the element is placed.
const base = () => ({ id: newId(), x: 0, y: 0, z: 0, rotation: randomTilt() });

export function newText(style: TextStyle): TextElement {
  const common = {
    ...base(),
    type: "text" as const,
    style,
    fontFamily: "caveat" as const,
    color: "ink" as const,
    align: "left" as const,
  };
  // Starts empty: the editor opens the full-screen text editor straight away,
  // and discards the element if it's still empty when that closes.
  return style === "card"
    ? { ...common, w: 380, h: 200, fontSize: 32, title: "", content: "" }
    : { ...common, w: 460, h: 80, fontSize: DEFAULT_BODY_FONT_SIZE, content: "" };
}

// Sized from the photo's own aspect ratio so the frame doesn't crop it.
export function newPhoto(frame: PhotoFrame, src: string, aspect: number): PhotoElement {
  const w = aspect >= 1 ? 320 : 260;
  const inset = frameInsets(frame, w, w);
  const imageW = w - 2 * inset.side;
  const h = frame === "rounded" ? w / aspect : imageW / aspect + inset.top + inset.bottom;
  return { ...base(), type: "photo", w, h: r1(h), src, frame };
}

export const newTape = (variant: TapeVariant): TapeElement => ({
  ...base(),
  type: "tape",
  w: 150,
  h: 40,
  variant,
});

export const newClip = (): ClipElement => ({ ...base(), type: "clip", w: 28, h: 70 });

export const duplicateOf = (el: PageElement, z: number): PageElement => ({
  ...el,
  id: newId(),
  x: el.x + 24,
  y: el.y + 24,
  z,
});

// Paint order: by z, ties by array order.
const paintOrder = (els: PageElement[]) =>
  els
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.z - b.e.z || a.i - b.i)
    .map(({ e }) => e.id);

export function layerPosition(els: PageElement[], id: string) {
  const order = paintOrder(els);
  const i = order.indexOf(id);
  return { canForward: i >= 0 && i < order.length - 1, canBack: i > 0 };
}

// Swaps the element with its neighbour in paint order, then renumbers z as
// 1…n so ties can't hide the move. Untouched elements keep their identity.
export function reorder(els: PageElement[], id: string, dir: 1 | -1): PageElement[] {
  const order = paintOrder(els);
  const i = order.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return els;
  [order[i], order[j]] = [order[j], order[i]];
  const rank = new Map(order.map((eid, k) => [eid, k + 1]));
  return els.map((e) => (e.z === rank.get(e.id) ? e : { ...e, z: rank.get(e.id)! }));
}
