"use client";

import { useState, type CSSProperties } from "react";
import { Page } from "@/components/diary/Page";
import { PhotoDisplayContext } from "@/components/diary/elements/PhotoView";
import type { Page as PageData } from "@/lib/diary/types";
import s from "./PagesGrid.module.css";

// Mockup screen 5. Each thumbnail is the real page renderer at thumbnail
// width — same scale-to-fit, so it's an exact miniature.

const TILTS = [-2.6, 2.2, 1.8, -1.6, 2.6, -2.2];
const THUMB_PHOTOS = { width: 400, lazy: true };

interface PagesGridProps {
  pages: PageData[];
  current: number;
  busy: boolean;
  onOpen: (index: number) => void;
  onAdd: () => void;
  onDuplicate: (page: PageData) => void;
  onDelete: (page: PageData) => void;
  onClose: () => void;
}

export function PagesGrid({
  pages,
  current,
  busy,
  onOpen,
  onAdd,
  onDuplicate,
  onDelete,
  onClose,
}: PagesGridProps) {
  // Options menu for one page; `confirm` is the second step of Delete.
  const [menu, setMenu] = useState<{ id: string; confirm: boolean } | null>(null);
  const tilt = (i: number) => ({ "--tilt": `${TILTS[i % TILTS.length]}deg` }) as CSSProperties;

  return (
    <div className={s.root} role="dialog" aria-modal="true" aria-label="All pages">
      <div className={s.column}>
        <header className={s.header}>
          <h2 className={s.title}>Pages</h2>
          <p className={s.meta}>
            {pages.length} {pages.length === 1 ? "page" : "pages"}
          </p>
        </header>

        <PhotoDisplayContext value={THUMB_PHOTOS}>
          <ol className={s.grid}>
            {pages.map((page, i) => (
              <li key={page.id} className={s.tile} style={tilt(i)}>
                <div className={s.thumb} data-current={i === current || undefined}>
                  <Page page={page} />
                  {/* A sibling over the page, not a wrapper: pages are divs,
                      and a <button> may only contain phrasing content. */}
                  <button
                    type="button"
                    className={s.open}
                    aria-label={`Open page ${i + 1}`}
                    onClick={() => onOpen(i)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMenu({ id: page.id, confirm: false });
                    }}
                  />
                  <button
                    type="button"
                    className={s.more}
                    aria-label={`Page ${i + 1} options`}
                    aria-expanded={menu?.id === page.id}
                    onClick={() => setMenu((m) => (m?.id === page.id ? null : { id: page.id, confirm: false }))}
                  >
                    ···
                  </button>
                </div>
                <span className={s.number}>{String(i + 1).padStart(2, "0")}</span>

                {menu?.id === page.id && (
                  <div className={s.menu} role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      disabled={busy}
                      onClick={() => {
                        setMenu(null);
                        onDuplicate(page);
                      }}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={s.danger}
                      disabled={busy || pages.length === 1}
                      onClick={() => {
                        if (!menu.confirm) {
                          setMenu({ id: page.id, confirm: true });
                          return;
                        }
                        setMenu(null);
                        onDelete(page);
                      }}
                    >
                      {menu.confirm ? `Delete page ${i + 1}?` : "Delete"}
                    </button>
                  </div>
                )}
              </li>
            ))}

            <li className={s.tile} style={tilt(pages.length)}>
              <button type="button" className={s.newPage} disabled={busy} onClick={onAdd}>
                <span className={s.plus}>+</span>
                <span>New page</span>
              </button>
            </li>
          </ol>
        </PhotoDisplayContext>
      </div>

      <div className={s.footer}>
        <button type="button" className={s.done} onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
