import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from "react";
import type { Page as PageData } from "@/lib/diary/types";
import { Page } from "./Page";
import styles from "./Spread.module.css";

interface SpreadProps {
  pages: readonly [PageData, PageData?];
  // Which page shows when only one fits (mobile / portrait).
  focus?: 0 | 1;
  className?: string;
  // Editor hooks: stage events, the pan/zoom transform, per-page chrome.
  stageRef?: Ref<HTMLDivElement>;
  stageProps?: HTMLAttributes<HTMLDivElement>;
  cameraStyle?: CSSProperties;
  renderOverlay?: (page: PageData) => ReactNode;
}

// Desktop: an open book, two pages and a gutter shadow. Mobile: one page.
// The switch is pure CSS, so server and client render the same markup.
// Fills its parent, which must give it a definite size.
export function Spread({
  pages,
  focus = 0,
  className,
  stageRef,
  stageProps,
  cameraStyle,
  renderOverlay,
}: SpreadProps) {
  const [left, right] = pages;

  return (
    <div
      ref={stageRef}
      {...stageProps}
      className={className ? `${styles.stage} ${className}` : styles.stage}
    >
      <div className={styles.camera} style={cameraStyle}>
        <div className={styles.book}>
          <div className={styles.leaves}>
            <div className={styles.leaf} data-focus={focus === 0 || undefined}>
              <Page page={left} overlay={renderOverlay?.(left)} />
            </div>
            {right ? (
              <div className={styles.leaf} data-focus={focus === 1 || undefined}>
                <Page page={right} overlay={renderOverlay?.(right)} />
              </div>
            ) : (
              // Odd page count: the last spread faces a blank leaf, not bare cover.
              <div className={styles.leaf} data-blank aria-hidden />
            )}
            <div className={styles.gutter} aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
