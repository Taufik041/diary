import type { CSSProperties } from "react";
import type { TextAlign, TextElement } from "@/lib/diary/types";
import { CARD_TITLE_RATIO, FONTS, INK } from "@/lib/diary/presets";

// Text wraps at the element's width. The box is w × h; overflow stays visible
// so a small metric difference between engines never clips a line.
export function TextView({ element }: { element: TextElement }) {
  const { content, style, fontFamily, fontSize, color, align, title, rule } = element;
  const face = FONTS[fontFamily] ?? FONTS.caveat;
  const ink = INK[color] ?? INK.ink;

  const body: CSSProperties = {
    fontFamily: face.family,
    fontStyle: face.style,
    lineHeight: face.lineHeight,
    letterSpacing: face.letterSpacing,
    color: ink,
    textAlign: align,
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    textWrap: "pretty",
  };

  if (style !== "card") {
    return (
      <div style={{ ...body, width: "100%", height: "100%", fontSize }}>
        {content}
        {rule && <Rule align={align} width="4.5em" margin=".24em 0 0" />}
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        fontSize,
        padding: ".85em 1em 1em",
        background: "var(--card)",
        border: "2px solid var(--card-edge)",
        boxShadow: "var(--shadow-el)",
      }}
    >
      {title && (
        <>
          <div
            style={{
              fontFamily: FONTS.cormorant.family,
              fontStyle: "italic",
              fontSize: `${CARD_TITLE_RATIO}em`,
              lineHeight: 1.25,
              letterSpacing: FONTS.cormorant.letterSpacing,
              color: ink,
              textAlign: align,
            }}
          >
            {title}
          </div>
          <Rule align={align} width="2.1em" margin=".4em 0 .5em" />
        </>
      )}
      <div style={body}>{content}</div>
    </div>
  );
}

// The sage hairline. 2 page units: the page is almost always shown scaled
// down, and 1 unit would vanish on a phone.
function Rule({ align, width, margin }: { align: TextAlign; width: string; margin: string }) {
  return (
    <div
      style={{
        width,
        height: 2,
        margin,
        marginLeft: align === "left" ? 0 : "auto",
        marginRight: align === "right" ? 0 : "auto",
        background: "var(--accent-soft)",
      }}
    />
  );
}
