"use client";

import { useState } from "react";
import type { PhotoElement } from "@/lib/diary/types";
import { FONTS, PHOTO_FALLBACK_BG, frameInsets } from "@/lib/diary/presets";

export function PhotoView({ element }: { element: PhotoElement }) {
  const { w, h, frame, src, caption } = element;
  const inset = frameInsets(frame, w, h);
  const bordered = frame !== "rounded";

  // Keyed on src so a new src gets a fresh attempt.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = !src || failedSrc === src;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        padding: `${inset.top}px ${inset.side}px ${inset.bottom}px`,
        background: bordered
          ? frame === "polaroid"
            ? "var(--photo-white)"
            : "var(--photo-white-thin)"
          : undefined,
        borderRadius: inset.radius,
        overflow: "hidden",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
          background: PHOTO_FALLBACK_BG,
        }}
      >
        {!failed && (
          // Plain <img>: the page is transform-scaled, so next/image's
          // viewport-based sizing would pick the wrong width.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={(img) => {
              // An image that errored before hydration never fires onError.
              if (img?.complete && img.naturalWidth === 0) setFailedSrc(src);
            }}
            src={src}
            alt={caption ?? ""}
            draggable={false}
            onError={() => setFailedSrc(src)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
      </div>

      {frame === "polaroid" && caption && (
        <div
          style={{
            position: "absolute",
            left: inset.side,
            right: inset.side,
            bottom: 0,
            height: inset.bottom,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONTS.caveat.family,
            fontSize: inset.bottom * 0.48,
            lineHeight: 1,
            color: "var(--ink-soft)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
}
