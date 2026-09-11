import type { FontFamily, InkColor, PhotoFrame, TapeVariant } from "./types";

// Default body size for new text. Renders ~17–19px on a 390px phone.
export const DEFAULT_BODY_FONT_SIZE = 39;

// Card title size = fontSize × this (mockup: 27px title over 29px body).
export const CARD_TITLE_RATIO = 0.93;

export const INK: Record<InkColor, string> = {
  ink: "var(--ink)",
  "ink-soft": "var(--ink-soft)",
  "ink-faint": "var(--ink-faint)",
  sage: "var(--ink-sage)",
  rose: "var(--rose-deep)",
  greige: "var(--cover)",
};

interface Face {
  family: string;
  style: "normal" | "italic";
  lineHeight: number;
  letterSpacing: string;
}

// Line height and tracking belong to the face, not the element.
export const FONTS: Record<FontFamily, Face> = {
  caveat: {
    family: "var(--font-caveat), cursive",
    style: "normal",
    lineHeight: 1.9,
    letterSpacing: ".02em",
  },
  cormorant: {
    family: "var(--font-cormorant), Georgia, serif",
    style: "italic",
    lineHeight: 1.3,
    letterSpacing: ".01em",
  },
  mono: {
    family: "var(--font-plex-mono), monospace",
    style: "normal",
    lineHeight: 1.7,
    letterSpacing: ".04em",
  },
};

export const TAPE: Record<TapeVariant, string> = {
  "sage-stripe":
    "repeating-linear-gradient(45deg, rgba(148,169,142,.62) 0 9px, rgba(148,169,142,.30) 9px 18px)",
  "rose-gingham":
    "repeating-linear-gradient(0deg, rgba(199,168,168,.42) 0 10px, transparent 10px 20px), " +
    "repeating-linear-gradient(90deg, rgba(199,168,168,.42) 0 10px, transparent 10px 20px), " +
    "rgba(253,247,244,.55)",
  "greige-stripe":
    "repeating-linear-gradient(45deg, rgba(169,156,144,.52) 0 12px, rgba(169,156,144,.26) 12px 24px)",
  "rose-pinstripe":
    "repeating-linear-gradient(90deg, rgba(185,138,138,.46) 0 3px, rgba(247,231,231,.58) 3px 11px)",
  "sage-gingham":
    "repeating-linear-gradient(0deg, rgba(148,169,142,.34) 0 8px, transparent 8px 16px), " +
    "repeating-linear-gradient(90deg, rgba(148,169,142,.34) 0 8px, transparent 8px 16px), " +
    "rgba(233,239,230,.55)",
  kraft: "rgba(223,210,194,.8)",
};

export const TAPE_FALLBACK: TapeVariant = "sage-stripe";

// Shown under a loading photo and in place of one that failed to load.
export const PHOTO_FALLBACK_BG =
  "repeating-linear-gradient(45deg, #E4D7CD 0 10px, #D8CBC0 10px 20px)";

interface FrameInsets {
  top: number;
  side: number;
  bottom: number;
  radius: number;
}

// Frame borders are proportional to the element, so a resized polaroid keeps
// its proportions. Ratios measured from the mockup at two sizes.
export function frameInsets(frame: PhotoFrame, w: number, h: number): FrameInsets {
  switch (frame) {
    case "polaroid": {
      const side = w * 0.047;
      return { top: side, side, bottom: w * 0.175, radius: 0 };
    }
    case "rounded":
      return { top: 0, side: 0, bottom: 0, radius: Math.min(w, h) * 0.058 };
    case "thin":
    default: {
      const side = w * 0.032;
      return { top: side, side, bottom: side, radius: 0 };
    }
  }
}
