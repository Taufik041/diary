"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { Spread } from "@/components/diary/Spread";
import type { Page as PageData, PageElement } from "@/lib/diary/types";
import { clampCamera, zoomFromTo, type Camera } from "@/lib/editor/camera";
import {
  add,
  angle,
  center,
  clientToPage,
  handlePoint,
  len,
  mul,
  pinch,
  pxPerUnit,
  r1,
  readPageMatrix,
  resizeFree,
  resizeUniform,
  rotationAt,
  roundBox,
  snapMove,
  sub,
  type Box,
  type Guide,
  type Handle,
  type PageMatrix,
  type Vec,
} from "@/lib/editor/geometry";
import { PageOverlay } from "./PageOverlay";
import styles from "./Editor.module.css";

const SNAP_PX = 6; // snap distance, in screen pixels
const SLOP_PX: Record<string, number> = { mouse: 3, pen: 5, touch: 8 };

export type Selection = { pageId: string; elementId: string } | null;
type Target = { pageId: string; elementId: string };

type Gesture =
  | { kind: "idle" }
  | { kind: "ignore" } // wait for every pointer to lift
  | {
      // Pointer down, not yet past the slop distance: could still be a tap.
      kind: "pending";
      pointerId: number;
      start: Vec;
      slop: number;
      action: "drag" | "select" | "background";
      wasSelected: boolean;
      pageId: string | null;
      elementId: string | null;
    }
  | (Target & {
      kind: "drag";
      pointerId: number;
      m: PageMatrix;
      p0: Vec;
      el0: PageElement;
      others: Box[];
      threshold: number;
    })
  | (Target & {
      kind: "resize";
      pointerId: number;
      m: PageMatrix;
      handle: Handle;
      offset: Vec; // handle position − pointer, so the handle doesn't jump
      el0: PageElement;
    })
  | (Target & { kind: "rotate"; pointerId: number; m: PageMatrix; c0: Vec; a0: number; el0: PageElement })
  | (Target & {
      kind: "pinch-element";
      a: number;
      b: number;
      m: PageMatrix;
      pa0: Vec;
      pb0: Vec;
      el0: PageElement;
    })
  | { kind: "pan"; pointerId: number; start: Vec; cam0: Camera }
  | { kind: "pinch-page"; a: number; b: number; mid0: Vec; d0: number; cam0: Camera };

interface CanvasProps {
  // The spread on screen: one or two pages.
  pages: PageData[];
  // Which of them shows in the single-page (mobile) layout.
  focus: 0 | 1;
  selection: Selection;
  stageRef: RefObject<HTMLDivElement | null>;
  className?: string;
  onSelect: (selection: Selection) => void;
  onChange: (pageId: string, elementId: string, patch: Partial<PageElement>) => void;
  // A tap on the element that was already selected.
  onOpen: (pageId: string, elementId: string) => void;
  // Any press on a page — the editor adds new elements to the last one.
  onPageTouch: (pageId: string) => void;
}

// The spread plus every direct-manipulation gesture. All maths happens in
// page units; see readPageMatrix() for the screen → page mapping.
export function Canvas({
  pages,
  focus,
  selection,
  stageRef,
  className,
  onSelect,
  onChange,
  onOpen,
  onPageTouch,
}: CanvasProps) {
  const [guides, setGuides] = useState<{ pageId: string; guides: Guide[] } | null>(null);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });

  const pointers = useRef(new Map<number, Vec>());
  const gesture = useRef<Gesture>({ kind: "idle" });
  const cameraRef = useRef(camera);
  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  const findElement = (pageId: string, elementId: string) =>
    pages.find((p) => p.id === pageId)?.elements.find((e) => e.id === elementId);

  const frameOf = (pageId: string) =>
    stageRef.current?.querySelector<HTMLElement>(`[data-page-id="${CSS.escape(pageId)}"]`) ?? null;

  const pos = (pointerId: number) => pointers.current.get(pointerId)!;

  // ── Gesture starts ────────────────────────────────────────────────────────

  const elementGesture = (pageId: string, elementId: string) => {
    const frame = frameOf(pageId);
    const m = frame && readPageMatrix(frame);
    const el0 = findElement(pageId, elementId);
    return m && el0 ? { m, el0 } : null;
  };

  const beginDrag = (pointerId: number, pageId: string, elementId: string, start: Vec): Gesture => {
    const g = elementGesture(pageId, elementId);
    if (!g) return { kind: "ignore" };
    const page = pages.find((p) => p.id === pageId)!;
    return {
      kind: "drag",
      pointerId,
      pageId,
      elementId,
      ...g,
      p0: clientToPage(g.m, start),
      others: page.elements.filter((e) => e.id !== elementId),
      threshold: SNAP_PX / pxPerUnit(g.m),
    };
  };

  const beginHandle = (pointerId: number, t: Target, handle: Handle | "rotate", start: Vec): Gesture => {
    const g = elementGesture(t.pageId, t.elementId);
    if (!g) return { kind: "ignore" };
    const p0 = clientToPage(g.m, start);
    if (handle === "rotate") {
      const c0 = center(g.el0);
      return { kind: "rotate", pointerId, ...t, ...g, c0, a0: angle(sub(p0, c0)) };
    }
    return { kind: "resize", pointerId, ...t, ...g, handle, offset: sub(handlePoint(g.el0, handle), p0) };
  };

  // Second finger down. Rule: if the first finger is on the selected element,
  // the pinch transforms that element; otherwise it pans/zooms the page.
  const beginPinch = (): Gesture => {
    const [a, b] = [...pointers.current.keys()];
    const g = gesture.current;
    const onSelected =
      (g.kind === "pending" && g.action === "drag") || g.kind === "drag" ? g : null;

    if (onSelected && onSelected.pointerId === a && onSelected.pageId && onSelected.elementId) {
      const t = { pageId: onSelected.pageId, elementId: onSelected.elementId };
      const eg = elementGesture(t.pageId, t.elementId);
      if (eg) {
        return {
          kind: "pinch-element",
          a,
          b,
          ...t,
          ...eg,
          pa0: clientToPage(eg.m, pos(a)),
          pb0: clientToPage(eg.m, pos(b)),
        };
      }
    }

    const rect = stageRef.current!.getBoundingClientRect();
    const la = sub(pos(a), { x: rect.left, y: rect.top });
    const lb = sub(pos(b), { x: rect.left, y: rect.top });
    return {
      kind: "pinch-page",
      a,
      b,
      mid0: mul(add(la, lb), 0.5),
      d0: len(sub(lb, la)),
      cam0: camera,
    };
  };

  // ── Gesture updates ───────────────────────────────────────────────────────

  const apply = (g: Gesture) => {
    switch (g.kind) {
      case "drag": {
        const p = clientToPage(g.m, pos(g.pointerId));
        const moved = { ...g.el0, x: g.el0.x + p.x - g.p0.x, y: g.el0.y + p.y - g.p0.y };
        const snapped = snapMove(moved, g.others, g.threshold);
        onChange(g.pageId, g.elementId, { x: r1(snapped.box.x), y: r1(snapped.box.y) });
        setGuides(snapped.guides.length ? { pageId: g.pageId, guides: snapped.guides } : null);
        return;
      }
      case "resize": {
        const q = add(clientToPage(g.m, pos(g.pointerId)), g.offset);
        const el = g.el0;
        if (el.type === "text") {
          // Side handles change width (the text rewraps); corners scale the
          // box and the type together. The editor refits the height.
          if (g.handle === "e" || g.handle === "w") {
            return onChange(g.pageId, g.elementId, roundBox(resizeFree(el, g.handle, q)));
          }
          const { box, k } = resizeUniform(el, g.handle, q);
          return onChange(g.pageId, g.elementId, { ...roundBox(box), fontSize: r1(el.fontSize * k) });
        }
        const box = el.type === "clip" ? resizeUniform(el, g.handle, q).box : resizeFree(el, g.handle, q);
        return onChange(g.pageId, g.elementId, roundBox(box));
      }
      case "rotate": {
        const rotation = rotationAt(g.el0, g.c0, g.a0, clientToPage(g.m, pos(g.pointerId)));
        return onChange(g.pageId, g.elementId, { rotation: Math.round(rotation * 100) / 100 });
      }
      case "pinch-element": {
        const { box, k } = pinch(
          g.el0,
          g.pa0,
          g.pb0,
          clientToPage(g.m, pos(g.a)),
          clientToPage(g.m, pos(g.b)),
        );
        const patch: Partial<PageElement> = roundBox(box);
        if (g.el0.type === "text") Object.assign(patch, { fontSize: r1(g.el0.fontSize * k) });
        return onChange(g.pageId, g.elementId, patch);
      }
      case "pan": {
        const d = sub(pos(g.pointerId), g.start);
        const stage = stageRef.current!;
        setCamera(
          clampCamera({ ...g.cam0, x: g.cam0.x + d.x, y: g.cam0.y + d.y }, stage.clientWidth, stage.clientHeight),
        );
        return;
      }
      case "pinch-page": {
        const rect = stageRef.current!.getBoundingClientRect();
        const la = sub(pos(g.a), { x: rect.left, y: rect.top });
        const lb = sub(pos(g.b), { x: rect.left, y: rect.top });
        const zoom = (g.cam0.zoom * len(sub(lb, la))) / g.d0;
        setCamera(
          clampCamera(zoomFromTo(g.cam0, g.mid0, mul(add(la, lb), 0.5), zoom), rect.width, rect.height),
        );
        return;
      }
    }
  };

  // ── Pointer events ────────────────────────────────────────────────────────

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic or already-released pointer; moves still bubble to the stage.
    }
    const start = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, start);

    if (pointers.current.size === 2) {
      setGuides(null);
      gesture.current = beginPinch();
      return;
    }
    if (pointers.current.size > 2) return;

    const target = e.target as Element;
    const pageId = target.closest<HTMLElement>("[data-page-id]")?.dataset.pageId ?? null;
    const handle = target.closest<HTMLElement>("[data-handle]")?.dataset.handle as Handle | "rotate" | undefined;
    const onSelectionBox = !!target.closest("[data-selection]");
    const hitId = target.closest<HTMLElement>("[data-element-id]")?.dataset.elementId ?? null;
    const slop = SLOP_PX[e.pointerType] ?? 5;
    const base = { kind: "pending", pointerId: e.pointerId, start, slop } as const;
    const selectedHere = selection && selection.pageId === pageId ? selection : null;
    if (pageId) onPageTouch(pageId);

    if (selectedHere && handle) {
      gesture.current = beginHandle(e.pointerId, selectedHere, handle, start);
    } else if (selectedHere && (onSelectionBox || hitId === selectedHere.elementId)) {
      gesture.current = { ...base, action: "drag", wasSelected: true, ...selectedHere };
    } else if (hitId && pageId) {
      // Mouse selects on press so a click-drag moves straight away. Touch
      // selects on tap, so a stray finger can't move an unselected element.
      if (e.pointerType === "mouse") {
        onSelect({ pageId, elementId: hitId });
        gesture.current = { ...base, action: "drag", wasSelected: false, pageId, elementId: hitId };
      } else {
        gesture.current = { ...base, action: "select", wasSelected: false, pageId, elementId: hitId };
      }
    } else {
      gesture.current = { ...base, action: "background", wasSelected: false, pageId, elementId: null };
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, p);

    let g = gesture.current;
    if (g.kind === "pending") {
      if (e.pointerId !== g.pointerId || len(sub(p, g.start)) < g.slop) return;
      if (g.action === "drag" && g.pageId && g.elementId) {
        g = beginDrag(g.pointerId, g.pageId, g.elementId, g.start);
      } else if (g.action === "background" && camera.zoom > 1) {
        g = { kind: "pan", pointerId: g.pointerId, start: g.start, cam0: camera };
      } else {
        g = { kind: "ignore" };
      }
      gesture.current = g;
    }
    apply(g);
  };

  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    const g = gesture.current;

    if (g.kind === "pending" && g.pointerId === e.pointerId && e.type === "pointerup") {
      if (g.action === "select" && g.pageId && g.elementId) {
        onSelect({ pageId: g.pageId, elementId: g.elementId });
      } else if (g.action === "drag" && g.wasSelected && g.pageId && g.elementId) {
        onOpen(g.pageId, g.elementId);
      } else if (g.action === "background") {
        onSelect(null);
      }
    }

    if (pointers.current.size === 0) {
      gesture.current = { kind: "idle" };
      setGuides(null);
    } else {
      // A finger lifted mid-gesture: finish cleanly rather than jump.
      gesture.current = { kind: "ignore" };
    }
  };

  // Trackpad: pinch arrives as ctrl+wheel; two-finger scroll pans when zoomed.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && cameraRef.current.zoom === 1) return;
      e.preventDefault();
      const rect = stage.getBoundingClientRect();
      const focal = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setCamera((c) =>
        clampCamera(
          e.ctrlKey
            ? zoomFromTo(c, focal, focal, c.zoom * Math.exp(-e.deltaY * 0.01))
            : { ...c, x: c.x - e.deltaX, y: c.y - e.deltaY },
          rect.width,
          rect.height,
        ),
      );
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [stageRef]);

  const cameraStyle = {
    transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
    "--zoom": camera.zoom,
  } as CSSProperties;

  return (
    <Spread
      pages={[pages[0], pages[1]]}
      focus={focus}
      className={className ? `${styles.stage} ${className}` : styles.stage}
      stageRef={stageRef}
      stageProps={{
        onPointerDown,
        onPointerMove,
        onPointerUp: onPointerEnd,
        onPointerCancel: onPointerEnd,
      }}
      cameraStyle={cameraStyle}
      renderOverlay={(page) => (
        <PageOverlay
          page={page}
          selectedId={selection?.pageId === page.id ? selection.elementId : null}
          guides={guides?.pageId === page.id ? guides.guides : null}
        />
      )}
    />
  );
}
