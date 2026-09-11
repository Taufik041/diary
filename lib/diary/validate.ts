import type {
  FontFamily,
  InkColor,
  PageBackground,
  PageElement,
  PhotoFrame,
  TapeVariant,
  TextAlign,
  TextStyle,
} from "./types";

// Shape checks for the elements jsonb. Writes are strict (any bad element
// rejects the whole save); reads are lenient (bad elements are dropped so one
// broken row can't take a page down).

const BACKGROUNDS: readonly PageBackground[] = ["blush", "cream"];
const FRAMES: readonly PhotoFrame[] = ["polaroid", "thin", "rounded"];
const STYLES: readonly TextStyle[] = ["plain", "card"];
const FONTS: readonly FontFamily[] = ["caveat", "cormorant", "mono"];
const INKS: readonly InkColor[] = ["ink", "ink-soft", "ink-faint", "sage", "rose", "greige"];
const ALIGNS: readonly TextAlign[] = ["left", "center", "right"];
const TAPES: readonly TapeVariant[] = [
  "sage-stripe",
  "rose-gingham",
  "greige-stripe",
  "rose-pinstripe",
  "sage-gingham",
  "kraft",
];

export const MAX_ELEMENTS = 500;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
const isStr = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
const oneOf = <T extends string>(v: unknown, list: readonly T[]): v is T =>
  typeof v === "string" && (list as readonly string[]).includes(v);
const optStr = (v: unknown, max: number): v is string | undefined => v === undefined || isStr(v, max);

export const isBackground = (v: unknown): v is PageBackground => oneOf(v, BACKGROUNDS);

/** Returns a clean copy with only known fields, or null if invalid. */
export function parseElement(v: unknown): PageElement | null {
  if (!isObject(v)) return null;
  const { id, x, y, w, h, rotation, z } = v;
  if (
    !isStr(id, 100) ||
    !id ||
    !isNum(x, -5000, 5000) ||
    !isNum(y, -5000, 5000) ||
    !isNum(w, 1, 5000) ||
    !isNum(h, 0, 5000) ||
    !isNum(rotation, -360, 360) ||
    !isNum(z, -1e6, 1e6)
  ) {
    return null;
  }
  const base = { id, x, y, w, h, rotation, z };

  switch (v.type) {
    case "photo": {
      const { src, frame, caption } = v;
      if (!isStr(src, 2000) || !oneOf(frame, FRAMES) || !optStr(caption, 200)) return null;
      return { ...base, type: "photo", src, frame, ...(caption ? { caption } : {}) };
    }
    case "text": {
      const { content, style, fontFamily, fontSize, color, align, title, rule } = v;
      if (
        !isStr(content, 5000) ||
        !oneOf(style, STYLES) ||
        !oneOf(fontFamily, FONTS) ||
        !isNum(fontSize, 4, 400) ||
        !oneOf(color, INKS) ||
        !oneOf(align, ALIGNS) ||
        !optStr(title, 200) ||
        (rule !== undefined && typeof rule !== "boolean")
      ) {
        return null;
      }
      return {
        ...base,
        type: "text",
        content,
        style,
        fontFamily,
        fontSize,
        color,
        align,
        ...(title ? { title } : {}),
        ...(rule ? { rule } : {}),
      };
    }
    case "tape":
      return oneOf(v.variant, TAPES) ? { ...base, type: "tape", variant: v.variant } : null;
    case "clip":
      return { ...base, type: "clip" };
    default:
      return null;
  }
}

/** Strict: for writes. Photos must already point at a remote https URL — a
 *  blob: preview would mean nothing after a reload. */
export function parseElements(input: unknown): PageElement[] | null {
  if (!Array.isArray(input) || input.length > MAX_ELEMENTS) return null;
  const out: PageElement[] = [];
  const ids = new Set<string>();
  for (const raw of input) {
    const el = parseElement(raw);
    if (!el || ids.has(el.id)) return null;
    if (el.type === "photo" && !el.src.startsWith("https://")) return null;
    ids.add(el.id);
    out.push(el);
  }
  return out;
}

/** Lenient: for reads. */
export function readElements(input: unknown): PageElement[] {
  if (!Array.isArray(input)) return [];
  return input.map(parseElement).filter((el): el is PageElement => el !== null);
}
