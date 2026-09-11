"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { displaySrc } from "@/lib/diary/media";
import {
  PAGE_H,
  PAGE_W,
  type Diary,
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
import { preload, resizeImage, uploadPhoto } from "@/lib/editor/upload";
import { errorMessage } from "@/lib/http";
import { AddPanel } from "./AddPanel";
import { Canvas, type Selection } from "./Canvas";
import { ControlsPanel } from "./ControlsPanel";
import { measureTextHeight } from "./measure";
import { PagesGrid } from "./PagesGrid";
import { CaptionEditor, TextEditor } from "./TextEditor";
import { persistable, useAutosave, type SaveState } from "./useAutosave";
import { useSinglePage } from "./useSinglePage";
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

const SAVE_LABEL: Record<SaveState, string> = {
  saved: "Saved",
  saving: "Saving…",
  retrying: "Not saved · retrying",
  "signed-out": "Signed out · reload to sign in",
};

// The diary editor: owns the pages, the selection and the panels. Canvas
// handles gestures; the panels handle precise edits; changes autosave.
export function Editor({ diary, initialPages }: { diary: Diary; initialPages: PageData[] }) {
  const [pages, setPages] = useState(initialPages);
  const [selection, setSelection] = useState<Selection>(null);
  const [lastPageId, setLastPageId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  // Full-screen text editor. isNew: discard the element on cancel.
  const [editing, setEditing] = useState<{ pageId: string; elementId: string; isNew: boolean } | null>(
    null,
  );
  const [uploads, setUploads] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [current, setCurrent] = useState(0); // index of the page in focus
  const [gridOpen, setGridOpen] = useState(false);
  const [pageBusy, setPageBusy] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  const saveState = useAutosave(pages);
  const single = useSinglePage();

  // ── Navigation ────────────────────────────────────────────────────────────
  // Desktop shows the spread holding the current page (0–1, 2–3, …); mobile
  // shows just the current page. ‹ › move by a spread or by a page.

  const count = pages.length;
  const at = Math.min(current, count - 1);
  const spreadStart = at - (at % 2);
  const visible = pages.slice(spreadStart, spreadStart + 2);
  const focus = (at % 2) as 0 | 1;
  const canPrev = single ? at > 0 : spreadStart > 0;
  const canNext = single ? at < count - 1 : spreadStart + 2 < count;
  const position =
    single || visible.length === 1 ? `${at + 1} / ${count}` : `${spreadStart + 1}–${spreadStart + 2} / ${count}`;

  const goTo = (index: number) => {
    const target = clamp(index, 0, count - 1);
    if (target === at) return;
    setSelection(null);
    setAddOpen(false);
    setCurrent(target);
  };
  const prev = () => goTo(single ? at - 1 : spreadStart - 2);
  const next = () => goTo(single ? at + 1 : spreadStart + 2);

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
  // touched, else the first visible; centred on whatever part is on screen.
  const targetPageId = () => {
    const candidates = [selection?.pageId, lastPageId];
    return candidates.find((id) => id && visible.some((p) => p.id === id)) ?? visible[0].id;
  };

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
    setSelection({ pageId, elementId: placed.id });
    setAddOpen(false);
    // New text goes straight to the full-screen editor.
    if (placed.type === "text") setEditing({ pageId, elementId: placed.id, isNew: true });
  };

  // ── Photos ────────────────────────────────────────────────────────────────
  // Resize in the browser, show the resized photo at once from an object URL,
  // upload it (signed, direct to Cloudinary), then swap in the real URL.
  // Autosave skips photos until they have it.

  const objectUrls = useRef(new Set<string>());
  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  // Applies to every photo using `from` — including a copy duplicated while
  // the upload was still running. `to: null` removes them.
  const replaceSrc = (from: string, to: string | null) =>
    setPages((ps) =>
      ps.map((p) =>
        p.elements.some((e) => e.type === "photo" && e.src === from)
          ? {
              ...p,
              elements: to
                ? p.elements.map((e) => (e.type === "photo" && e.src === from ? { ...e, src: to } : e))
                : p.elements.filter((e) => !(e.type === "photo" && e.src === from)),
            }
          : p,
      ),
    );

  const addPhoto = async (frame: PhotoFrame, file: File) => {
    let photo: Awaited<ReturnType<typeof resizeImage>>;
    try {
      photo = await resizeImage(file);
    } catch (error) {
      setNotice(`Couldn’t read that photo: ${errorMessage(error, "unknown error")}`);
      return;
    }
    const preview = URL.createObjectURL(photo.blob);
    objectUrls.current.add(preview);
    addElement(newPhoto(frame, preview, photo.width / photo.height));
    setUploads((n) => n + 1);
    try {
      const url = await uploadPhoto(photo.blob);
      await preload(displaySrc(url));
      replaceSrc(preview, url);
    } catch (error) {
      replaceSrc(preview, null);
      setNotice(`Photo not uploaded: ${errorMessage(error, "upload failed")}`);
    } finally {
      setUploads((n) => n - 1);
      // Safe once swapped: an <img> that has decoded keeps its pixels.
      URL.revokeObjectURL(preview);
      objectUrls.current.delete(preview);
    }
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

  const removeElement = (pageId: string, id: string) => {
    mapElements(pageId, (els) => els.filter((e) => e.id !== id));
    if (selection?.elementId === id) setSelection(null);
  };

  const remove = () => {
    if (selection) removeElement(selection.pageId, selection.elementId);
  };

  // ── Pages ─────────────────────────────────────────────────────────────────
  // Server first (it assigns the id and shifts indexes), then mirror locally.

  const renumber = (ps: PageData[]) => ps.map((p, i) => (p.index === i ? p : { ...p, index: i }));

  // `source`: duplicate it, sending its current elements so edits that
  // haven't autosaved yet are copied too. `open`: go to the new page.
  const addPage = async (position: number, { source, open }: { source?: PageData; open: boolean }) => {
    setPageBusy(true);
    try {
      const res = await fetch("/api/admin/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diaryId: diary.id,
          at: position,
          background: source?.background ?? "blush",
          elements: source ? persistable(source.elements) : [],
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { page?: PageData; error?: string };
      if (!res.ok || !body.page) throw new Error(body.error ?? `error ${res.status}`);
      const page = body.page;
      setPages((ps) => renumber([...ps.slice(0, page.index), page, ...ps.slice(page.index)]));
      if (open) {
        setSelection(null);
        setCurrent(page.index);
        setGridOpen(false);
      } else if (page.index <= at) {
        setCurrent((c) => c + 1); // keep the same page in view
      }
    } catch (error) {
      setNotice(`Couldn’t add the page: ${errorMessage(error, "unknown error")}`);
    } finally {
      setPageBusy(false);
    }
  };

  const deletePage = async (page: PageData) => {
    setPageBusy(true);
    try {
      const res = await fetch(`/api/admin/pages/${page.id}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `error ${res.status}`);
      setPages((ps) => renumber(ps.filter((p) => p.id !== page.id)));
      setCurrent((c) => Math.max(0, c > page.index ? c - 1 : Math.min(c, count - 2)));
      if (selection?.pageId === page.id) setSelection(null);
    } catch (error) {
      setNotice(`Couldn’t delete the page: ${errorMessage(error, "unknown error")}`);
    } finally {
      setPageBusy(false);
    }
  };

  // ── Full-screen text editor ───────────────────────────────────────────────

  // Tap on an already-selected text element (or polaroid, for its caption).
  const openEditor = (pageId: string, elementId: string) => {
    const el = find(pageId, elementId);
    if (el?.type === "text" || (el?.type === "photo" && el.frame === "polaroid")) {
      setEditing({ pageId, elementId, isNew: false });
    }
  };

  // No patch = cancel. Text left empty is removed rather than kept invisible.
  const closeEditor = (patch?: Partial<PageElement>) => {
    if (!editing) return;
    const { pageId, elementId, isNew } = editing;
    const el = find(pageId, elementId);
    setEditing(null);
    if (!el) return;
    if (!patch) {
      if (isNew) removeElement(pageId, elementId);
      return;
    }
    if (el.type === "text") {
      const next = { ...el, ...patch } as TextElement;
      if (!next.content.trim() && !(next.style === "card" && next.title?.trim())) {
        removeElement(pageId, elementId);
        return;
      }
    }
    change(pageId, elementId, patch);
  };

  const editingElement = editing ? find(editing.pageId, editing.elementId) : undefined;

  // ── Keyboard (desktop) ────────────────────────────────────────────────────

  const onKey = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    onKey.current = (e) => {
      if (editing) {
        if (e.key === "Escape") closeEditor();
        return;
      }
      if (gridOpen) {
        if (e.key === "Escape") setGridOpen(false);
        return;
      }
      if ((e.target as HTMLElement | null)?.closest?.("input, textarea, select")) return;
      if (e.key === "Escape") {
        setSelection(null);
        setAddOpen(false);
        return;
      }
      // Arrows nudge a selected element; with nothing selected they turn pages.
      if (e.key === "PageUp" || (!selection && e.key === "ArrowLeft")) {
        e.preventDefault();
        prev();
        return;
      }
      if (e.key === "PageDown" || (!selection && e.key === "ArrowRight")) {
        e.preventDefault();
        next();
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
  const status = uploads > 0 && saveState === "saved" ? "Uploading photo…" : SAVE_LABEL[saveState];

  return (
    <main className={styles.shell}>
      {/* Covered and inert while the text editor is open. */}
      <div className={styles.workspace} inert={!!editing || gridOpen}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <h1 className={styles.diaryTitle}>{diary.title}</h1>
            <span className={styles.meta}>{position}</span>
          </div>
          <div className={styles.headerSide}>
            <button type="button" className={styles.pagesButton} onClick={() => setGridOpen(true)}>
              Pages
            </button>
            <span className={styles.status} data-state={saveState} role="status">
              {status}
            </span>
            <Link href="/admin" className={styles.meta}>
              Admin
            </Link>
          </div>
        </header>

        {notice && (
          <div className={styles.notice} role="alert">
            <span>{notice}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}>
              ×
            </button>
          </div>
        )}

        <div className={styles.editor}>
          <div className={styles.canvasArea}>
            {/* Keyed by page: a page change remounts, which plays the fade
                and resets pan/zoom. */}
            <Canvas
              key={at}
              pages={visible}
              focus={focus}
              selection={selection}
              stageRef={stageRef}
              className={`${styles.canvas} ${styles.pageIn}`}
              onSelect={(s) => {
                setSelection(s);
                if (s) setAddOpen(false);
              }}
              onChange={change}
              onOpen={openEditor}
              onPageTouch={setLastPageId}
            />
            <button
              type="button"
              className={`${styles.turn} ${styles.turnPrev}`}
              disabled={!canPrev}
              aria-label="Previous pages"
              onClick={prev}
            >
              ‹
            </button>
            <button
              type="button"
              className={`${styles.turn} ${styles.turnNext}`}
              disabled={!canNext}
              aria-label="Next pages"
              onClick={next}
            >
              ›
            </button>
          </div>

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
              onEdit={() => openEditor(selection.pageId, selected.id)}
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
                  <button type="button" className={panel.barPill} onClick={() => setGridOpen(true)}>
                    Pages
                  </button>
                  <div className={panel.barCenter}>
                    <button
                      type="button"
                      className={panel.barTurn}
                      disabled={!canPrev}
                      aria-label="Previous page"
                      onClick={prev}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className={panel.fab}
                      aria-label="Add to the page"
                      onClick={() => setAddOpen(true)}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className={panel.barTurn}
                      disabled={!canNext}
                      aria-label="Next page"
                      onClick={next}
                    >
                      ›
                    </button>
                  </div>
                  <span className={panel.barNumber}>{position}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {gridOpen && (
        <PagesGrid
          pages={pages}
          current={at}
          busy={pageBusy}
          onOpen={(i) => {
            goTo(i);
            setGridOpen(false);
          }}
          onAdd={() => addPage(count, { open: true })}
          onDuplicate={(page) => addPage(page.index + 1, { source: page, open: false })}
          onDelete={deletePage}
          onClose={() => setGridOpen(false)}
        />
      )}

      {editingElement?.type === "text" && (
        <TextEditor element={editingElement} onDone={closeEditor} onCancel={() => closeEditor()} />
      )}
      {editingElement?.type === "photo" && (
        <CaptionEditor element={editingElement} onDone={closeEditor} onCancel={() => closeEditor()} />
      )}
    </main>
  );
}
