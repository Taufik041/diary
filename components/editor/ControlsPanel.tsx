"use client";

import type { PageElement } from "@/lib/diary/types";
import {
  Alignment,
  Chip,
  Frames,
  HistoryButtons,
  RepeatButton,
  type HistoryControls,
  Stepper,
  Swatches,
  TapeSwatches,
  Typefaces,
} from "./controls";
import p from "./Panel.module.css";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const ROTATION_RANGE = 45; // slider range; the handle and pinch go further

function nameOf(el: PageElement) {
  switch (el.type) {
    case "photo":
      return el.frame === "polaroid" ? "Polaroid" : "Photo";
    case "text":
      return el.style === "card" ? "Note card" : "Handwriting";
    case "tape":
      return "Washi tape";
    case "clip":
      return "Paperclip";
  }
}

const NUDGES = [
  { glyph: "←", label: "left", d: [-1, 0] },
  { glyph: "↑", label: "up", d: [0, -1] },
  { glyph: "↓", label: "down", d: [0, 1] },
  { glyph: "→", label: "right", d: [1, 0] },
] as const;

interface ControlsPanelProps {
  element: PageElement;
  canForward: boolean;
  canBack: boolean;
  onChange: (patch: Partial<PageElement>) => void;
  onScale: (k: number) => void;
  onNudge: (dx: number, dy: number) => void;
  onLayer: (dir: 1 | -1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
  // Opens the full-screen editor (text, or a polaroid's caption).
  onEdit: () => void;
  history: HistoryControls;
}

// Precise, per-element controls: bottom sheet on mobile, side panel on
// desktop (see Panel.module.css).
export function ControlsPanel({
  element: el,
  canForward,
  canBack,
  onChange,
  onScale,
  onNudge,
  onLayer,
  onDuplicate,
  onDelete,
  onClose,
  onEdit,
  history,
}: ControlsPanelProps) {
  const boxSize = (
    <Stepper
      value={`${Math.round(el.w)} × ${Math.round(el.h)}`}
      onStep={(d) => onScale(d > 0 ? 1.04 : 1 / 1.04)}
    />
  );
  const rotation = Math.round(el.rotation * 10) / 10;

  return (
    <aside className={p.panel} aria-label="Element controls">
      <div className={p.grabber} />
      <div className={p.header}>
        <span className={p.title}>
          {nameOf(el)} <span className={p.kind}>· {el.type.toUpperCase()}</span>
        </span>
        <div className={p.headerActions}>
          <HistoryButtons {...history} />
          <button type="button" className={p.close} onClick={onClose} aria-label="Deselect">
            ×
          </button>
        </div>
      </div>

      {el.type === "text" && (
        <>
          <Chip onClick={onEdit}>Edit text…</Chip>
          <Typefaces value={el.fontFamily} onChange={(fontFamily) => onChange({ fontFamily })} />
          <Swatches value={el.color} onChange={(color) => onChange({ color })} />
          <div className={p.row}>
            <Stepper
              value={`${Math.round(el.fontSize)} pt`}
              onStep={(d) => onChange({ fontSize: clamp(Math.round(el.fontSize) + d, 12, 160) })}
            />
            <Alignment value={el.align} onChange={(align) => onChange({ align })} />
          </div>
        </>
      )}

      {el.type === "photo" && (
        <>
          <Frames value={el.frame} onChange={(frame) => onChange({ frame })} />
          {el.frame === "polaroid" && (
            <Chip onClick={onEdit}>{el.caption ? "Edit caption…" : "Add a caption…"}</Chip>
          )}
          {boxSize}
        </>
      )}

      {el.type === "tape" && (
        <>
          <TapeSwatches value={el.variant} onPick={(variant) => onChange({ variant })} />
          {boxSize}
        </>
      )}

      {el.type === "clip" && boxSize}

      <div className={p.rotation}>
        <div className={p.rotationHead}>
          <span>Rotation</span>
          <span className={p.mono}>
            {rotation > 0 ? "+" : ""}
            {rotation.toFixed(1)}°
          </span>
        </div>
        <input
          type="range"
          className={p.slider}
          min={-ROTATION_RANGE}
          max={ROTATION_RANGE}
          step={0.5}
          value={clamp(el.rotation, -ROTATION_RANGE, ROTATION_RANGE)}
          onChange={(e) => onChange({ rotation: Number(e.target.value) })}
          aria-label="Rotation"
        />
      </div>

      <div className={p.row}>
        <span className={p.nudgeLabel}>Nudge</span>
        {NUDGES.map((n) => (
          <RepeatButton
            key={n.label}
            className={p.nudgeBtn}
            aria-label={`Nudge ${n.label}`}
            onStep={() => onNudge(n.d[0], n.d[1])}
          >
            {n.glyph}
          </RepeatButton>
        ))}
      </div>

      <div className={p.row}>
        <Chip disabled={!canForward} onClick={() => onLayer(1)}>
          ↑ Forward
        </Chip>
        <Chip disabled={!canBack} onClick={() => onLayer(-1)}>
          ↓ Back
        </Chip>
        <Chip onClick={onDuplicate}>Duplicate</Chip>
        <Chip className={p.danger} onClick={onDelete} aria-label="Delete">
          ×
        </Chip>
      </div>
    </aside>
  );
}
