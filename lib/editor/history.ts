import type { Page, PageElement } from "@/lib/diary/types";

// Undo/redo over element edits. Each entry is one page's elements array
// before and after; arrays are immutable and shared, so entries are cheap.
// Page add/delete aren't recorded — they happen on the server first, and an
// entry whose page has since been deleted is skipped.

export interface HistoryEntry {
  // Edits sharing a group merge into one step: the element's id plus a
  // counter the editor bumps on every pointer-up and key-up, so one drag or
  // one held nudge is one step. Undefined never merges.
  group?: string;
  pageId: string;
  before: PageElement[];
  after: PageElement[];
}

// Pages and history live in one state value so every update is a pure
// function of the previous one (safe under StrictMode's double invoke).
export interface Doc {
  pages: Page[];
  past: HistoryEntry[];
  future: HistoryEntry[];
}

const LIMIT = 200;

const sameElements = (a: PageElement[], b: PageElement[]) =>
  a === b || (a.length === b.length && a.every((e, i) => e === b[i]));

export function recordEdit(
  doc: Doc,
  pageId: string,
  fn: (els: PageElement[]) => PageElement[],
  group: string | undefined,
): Doc {
  const page = doc.pages.find((p) => p.id === pageId);
  if (!page) return doc;
  const after = fn(page.elements);
  if (sameElements(after, page.elements)) return doc;

  const pages = doc.pages.map((p) => (p === page ? { ...p, elements: after } : p));
  const last = doc.past[doc.past.length - 1];
  const merge = group !== undefined && last?.group === group && last.pageId === pageId;

  const past = merge
    ? [...doc.past.slice(0, -1), { ...last, after }]
    : [...doc.past, { group, pageId, before: page.elements, after }].slice(-LIMIT);
  return { pages, past, future: [] };
}

function step(doc: Doc, from: "past" | "future"): { doc: Doc; pageId: string | null } {
  const source = [...doc[from]];
  while (source.length) {
    const entry = source.pop()!;
    const page = doc.pages.find((p) => p.id === entry.pageId);
    if (!page) continue; // page deleted since
    const elements = from === "past" ? entry.before : entry.after;
    const pages = doc.pages.map((p) => (p === page ? { ...p, elements } : p));
    // Dropping the group stops a later edit merging into a step just undone.
    const moved = { ...entry, group: undefined };
    return {
      doc:
        from === "past"
          ? { pages, past: source, future: [...doc.future, moved] }
          : { pages, past: [...doc.past, moved], future: source },
      pageId: entry.pageId,
    };
  }
  return { doc: { ...doc, [from]: [] }, pageId: null };
}

export const undo = (doc: Doc) => step(doc, "past");
export const redo = (doc: Doc) => step(doc, "future");

// A change that must apply everywhere without becoming a step: swapping an
// upload's blob: preview for its Cloudinary URL (or removing a failed one),
// so undo can never bring back a dead preview URL.
export function mapAllElements(doc: Doc, fn: (els: PageElement[]) => PageElement[]): Doc {
  const entries = (list: HistoryEntry[]) =>
    list.map((e) => {
      const before = fn(e.before);
      const after = fn(e.after);
      return before === e.before && after === e.after ? e : { ...e, before, after };
    });
  return {
    pages: doc.pages.map((p) => {
      const elements = fn(p.elements);
      return elements === p.elements ? p : { ...p, elements };
    }),
    past: entries(doc.past),
    future: entries(doc.future),
  };
}
