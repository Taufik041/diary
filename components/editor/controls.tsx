"use client";

import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { FontFamily, InkColor, PhotoFrame, TapeVariant, TextAlign } from "@/lib/diary/types";
import { FONTS, INK, TAPE } from "@/lib/diary/presets";
import p from "./Panel.module.css";

// Small building blocks shared by the controls panel, the add panel and the
// full-screen text editor. Every target is at least 44px.

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

export function Chip({ pressed, className, ...props }: ButtonProps & { pressed?: boolean }) {
  return <button type="button" aria-pressed={pressed} className={cx(p.chip, className)} {...props} />;
}

export function Label({ children }: { children: ReactNode }) {
  return <div className={p.label}>{children}</div>;
}

// Steps once on press, then repeats while held.
export function RepeatButton({
  onStep,
  ...props
}: Omit<ButtonProps, "onClick" | "onPointerDown"> & { onStep: () => void }) {
  const step = useRef(onStep);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    step.current = onStep;
  });
  const stop = () => {
    window.clearTimeout(timer.current);
    window.clearInterval(timer.current);
  };
  useEffect(() => stop, []);

  return (
    <button
      type="button"
      {...props}
      onPointerDown={(e) => {
        e.preventDefault();
        step.current();
        timer.current = window.setTimeout(() => {
          timer.current = window.setInterval(() => step.current(), 60);
        }, 400);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          step.current();
        }
      }}
    />
  );
}

export function Stepper({ value, onStep }: { value: ReactNode; onStep: (dir: 1 | -1) => void }) {
  return (
    <div className={p.stepper}>
      <RepeatButton className={p.stepBtn} onStep={() => onStep(-1)} aria-label="Smaller">
        −
      </RepeatButton>
      <span className={p.stepValue}>{value}</span>
      <RepeatButton className={p.stepBtn} onStep={() => onStep(1)} aria-label="Larger">
        +
      </RepeatButton>
    </div>
  );
}

const INKS: { id: InkColor; label: string }[] = [
  { id: "ink", label: "Brown ink" },
  { id: "ink-soft", label: "Soft brown" },
  { id: "ink-faint", label: "Faint brown" },
  { id: "sage", label: "Sage" },
  { id: "rose", label: "Rose" },
  { id: "greige", label: "Greige" },
];

export function Swatches({ value, onChange }: { value: InkColor; onChange: (c: InkColor) => void }) {
  return (
    <div className={p.swatches} role="group" aria-label="Colour">
      {INKS.map((c) => (
        <button
          key={c.id}
          type="button"
          className={p.swatch}
          aria-pressed={value === c.id}
          aria-label={c.label}
          style={{ "--c": INK[c.id] } as CSSProperties}
          onClick={() => onChange(c.id)}
        />
      ))}
    </div>
  );
}

const FACES: { id: FontFamily; label: string; style: CSSProperties }[] = [
  { id: "caveat", label: "Caveat", style: { fontFamily: FONTS.caveat.family, fontStyle: "normal", fontSize: 24 } },
  { id: "cormorant", label: "Cormorant", style: { fontFamily: FONTS.cormorant.family, fontSize: 20 } },
  { id: "mono", label: "Mono", style: { fontFamily: FONTS.mono.family, fontStyle: "normal", fontSize: 13 } },
];

export function Typefaces({ value, onChange }: { value: FontFamily; onChange: (f: FontFamily) => void }) {
  return (
    <div className={p.row} role="group" aria-label="Typeface">
      {FACES.map((f) => (
        <Chip key={f.id} pressed={value === f.id} style={f.style} onClick={() => onChange(f.id)}>
          {f.label}
        </Chip>
      ))}
    </div>
  );
}

const ALIGNS: TextAlign[] = ["left", "center", "right"];

export function Alignment({ value, onChange }: { value: TextAlign; onChange: (a: TextAlign) => void }) {
  return (
    <div className={cx(p.row, p.grow)} role="group" aria-label="Alignment">
      {ALIGNS.map((a) => (
        <Chip
          key={a}
          pressed={value === a}
          className={p.alignChip}
          data-align={a}
          aria-label={`Align ${a}`}
          onClick={() => onChange(a)}
        >
          <i />
          <i />
          <i />
        </Chip>
      ))}
    </div>
  );
}

export const FRAME_OPTIONS: { id: PhotoFrame; label: string }[] = [
  { id: "polaroid", label: "Polaroid" },
  { id: "thin", label: "Thin" },
  { id: "rounded", label: "Rounded" },
];

export function Frames({ value, onChange }: { value: PhotoFrame; onChange: (f: PhotoFrame) => void }) {
  return (
    <div className={p.row} role="group" aria-label="Frame">
      {FRAME_OPTIONS.map((f) => (
        <Chip key={f.id} pressed={value === f.id} onClick={() => onChange(f.id)}>
          {f.label}
        </Chip>
      ))}
    </div>
  );
}

const TAPE_LABELS: Record<TapeVariant, string> = {
  "sage-stripe": "Sage stripe",
  "rose-gingham": "Rose gingham",
  "greige-stripe": "Greige stripe",
  "rose-pinstripe": "Rose pinstripe",
  "sage-gingham": "Sage gingham",
  kraft: "Kraft",
};

export function TapeSwatches({ value, onPick }: { value?: TapeVariant; onPick: (v: TapeVariant) => void }) {
  return (
    <div className={p.tapeGrid} role="group" aria-label="Tape">
      {(Object.keys(TAPE) as TapeVariant[]).map((v) => (
        <button
          key={v}
          type="button"
          className={p.tapeChip}
          aria-pressed={value === undefined ? undefined : value === v}
          aria-label={TAPE_LABELS[v]}
          onClick={() => onPick(v)}
        >
          <span style={{ background: TAPE[v] }} />
        </button>
      ))}
    </div>
  );
}
