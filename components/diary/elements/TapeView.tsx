import type { TapeElement } from "@/lib/diary/types";
import { TAPE, TAPE_FALLBACK } from "@/lib/diary/presets";

export function TapeView({ element }: { element: TapeElement }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: TAPE[element.variant] ?? TAPE[TAPE_FALLBACK],
        boxShadow: "var(--shadow-sm)",
      }}
    />
  );
}
