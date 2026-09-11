// Natural height of a rendered text element, in page units (layout sizes are
// untransformed). Includes the card's padding and border.
export function measureTextHeight(frame: HTMLElement, elementId: string) {
  const root = frame.querySelector<HTMLElement>(
    `[data-element-id="${CSS.escape(elementId)}"] > [data-text-root]`,
  );
  const content = root?.querySelector<HTMLElement>("[data-text-content]");
  if (!root || !content) return null;
  const cs = getComputedStyle(root);
  return (
    content.offsetHeight +
    parseFloat(cs.paddingTop) +
    parseFloat(cs.paddingBottom) +
    parseFloat(cs.borderTopWidth) +
    parseFloat(cs.borderBottomWidth)
  );
}
