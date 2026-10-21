"use client";

import { useId, type CSSProperties } from "react";
import type { Palette, RGB } from "./palette";
import { css } from "./palette";
import s from "./Gate.module.css";

// The passphrase as moss: Caveat letters with a mossy fill (an SVG noise
// filter, mapped to the palette's greens) and tiny flowers along the glyph
// edges (dotted strokes — zero-length dashes with round caps, so the dots
// follow the outlines for free). Each letter is its own <text> so it can grow
// in, wither and fall on its own.

export type WriteState = "idle" | "checking" | "wither" | "fall" | "bloom";

export interface Line {
  chars: string[];
  xs: number[]; // left edge of each letter
  widths: number[];
  fontSize: number;
  width: number;
}

// Noise (≈0.3–0.7 from fractalNoise) → a colour between dark and light.
function noiseToColour(dark: RGB, light: RGB): string {
  const rows = [0, 1, 2].map((i) => {
    const d = dark[i] / 255;
    const a = (light[i] / 255 - d) / 0.4;
    return `${a.toFixed(4)} 0 0 0 ${(d - 0.3 * a).toFixed(4)}`;
  });
  return `${rows.join(" ")} 0 0 0 0 1`;
}

// Same order as the letters, so each letter's three layers share a delay.
const seeded = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export function Writing({
  line,
  x0,
  baseline,
  family,
  state,
  palette,
  caret,
  width,
  height,
}: {
  line: Line;
  x0: number; // where the line starts
  baseline: number;
  family: string;
  state: WriteState;
  palette: Palette;
  caret: boolean;
  width: number;
  height: number;
}) {
  const id = useId().replace(/:/g, "");
  const fs = line.fontSize;
  const speck = fs * 0.06;
  // Irregular gaps, so the flowers look scattered rather than stitched.
  const dashes = [0.23, 0.41, 0.17, 0.33, 0.27].map((g) => `0 ${(g * fs).toFixed(1)}`).join(" ");
  const sparse = [0.52, 0.31, 0.67, 0.44].map((g) => `0 ${(g * fs).toFixed(1)}`).join(" ");

  const letters = (layer: string, props: Record<string, unknown> = {}) =>
    line.chars.map((ch, i) => (
      <text
        key={i}
        className={s.ch}
        x={x0 + line.xs[i] + line.widths[i] / 2}
        y={baseline}
        textAnchor="middle"
        style={
          {
            "--i": i,
            "--droop": `${(seeded(i, 1) - 0.5) * 24}deg`,
            "--spin": `${(seeded(i, 2) - 0.5) * 140}deg`,
            "--drift": `${(seeded(i, 3) - 0.5) * 40}px`,
          } as CSSProperties
        }
        data-layer={layer}
        {...props}
      >
        {ch}
      </text>
    ));

  const caretX = x0 + line.width + fs * 0.08;

  return (
    <svg
      className={s.writing}
      data-state={state}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{ fontFamily: family, fontSize: fs }}
    >
      <defs>
        <filter id={`${id}-moss`} x="-10%" y="-40%" width="120%" height="180%" colorInterpolationFilters="sRGB">
          {/* Fuzzy edges: the letter shapes nudged by fine noise. */}
          <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="1" seed="3" result="jitter" />
          {/* Caveat's strokes are thin: thicken them a little so the moss has body. */}
          <feMorphology in="SourceGraphic" operator="dilate" radius={fs * 0.018} result="thick" />
          <feDisplacementMap in="thick" in2="jitter" scale={fs * 0.05} result="shape" />
          {/* Moss: coarse and fine noise mapped to the palette's greens. */}
          <feTurbulence type="fractalNoise" baseFrequency="0.32" numOctaves="2" seed="8" result="noise" />
          <feColorMatrix in="noise" type="matrix" values={noiseToColour(palette.mossDark, palette.mossLight)} />
          <feComposite in2="shape" operator="in" />
        </filter>
        <filter id={`${id}-dry`} x="-10%" y="-40%" width="120%" height="180%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="1" seed="3" result="jitter" />
          <feMorphology in="SourceGraphic" operator="dilate" radius={fs * 0.018} result="thick" />
          <feDisplacementMap in="thick" in2="jitter" scale={fs * 0.06} result="shape" />
          <feTurbulence type="fractalNoise" baseFrequency="0.32" numOctaves="2" seed="8" result="noise" />
          <feColorMatrix in="noise" type="matrix" values={noiseToColour(...palette.withered)} />
          <feComposite in2="shape" operator="in" />
        </filter>
      </defs>

      <g className={s.moss} filter={`url(#${id}-moss)`}>
        {letters("moss")}
      </g>
      <g className={s.dry} filter={`url(#${id}-dry)`}>
        {letters("dry")}
      </g>
      <g
        className={s.specks}
        fill="none"
        strokeLinecap="round"
        style={{ "--sw": `${speck}px` } as CSSProperties}
      >
        <g className={s.speckA}>
          {letters("speck", { stroke: css(palette.speck, 0.85), strokeDasharray: dashes })}
          {letters("centre", {
            stroke: css(palette.speckCentre),
            strokeDasharray: dashes,
            "data-centre": "",
          })}
        </g>
        <g className={s.speckB}>
          {letters("blush", {
            stroke: css(palette.petalB),
            strokeDasharray: sparse,
            strokeDashoffset: fs * 0.11,
          })}
        </g>
      </g>

      {caret && (
        <rect
          className={s.caret}
          x={caretX}
          y={baseline - fs * 0.62}
          width={Math.max(1.5, fs * 0.025)}
          height={fs * 0.72}
          rx={1}
          fill={css(palette.hint)}
        />
      )}
    </svg>
  );
}
