import { useEffect, type RefObject } from "react";
import { PAGE_W } from "@/lib/diary/types";

// Writes --page-scale (frame width / 800) onto the frame and marks it
// data-scaled. A CSS variable rather than React state, so resizing never
// re-renders the elements.
export function usePageScale(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;

    const observer = new ResizeObserver(([entry]) => {
      // Layout width, not getBoundingClientRect(): the book is tilted, and a
      // bounding rect includes ancestor rotation.
      const width = entry.contentBoxSize[0].inlineSize;
      frame.style.setProperty("--page-scale", String(width / PAGE_W));
      frame.dataset.scaled = "";
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [ref]);
}
