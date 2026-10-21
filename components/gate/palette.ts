// The gate's colours by time of day. Every colour is a mix of the existing
// tokens in globals.css (read at runtime, so there is one source of truth):
// four small shifts of one palette, not four palettes. Night moves furthest —
// a deeper ground, with lighter petals that catch a little light.

export type RGB = [number, number, number];
export type Phase = "dawn" | "day" | "dusk" | "night";

export interface Palette {
  ground: RGB;
  petalA: RGB; // rose petals
  petalB: RGB; // blush petals
  edge: RGB; // hairline round each petal
  glow: number; // 0–1: light caught by petals at night
  mossDark: RGB; // the moss fill runs between these two
  mossLight: RGB;
  speck: RGB; // flower specks on the letters, and their centres
  speckCentre: RGB;
  withered: [RGB, RGB]; // moss gone dry
  hint: RGB; // small labels and the caret
}

const TOKENS = [
  "ground",
  "page",
  "page-alt",
  "card",
  "cover",
  "cover-edge",
  "ink",
  "ink-soft",
  "ink-faint",
  "accent",
  "accent-soft",
  "accent-tint",
  "rose",
  "rose-deep",
] as const;
type Token = (typeof TOKENS)[number];

// Only used if a token can't be read (e.g. stylesheet not applied yet).
const FALLBACK: Record<Token, string> = {
  ground: "#efe6d9",
  page: "#f7e7e7",
  "page-alt": "#fbf6ee",
  card: "#f3eee3",
  cover: "#a99c90",
  "cover-edge": "#dfd2c2",
  ink: "#6b534a",
  "ink-soft": "#8c766b",
  "ink-faint": "#a2907f",
  accent: "#94a98e",
  "accent-soft": "#a9bca2",
  "accent-tint": "#e9efe6",
  rose: "#d9c4c4",
  "rose-deep": "#b98a8a",
};

const hex = (value: string): RGB | null => {
  const m = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export function readTokens(): Record<Token, RGB> {
  const style = getComputedStyle(document.documentElement);
  const out = {} as Record<Token, RGB>;
  for (const t of TOKENS) out[t] = hex(style.getPropertyValue(`--${t}`)) ?? hex(FALLBACK[t])!;
  return out;
}

/** a → b by t (0–1). */
export const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export const css = (c: RGB, alpha = 1) =>
  `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${alpha})`;

export function phaseAt(date: Date): Phase {
  const h = date.getHours();
  if (h >= 5 && h < 8) return "dawn";
  if (h >= 8 && h < 17) return "day";
  if (h >= 17 && h < 20) return "dusk";
  return "night";
}

export function paletteFor(phase: Phase, k: Record<Token, RGB>): Palette {
  const day: Palette = {
    ground: k.ground,
    petalA: k.rose,
    petalB: k.page,
    edge: k["rose-deep"],
    glow: 0,
    mossDark: mix(k.accent, k.ink, 0.45),
    mossLight: k["accent-soft"],
    speck: k["rose-deep"],
    speckCentre: k["page-alt"],
    withered: [mix(k["ink-faint"], k.ink, 0.3), k["cover-edge"]],
    hint: k["ink-faint"],
  };
  switch (phase) {
    case "day":
      return day;
    case "dawn": // a blush of pink in the ground
      return {
        ...day,
        ground: mix(k.ground, k.page, 0.45),
        petalA: mix(k.rose, k.page, 0.2),
      };
    case "dusk": // warmer, a shade lower
      return {
        ...day,
        ground: mix(mix(k.ground, k.rose, 0.35), k.cover, 0.12),
        petalA: mix(k.rose, k["rose-deep"], 0.25),
        petalB: mix(k.page, k.rose, 0.3),
        hint: k["ink-soft"],
      };
    case "night": // the cover's greige, deepened with ink; petals hold the light
      return {
        ground: mix(k.cover, k.ink, 0.55),
        petalA: mix(k.rose, k.page, 0.35),
        petalB: k["page-alt"],
        edge: k.rose,
        glow: 0.7,
        mossDark: mix(k.accent, k.ink, 0.2),
        mossLight: mix(k["accent-soft"], k["accent-tint"], 0.5),
        speck: mix(k.rose, k.page, 0.4),
        speckCentre: k["page-alt"],
        withered: [k["ink-soft"], k.cover],
        hint: mix(k["cover-edge"], k.cover, 0.25),
      };
  }
}

export function mixPalette(a: Palette, b: Palette, t: number): Palette {
  const m = (key: keyof Palette) => mix(a[key] as RGB, b[key] as RGB, t);
  return {
    ground: m("ground"),
    petalA: m("petalA"),
    petalB: m("petalB"),
    edge: m("edge"),
    glow: a.glow + (b.glow - a.glow) * t,
    mossDark: m("mossDark"),
    mossLight: m("mossLight"),
    speck: m("speck"),
    speckCentre: m("speckCentre"),
    withered: [mix(a.withered[0], b.withered[0], t), mix(a.withered[1], b.withered[1], t)],
    hint: m("hint"),
  };
}
