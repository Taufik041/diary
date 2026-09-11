import { PAGE_H, PAGE_W, type Page, type PageElement } from "@/lib/diary/types";
import type { Guide, Handle } from "@/lib/editor/geometry";
import styles from "./Editor.module.css";

const CORNERS: Handle[] = ["nw", "ne", "se", "sw"];
const EDGES: Handle[] = ["e", "w"];

// Editing chrome for one page, drawn in page units in the page's unclipped
// overlay layer. Screen-constant sizes come from --px in Editor.module.css.
export function PageOverlay({
  page,
  selectedId,
  guides,
}: {
  page: Page;
  selectedId: string | null;
  guides: Guide[] | null;
}) {
  const selected = selectedId ? page.elements.find((e) => e.id === selectedId) : undefined;

  return (
    <>
      {/* Read by readPageMatrix(): page (0,0), (800,0) and (0,1100). */}
      <span data-probe="o" className={styles.probe} />
      <span data-probe="x" className={styles.probe} style={{ left: PAGE_W }} />
      <span data-probe="y" className={styles.probe} style={{ top: PAGE_H }} />

      {selected && <SelectionBox element={selected} />}

      {guides?.map((g) => (
        <div
          key={`${g.axis}${g.at}`}
          className={styles.guide}
          data-axis={g.axis}
          style={g.axis === "x" ? { left: g.at } : { top: g.at }}
        />
      ))}
    </>
  );
}

function SelectionBox({ element }: { element: PageElement }) {
  return (
    <div
      data-selection
      className={styles.selection}
      style={{
        left: element.x,
        top: element.y,
        width: element.w,
        height: element.h,
        transform: `rotate(${element.rotation}deg)`,
      }}
    >
      <div className={styles.ring} />
      {CORNERS.map((h) => (
        <div key={h} data-handle={h} className={styles.handle} />
      ))}
      {/* Text also gets side handles: width only, so the text rewraps. */}
      {element.type === "text" &&
        EDGES.map((h) => <div key={h} data-handle={h} className={`${styles.handle} ${styles.edge}`} />)}
      <div className={styles.stem} />
      <div data-handle="rotate" className={`${styles.handle} ${styles.rotate}`} />
    </div>
  );
}
