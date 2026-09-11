"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  PAGE_H,
  PAGE_W,
  type Page as PageData,
  type PageElement,
  type PhotoFrame,
  type TextElement,
} from "@/lib/diary/types";
import { duplicateOf, layerPosition, newPhoto, reorder, topZ } from "@/lib/editor/elements";
import {
  clientToPage,
  r1,
  readPageMatrix,
  roundBox,
  scaleAbout,
  withHeight,
} from "@/lib/editor/geometry";
import { AddPanel } from "./AddPanel";
import { Canvas, type Selection } from "./Canvas";
import { ControlsPanel } from "./ControlsPanel";
import { measureTextHeight } from "./measure";
import styles from "./Editor.module.css";
import panel from "./Panel.module.css";

// Text fields that change how tall the text lays out.
const TEXT_LAYOUT = new Set(["content", "title", "fontFamily", "fontSize", "style", "w", "rule"]);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const NUDGE_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

// In-memory editor over a spread: owns the pages, the selection and the
// panels. Canvas handles gestures; the panels handle precise edits.
export function Editor({
  initialPages,
  className,
}: {
  initialPages: readonly [PageData, PageData?];
  className?: string;
}) {
  const [pages, setPages] = useState(() => initialPages.filter((p): p is PageData => !!p));
  const [selection, setSelection] = useState<Selection>(null);
  const [lastPageId, setLastPageId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  // ── Page state ────────────────────────────────────────────────────────────

  const mapElements = (pageId: string, fn: (els: PageElement[]) => PageElement[]) =>
    setPages((ps) => ps.map((p) => (p.id === pageId ? { ...p, elements: fn(p.elements) } : p)));

  const patchElement = (pageId: string, id: string, patch: Partial<PageElement>) =>
    mapElements(pageId, (els) =>
      els.map((e) => (e.id === id ? ({ ...e, ...patch } as PageElement) : e)),
    );

  const find = (pageId: string, id: string) =>
    pages.find((p) => p.id === pageId)?.elements.find((e) => e.id === id);

  const frameOf = (pageId: string) =>
    stageRef.current?.querySelector<HTMLElement>(`[data-page-id="${CSS.escape(pageId)}"]`) ?? null;

  // Text height follows its content. Measure the laid-out text (layout px
  // are page units) and store it, holding the top edge in place.
  const refit = (pageId: string, el: TextElement) => {
    const frame = frameOf(pageId);
    const h = frame && measureTextHeight(frame, el.id);
    if (h && Math.abs(h - el.h) > 0.05) patchElement(pageId, el.id, roundBox(withHeight(el, h)));
  };

  // Every element edit goes through here. Text edits that affect layout
  // render synchronously so the new height can be measured straight away.
  const change = (pageId: string, id: string, patch: Partial<PageElement>) => {
    const el = find(pageId, id);
    if (el?.type !== "text" || !Object.keys(patch).some((k) => TEXT_LAYOUT.has(k))) {
      patchElement(pageId, id, patch);
      return;
    }
    flushSync(() => patchElement(pageId, id, patch));
    refit(pageId, { ...el, ...patch } as TextElement);
  };

  // ── Adding ────────────────────────────────────────────────────────────────

  // New elements go to the selected element's page, else the page last
  // touched, else the first; centred on whatever part of it is on screen.
  const targetPageId = () => selection?.pageId ?? lastPageId ?? pages[0].id;

  const placement = (pageId: string, w: number, h: number) => {
    let c = { x: PAGE_W / 2, y: PAGE_H / 2 };
    const frame = frameOf(pageId);
    const stage = stageRef.current;
    const m = frame && readPageMatrix(frame);
    if (frame && stage && m) {
      const a = frame.getBoundingClientRect();
      const s = stage.getBoundingClientRect();
      const l = Math.max(a.left, s.left);
      const r = Math.min(a.right, s.right);
      const t = Math.max(a.top, s.top);
      const b = Math.min(a.bottom, s.bottom);
      if (r > l && b > t) c = clientToPage(m, { x: (l + r) / 2, y: (t + b) / 2 });
    }
    const jitter = () => Math.random() * 40 - 20; // repeated adds don't stack exactly
    return {
      x: r1(clamp(c.x - w / 2 + jitter(), 0, PAGE_W - w)),
      y: r1(clamp(c.y - h / 2 + jitter(), 0, PAGE_H - h)),
    };
  };

  const addElement = (el: PageElement) => {
    const pageId = targetPageId();
    const page = pages.find((p) => p.id === pageId)!;
    const placed = { ...el, ...placement(pageId, el.w, el.h), z: topZ(page.elements) } as PageElement;
    flushSync(() => mapElements(pageId, (els) => [...els, placed]));
    if (placed.type === "text") refit(pageId, placed);
    setSelection({ pageId, elementId: placed.id });
    setAddOpen(false);
  };

  // Pass A: the photo stays a local object URL. Real upload is Pass B.
  const addPhoto = async (frame: PhotoFrame, file: File) => {
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.src = src;
    try {
      await img.decode();
    } catch {
      URL.revokeObjectURL(src);
      return;
    }
    addElement(newPhoto(frame, src, img.naturalWidth / img.naturalHeight));
  };

  // ── Selected-element actions ──────────────────────────────────────────────

  const selected = selection ? find(selection.pageId, selection.elementId) : undefined;

  const updateSelected = (fn: (el: PageElement) => Partial<PageElement>) => {
    if (!selection) return;
    mapElements(selection.pageId, (els) =>
      els.map((e) => (e.id === selection.elementId ? ({ ...e, ...fn(e) } as PageElement) : e)),
    );
  };

  const nudge = (dx: number, dy: number) => updateSelected((e) => ({ x: r1(e.x + dx), y: r1(e.y + dy) }));
  const scale = (k: number) => updateSelected((e) => roundBox(scaleAbout(e, k)));

  const layer = (dir: 1 | -1) => {
    if (selection) mapElements(selection.pageId, (els) => reorder(els, selection.elementId, dir));
  };

  const duplicate = () => {
    if (!selection || !selected) return;
    const page = pages.find((p) => p.id === selection.pageId)!;
    const copy = duplicateOf(selected, topZ(page.elements));
    mapElements(selection.pageId, (els) => [...els, copy]);
    setSelection({ pageId: selection.pageId, elementId: copy.id });
  };

  const remove = () => {
    if (!selection) return;
    mapElements(selection.pageId, (els) => els.filter((e) => e.id !== selection.elementId));
    setSelection(null);
  };

  // ── Keyboard (desktop) ────────────────────────────────────────────────────

  const onKey = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    onKey.current = (e) => {
      if ((e.target as HTMLElement | null)?.closest?.("input, textarea, select")) return;
      if (e.key === "Escape") {
        setSelection(null);
        setAddOpen(false);
        return;
      }
      if (!selection) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        remove();
        return;
      }
      const d = NUDGE_KEYS[e.key];
      if (d) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        nudge(d[0] * step, d[1] * step);
      }
    };
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey.current(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  const selectedPage = selection ? pages.find((p) => p.id === selection.pageId) : undefined;
  const layers = selected && selectedPage ? layerPosition(selectedPage.elements, selected.id) : null;

  return (
    <div className={className ? `${styles.editor} ${className}` : styles.editor}>
      <Canvas
        pages={pages}
        selection={selection}
        stageRef={stageRef}
        className={styles.canvas}
        onSelect={(s) => {
          setSelection(s);
          if (s) setAddOpen(false);
        }}
        onChange={change}
        onOpen={() => {}}
        onPageTouch={setLastPageId}
      />

      {selected && selection && layers ? (
        <ControlsPanel
          element={selected}
          canForward={layers.canForward}
          canBack={layers.canBack}
          onChange={(patch) => change(selection.pageId, selected.id, patch)}
          onScale={scale}
          onNudge={nudge}
          onLayer={layer}
          onDuplicate={duplicate}
          onDelete={remove}
          onClose={() => setSelection(null)}
        />
      ) : (
        <>
          {/* Desktop: always shown in the side panel. Mobile: behind the + button. */}
          <aside
            className={addOpen ? panel.panel : `${panel.panel} ${panel.desktopOnly}`}
            aria-label="Add to the page"
          >
            <AddPanel onAdd={addElement} onAddPhoto={addPhoto} onClose={() => setAddOpen(false)} />
          </aside>
          {!addOpen && (
            <div className={panel.bar}>
              <button
                type="button"
                className={panel.fab}
                aria-label="Add to the page"
                onClick={() => setAddOpen(true)}
              >
                +
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
