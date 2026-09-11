"use client";

import { useRef } from "react";
import type { Page as PageData } from "@/lib/diary/types";
import { ElementView } from "./elements/ElementView";
import { usePageScale } from "./usePageScale";
import styles from "./Page.module.css";

// Renders one page. The frame takes its width from the parent and its height
// from the 800:1100 aspect ratio; the sheet inside is laid out at exactly
// 800 × 1100 and scaled down to the frame with a single transform.
export function Page({ page }: { page: PageData }) {
  const frameRef = useRef<HTMLDivElement>(null);
  usePageScale(frameRef);

  const number = page.index + 1;

  return (
    <div ref={frameRef} className={styles.frame} data-background={page.background}>
      <div className={styles.sheet}>
        <span className={styles.folio} data-side={number % 2 ? "left" : "right"}>
          {number}
        </span>
        {page.elements.map((element) => (
          <ElementView key={element.id} element={element} />
        ))}
      </div>
    </div>
  );
}
