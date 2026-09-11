import { memo, type CSSProperties } from "react";
import type { PageElement } from "@/lib/diary/types";
import { ClipView } from "./ClipView";
import { PhotoView } from "./PhotoView";
import { TapeView } from "./TapeView";
import { TextView } from "./TextView";

// Positions one element in page units. The type-specific view fills the box.
// Memoised: while one element is dragged, the others keep their object
// identity and don't re-render.
export const ElementView = memo(function ElementView({ element }: { element: PageElement }) {
  const body = renderBody(element);
  // Unknown types (e.g. a sticker saved by a newer build) are skipped.
  if (!body) return null;

  const box: CSSProperties = {
    position: "absolute",
    left: element.x,
    top: element.y,
    width: element.w,
    height: element.h,
    transform: `rotate(${element.rotation}deg)`,
    zIndex: element.z,
  };

  return (
    <div data-element-id={element.id} data-type={element.type} style={box}>
      {body}
    </div>
  );
});

function renderBody(element: PageElement) {
  switch (element.type) {
    case "photo":
      return <PhotoView element={element} />;
    case "text":
      return <TextView element={element} />;
    case "tape":
      return <TapeView element={element} />;
    case "clip":
      return <ClipView />;
    default:
      return null;
  }
}
