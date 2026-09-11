"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { PhotoElement, TextElement } from "@/lib/diary/types";
import { FONTS, INK } from "@/lib/diary/presets";
import { Alignment, Chip, Label, Stepper, Swatches, Typefaces } from "./controls";
import p from "./Panel.module.css";
import s from "./TextEditor.module.css";

const MAX_TEXT = 1000;
const MAX_CAPTION = 40;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Full-screen editing: the canvas is covered, so the on-screen keyboard can
// never hide the element being edited. Never inline on the page.
function Shell({
  title,
  onDone,
  onCancel,
  children,
}: {
  title: string;
  onDone: () => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={s.root}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onDone();
        }
      }}
    >
      <div className={s.column}>
        <div className={s.bar}>
          <button type="button" className={s.cancel} onClick={onCancel} aria-label="Cancel">
            ×
          </button>
          <span className={s.heading}>{title}</span>
          <button type="button" className={s.done} onClick={onDone}>
            Done
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Focus on open, caret at the end. A layout effect runs inside the tap's
// event task, which iOS requires before it will raise the keyboard.
function useFocusAtEnd<T extends HTMLInputElement | HTMLTextAreaElement>() {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  return ref;
}

type TextDraft = Pick<
  TextElement,
  "content" | "style" | "fontFamily" | "fontSize" | "color" | "align"
> & { title: string };

export function TextEditor({
  element,
  onDone,
  onCancel,
}: {
  element: TextElement;
  onDone: (patch: Partial<TextElement>) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState<TextDraft>(() => ({
    content: element.content,
    title: element.title ?? "",
    style: element.style,
    fontFamily: element.fontFamily,
    fontSize: element.fontSize,
    color: element.color,
    align: element.align,
  }));
  const set = (patch: Partial<TextDraft>) => setD((v) => ({ ...v, ...patch }));
  const textRef = useFocusAtEnd<HTMLTextAreaElement>();

  const face = FONTS[d.fontFamily];
  const ink = INK[d.color];
  // Shown at a comfortable reading size that still tracks the chosen size.
  const textStyle: CSSProperties = {
    fontFamily: face.family,
    fontStyle: face.style,
    fontSize: clamp(d.fontSize * 0.62, 17, 36),
    lineHeight: face.lineHeight,
    letterSpacing: face.letterSpacing,
    color: ink,
    textAlign: d.align,
  };
  const ruleMargins: CSSProperties = {
    marginLeft: d.align === "left" ? 0 : "auto",
    marginRight: d.align === "right" ? 0 : "auto",
  };

  return (
    <Shell title="Edit text" onDone={() => onDone(d)} onCancel={onCancel}>
      <div className={s.paper} data-style={d.style}>
        {d.style === "card" && (
          <>
            <input
              className={s.title}
              value={d.title}
              placeholder="Title"
              maxLength={80}
              aria-label="Card title"
              onChange={(e) => set({ title: e.target.value })}
              style={{ color: ink, textAlign: d.align }}
            />
            <div className={s.rule} style={ruleMargins} />
          </>
        )}
        <textarea
          ref={textRef}
          className={s.textarea}
          value={d.content}
          placeholder="Write something…"
          maxLength={MAX_TEXT}
          aria-label="Text"
          onChange={(e) => set({ content: e.target.value })}
          style={textStyle}
        />
        <div className={s.count}>
          {d.content.length} / {MAX_TEXT}
        </div>
      </div>

      <div className={s.controls}>
        <Label>Typeface</Label>
        <Typefaces value={d.fontFamily} onChange={(fontFamily) => set({ fontFamily })} />
        <Swatches value={d.color} onChange={(color) => set({ color })} />
        <div className={p.row}>
          <Stepper
            value={`${Math.round(d.fontSize)} pt`}
            onStep={(dir) => setD((v) => ({ ...v, fontSize: clamp(Math.round(v.fontSize) + dir, 12, 160) }))}
          />
          <Alignment value={d.align} onChange={(align) => set({ align })} />
        </div>
        <Label>Style</Label>
        <div className={p.row}>
          <Chip pressed={d.style === "plain"} onClick={() => set({ style: "plain" })}>
            Plain on page
          </Chip>
          <Chip pressed={d.style === "card"} onClick={() => set({ style: "card" })}>
            Note card
          </Chip>
        </div>
      </div>
    </Shell>
  );
}

export function CaptionEditor({
  element,
  onDone,
  onCancel,
}: {
  element: PhotoElement;
  onDone: (patch: Partial<PhotoElement>) => void;
  onCancel: () => void;
}) {
  const [caption, setCaption] = useState(element.caption ?? "");
  const inputRef = useFocusAtEnd<HTMLInputElement>();
  const done = () => onDone({ caption: caption.trim() || undefined });

  return (
    <Shell title="Edit caption" onDone={done} onCancel={onCancel}>
      <div className={s.paper} data-kind="caption">
        <input
          ref={inputRef}
          className={s.caption}
          value={caption}
          placeholder="a few words under the photo"
          maxLength={MAX_CAPTION}
          aria-label="Caption"
          enterKeyHint="done"
          onChange={(e) => setCaption(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              done();
            }
          }}
          style={{ fontFamily: FONTS.caveat.family }}
        />
        <div className={s.count}>
          {caption.length} / {MAX_CAPTION}
        </div>
      </div>
    </Shell>
  );
}
