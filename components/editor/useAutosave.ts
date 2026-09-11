"use client";

import { useEffect, useState } from "react";
import type { Page, PageBackground, PageElement } from "@/lib/diary/types";

export type SaveState = "saved" | "saving" | "retrying" | "signed-out";

const DEBOUNCE_MS = 800;
const MAX_RETRY_MS = 30_000;

// Photos still uploading hold a blob: preview URL that means nothing after a
// reload. They're left out until the Cloudinary URL replaces it.
export const persistable = (els: PageElement[]) =>
  els.filter((e) => e.type !== "photo" || e.src.startsWith("https://"));

interface Slot {
  saved: { elements: PageElement[]; background: PageBackground };
  timer?: number;
  saving: boolean;
  again: boolean; // changed while a save was in flight
  failures: number;
}

// Plain object, not React state: timers and in-flight saves outlive renders.
// Pages are compared by reference — every edit produces a new elements array.
function createAutosaver(onState: (s: SaveState) => void) {
  const slots = new Map<string, Slot>();
  let latest: Page[] = [];
  let signedOut = false;

  const isDirty = (page: Page, slot: Slot) =>
    page.elements !== slot.saved.elements || page.background !== slot.saved.background;

  const report = () => {
    const all = [...slots.values()];
    onState(
      signedOut
        ? "signed-out"
        : all.some((s) => s.failures > 0)
          ? "retrying"
          : all.some((s) => s.saving || s.timer !== undefined || s.again)
            ? "saving"
            : "saved",
    );
  };

  const schedule = (slot: Slot, pageId: string, ms: number) => {
    window.clearTimeout(slot.timer);
    slot.timer = window.setTimeout(() => void save(pageId), ms);
  };

  async function save(pageId: string, keepalive = false) {
    const slot = slots.get(pageId);
    const page = latest.find((p) => p.id === pageId);
    if (!slot || signedOut) return;
    window.clearTimeout(slot.timer);
    slot.timer = undefined;
    if (!page) {
      slots.delete(pageId); // page was deleted
      report();
      return;
    }
    // One request per page at a time, so an older save can't land last.
    if (slot.saving) {
      slot.again = true;
      return;
    }
    if (!isDirty(page, slot)) {
      report();
      return;
    }

    slot.saving = true;
    report();
    const sent = { elements: page.elements, background: page.background };
    try {
      const res = await fetch(`/api/admin/pages/${pageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elements: persistable(sent.elements), background: sent.background }),
        keepalive,
      });
      if (res.status === 401) {
        signedOut = true;
      } else if (res.ok || res.status === 404) {
        slot.saved = sent;
        slot.failures = 0;
      } else if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
        // The server will never accept this version; don't retry it forever.
        console.error(`autosave rejected for page ${pageId}: ${res.status}`);
        slot.saved = sent;
        slot.failures = 0;
      } else {
        throw new Error(String(res.status));
      }
    } catch {
      slot.failures += 1;
      schedule(slot, pageId, Math.min(MAX_RETRY_MS, 1000 * 2 ** slot.failures));
    } finally {
      slot.saving = false;
      if (slot.again) {
        slot.again = false;
        void save(pageId);
      }
      report();
    }
  }

  return {
    update(pages: Page[]) {
      latest = pages;
      for (const page of pages) {
        const slot = slots.get(page.id);
        if (!slot) {
          // First sight of a page = what the server has.
          slots.set(page.id, {
            saved: { elements: page.elements, background: page.background },
            saving: false,
            again: false,
            failures: 0,
          });
        } else if (isDirty(page, slot) && slot.failures === 0) {
          schedule(slot, page.id, DEBOUNCE_MS);
        }
      }
      for (const id of slots.keys()) {
        if (!pages.some((p) => p.id === id)) slots.delete(id);
      }
      report(); // "Saving…" from the first keystroke, not after the debounce
    },
    flushAll() {
      for (const [id, slot] of slots) {
        const page = latest.find((p) => p.id === id);
        if (page && isDirty(page, slot)) void save(id, true);
      }
    },
    hasUnsaved() {
      return [...slots].some(([id, slot]) => {
        const page = latest.find((p) => p.id === id);
        return !!page && isDirty(page, slot);
      });
    },
  };
}

/** Debounced autosave of every changed page. No save button. */
export function useAutosave(pages: Page[]): SaveState {
  const [state, setState] = useState<SaveState>("saved");
  const [saver] = useState(() => createAutosaver(setState));

  useEffect(() => {
    saver.update(pages);
  }, [saver, pages]);

  useEffect(() => {
    // Leaving the tab or app: send what's pending now (keepalive requests
    // survive the page going away). Closing with unsaved work also warns.
    const onHide = () => {
      if (document.visibilityState === "hidden") saver.flushAll();
    };
    const onPageHide = () => saver.flushAll();
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!saver.hasUnsaved()) return;
      saver.flushAll();
      e.preventDefault();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      saver.flushAll();
    };
  }, [saver]);

  return state;
}
