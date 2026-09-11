import { useId } from "react";

// A gem paperclip drawn as one wire. The gradient id must be unique per
// instance: a duplicate id inside a display:none page (the hidden page on
// mobile) would break the visible clip's gradient.
export function ClipView() {
  const gradientId = `clip${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <svg
      viewBox="0 0 28 70"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      style={{
        display: "block",
        overflow: "visible",
        filter: "drop-shadow(0 2px 2.5px rgba(107,83,74,.26))",
      }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" style={{ stopColor: "var(--clip-metal)" }} />
          <stop offset=".5" style={{ stopColor: "var(--clip-metal-light)" }} />
          <stop offset="1" style={{ stopColor: "var(--clip-metal)" }} />
        </linearGradient>
      </defs>
      <path
        d="M8.5 20 V51 A5.5 5.5 0 0 0 19.5 51 V12 A9 9 0 0 0 1.5 12 V57 A12.5 12.5 0 0 0 26.5 57 V16"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    </svg>
  );
}
