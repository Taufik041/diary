import { useSyncExternalStore } from "react";

// Same breakpoint as the spread's single-page CSS (Spread.module.css). The
// layout itself is pure CSS; this only decides how far ‹ › move.
const QUERY = "(max-width: 899px), (orientation: portrait)";

const subscribe = (onChange: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};

export const useSinglePage = () =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
