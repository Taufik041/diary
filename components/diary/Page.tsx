"use client";

import { useRef, type ReactNode } from "react";
import type { Page as PageData } from "@/lib/diary/types";
import { ElementView } from "./elements/ElementView";
import { usePageScale } from "./usePageScale";
import styles from "./Page.module.css";

// Renders one page. The frame takes its width from the parent and its height
// from the 800:1100 aspect ratio; the sheet inside is laid out at exactly
// 800 × 1100 and scaled down to the frame with a single transform.
//
// `overlay` is drawn in a second 800 × 1100 layer with the same transform but
// no clipping, so editing handles can reach past the paper edge.
export function Page({ page, overlay }: { page: PageData; overlay?: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  usePageScale(frameRef);

  const number = page.index + 1;

  return (
    <div
      ref={frameRef}
      className={styles.frame}
      data-background={page.background}
      data-page-id={page.id}
    >
      <div className={styles.sheet}>
        <span className={styles.folio} data-side={number % 2 ? "left" : "right"}>
          {number}
        </span>
        {page.elements.map((element) => (
          <ElementView key={element.id} element={element} />
        ))}
      </div>
      {overlay && <div className={styles.overlay}>{overlay}</div>}
    </div>
  );
}
