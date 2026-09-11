// The page is a fixed 800 × 1100 coordinate space. Every element is positioned
// in those units; the renderer scales the whole page with one transform.
export const PAGE_W = 800;
export const PAGE_H = 1100;

export type PageBackground = "blush" | "cream"; // --page, --page-alt

export interface Diary {
  id: string;
  title: string;
  created_at: string; // ISO
}

// Mirrors the Postgres row (snake_case) so there is no mapping layer.
export interface Page {
  id: string;
  diary_id: string;
  index: number; // 0-based; the printed page number is index + 1
  background: PageBackground;
  elements: PageElement[];
}

interface ElementBase {
  id: string;
  x: number; // top-left of the UNROTATED box, in page units
  y: number;
  w: number; // outer box, frame/padding included (border-box)
  h: number;
  rotation: number; // degrees, clockwise, about the box centre
  z: number; // higher paints later; ties broken by array order
}

export type PhotoFrame = "polaroid" | "thin" | "rounded";

export interface PhotoElement extends ElementBase {
  type: "photo";
  src: string;
  frame: PhotoFrame;
  caption?: string; // rendered only when frame === 'polaroid'
}

export type TextStyle = "plain" | "card";
export type FontFamily = "caveat" | "cormorant" | "mono";
export type TextAlign = "left" | "center" | "right";
export type InkColor = "ink" | "ink-soft" | "ink-faint" | "sage" | "rose" | "greige";

export interface TextElement extends ElementBase {
  type: "text";
  content: string; // plain text, '\n' = line break, no markup
  style: TextStyle;
  fontFamily: FontFamily;
  fontSize: number; // page px
  color: InkColor;
  align: TextAlign;
  // style 'card' only: Cormorant italic heading above the body, at a fixed
  // ratio of fontSize, always followed by a sage rule.
  title?: string;
  // style 'plain' only: sage hairline under the block (standalone headings).
  rule?: boolean;
}

export type TapeVariant =
  | "sage-stripe"
  | "rose-gingham"
  | "greige-stripe"
  | "rose-pinstripe"
  | "sage-gingham"
  | "kraft";

export interface TapeElement extends ElementBase {
  type: "tape";
  variant: TapeVariant;
}

// Clips live fully inside the page like every other element; the page frame
// clips overflow, so nothing is ever drawn past the paper edge.
export interface ClipElement extends ElementBase {
  type: "clip";
}

export type PageElement = PhotoElement | TextElement | TapeElement | ClipElement;
