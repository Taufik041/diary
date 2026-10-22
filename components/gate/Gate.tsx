"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { css, mixPalette, paletteFor, phaseAt, readTokens, type Palette, type Phase } from "./palette";
import { PETAL_PATH, PetalField, type Caught } from "./petals";
import { Writing, type Line, type WriteState } from "./Writing";
import s from "./Gate.module.css";

// The garden gate: the sign-in screen. Petals fall over the ground; you write
// the passphrase straight onto the screen and it grows as moss; catching a
// petal opens one of the notes kept under /admin. Sign-in itself is the same
// POST to /api/admin/login as ever — only the surface is new.

const FADE_MS = 4000; // time-of-day cross-fade
const MAX_LENGTH = 200;

// ── Media queries ───────────────────────────────────────────────────────────

function useMedia(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

// ── Layout ──────────────────────────────────────────────────────────────────

let measurer: CanvasRenderingContext2D | null = null;

/** Letter positions for one centred line, shrunk to fit the screen. */
function layoutLine(text: string, family: string, screenW: number): Line {
  const chars = Array.from(text);
  const preferred = Math.min(88, Math.max(44, screenW * 0.11));
  measurer ??= document.createElement("canvas").getContext("2d");
  const measure = (str: string, size: number) => {
    if (!measurer) return str.length * size * 0.4;
    measurer.font = `${size}px ${family}`;
    return measurer.measureText(str).width;
  };
  let fontSize = preferred;
  const full = measure(text, fontSize);
  const room = screenW - 48;
  if (full > room) fontSize = Math.max(18, (fontSize * room) / full);
  // Prefix widths keep the font's own spacing between letters.
  const xs: number[] = [];
  const widths: number[] = [];
  let prefix = "";
  for (const ch of chars) {
    const x = measure(prefix, fontSize);
    xs.push(x);
    prefix += ch;
    widths.push(measure(prefix, fontSize) - x);
  }
  return { chars, xs, widths, fontSize, width: measure(text, fontSize) };
}

interface View {
  w: number; // layout viewport
  h: number;
  cy: number; // middle of what's visible — above the on-screen keyboard
  cx: number;
}

function readView(): View {
  const vv = window.visualViewport;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (!vv) return { w, h, cy: h * 0.46, cx: w / 2 };
  return { w, h, cy: vv.offsetTop + vv.height * 0.46, cx: vv.offsetLeft + vv.width / 2 };
}

const isButton = (target: EventTarget | null) =>
  target instanceof Element && target.closest("button") !== null;

// Enter, as far as a keydown can tell. Android keyboards often send key
// "Unidentified" / keyCode 229 instead, which is why this is never the only
// way in (see `submit`).
const isEnter = (e: KeyboardEvent) => !e.isComposing && (e.key === "Enter" || e.keyCode === 13);

// ── Notes ───────────────────────────────────────────────────────────────────

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type NoteStage = "flying" | "landed" | "open" | "closing";
interface Note {
  text: string;
  from: Caught;
  stage: NoteStage;
}

// ── Gate ────────────────────────────────────────────────────────────────────

export function Gate({ messages }: { messages: string[] }) {
  const router = useRouter();
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const coarse = useMedia("(pointer: coarse)");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldRef = useRef<PetalField | null>(null);

  const [palette, setPalette] = useState<Palette | null>(null);
  const paletteRef = useRef<Palette | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [family, setFamily] = useState<string | null>(null);

  const [value, setValue] = useState("");
  const [state, setState] = useState<WriteState>("idle");
  const [focused, setFocused] = useState(false);
  const [notice, setNotice] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [note, setNote] = useState<Note | null>(null);

  // Timers that belong to this screen, cleared if it goes away.
  const timers = useRef(new Set<number>());
  const later = (fn: () => void, ms: number) => {
    const t = window.setTimeout(() => {
      timers.current.delete(t);
      fn();
    }, ms);
    timers.current.add(t);
  };
  useEffect(() => {
    const set = timers.current;
    return () => set.forEach((t) => window.clearTimeout(t));
  }, []);

  // ── Time of day ─────────────────────────────────────────────────────────

  useEffect(() => {
    const tokens = readTokens();
    let phase: Phase = phaseAt(new Date());
    const apply = (p: Palette) => {
      paletteRef.current = p;
      setPalette(p);
      fieldRef.current?.setPalette(p);
    };
    apply(paletteFor(phase, tokens));

    let fade = 0;
    const check = window.setInterval(() => {
      const next = phaseAt(new Date());
      if (next === phase) return;
      phase = next;
      // Cross-fade from wherever we are (even mid-fade) to the new phase.
      const from = paletteRef.current!;
      const to = paletteFor(next, tokens);
      const start = performance.now();
      window.clearInterval(fade);
      fade = window.setInterval(() => {
        const t = Math.min(1, (performance.now() - start) / FADE_MS);
        apply(mixPalette(from, to, t * t * (3 - 2 * t)));
        if (t === 1) window.clearInterval(fade);
      }, 100);
    }, 30_000);
    return () => {
      window.clearInterval(check);
      window.clearInterval(fade);
    };
  }, []);

  // ── Petals ──────────────────────────────────────────────────────────────

  const ready = palette !== null;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!ready || !canvas) return;
    const field = new PetalField(canvas, paletteRef.current!, reduced);
    fieldRef.current = field;
    field.start();
    const onResize = () => field.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      field.stop();
      fieldRef.current = null;
    };
    // `reduced` is applied below without rebuilding the field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  useEffect(() => fieldRef.current?.setReduced(reduced), [reduced]);

  // ── Viewport and font ───────────────────────────────────────────────────

  useEffect(() => {
    const update = () => setView(readView());
    update();
    const vv = window.visualViewport;
    window.addEventListener("resize", update);
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, []);

  useEffect(() => {
    const name = getComputedStyle(document.documentElement).getPropertyValue("--font-caveat").trim() || "cursive";
    // Measure only once Caveat is in, or the spacing would be the fallback's.
    document.fonts
      .load(`48px ${name}`)
      .catch(() => null)
      .then(() => setFamily(name));
  }, []);

  const line = useMemo(
    () => (family && view ? layoutLine(value, family, view.w) : null),
    [value, family, view],
  );

  // ── Focus ───────────────────────────────────────────────────────────────

  // Desktop starts ready to type. On a phone the keyboard only opens from a
  // tap, so focusing now would just strand a caret.
  useEffect(() => {
    if (!coarse) inputRef.current?.focus({ preventScroll: true });
  }, [coarse]);

  const focusInput = () => {
    const input = inputRef.current;
    if (!input || state !== "idle") return;
    // Already focused without a keyboard (e.g. after the keyboard was
    // dismissed): blur first, so this tap brings it back.
    if (coarse && document.activeElement === input) input.blur();
    input.focus({ preventScroll: true });
  };

  // Typing anywhere on desktop goes to the line.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeNote();
        return;
      }
      // Enter anywhere opens, focused input or not. A focused button is left
      // to its own click.
      if (isEnter(e) && !isButton(e.target)) {
        submit();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
      if (document.activeElement !== inputRef.current) inputRef.current?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── Catching petals ─────────────────────────────────────────────────────

  const bag = useRef<string[]>([]);
  const lastNote = useRef<string | null>(null);
  // Random order, no repeats until every note has been seen.
  const nextMessage = () => {
    if (bag.current.length === 0) {
      bag.current = shuffle(messages);
      // Don't start a new round with the note just read.
      const n = bag.current.length;
      if (n > 1 && bag.current[n - 1] === lastNote.current) {
        [bag.current[0], bag.current[n - 1]] = [bag.current[n - 1], bag.current[0]];
      }
    }
    const text = bag.current.pop()!;
    lastNote.current = text;
    return text;
  };

  function closeNote() {
    setNote((n) => (n && n.stage !== "closing" ? { ...n, stage: "closing" } : n));
    later(() => setNote((n) => (n?.stage === "closing" ? null : n)), 260);
  }

  const catchPetal = (from: Caught) => {
    const text = nextMessage();
    if (reduced) {
      setNote({ text, from, stage: "open" });
      return;
    }
    setNote({ text, from, stage: "flying" });
    // Next frame: start the flight to the middle; then open into a card.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setNote((n) => (n?.stage === "flying" ? { ...n, stage: "landed" } : n))),
    );
    later(() => setNote((n) => (n?.stage === "landed" ? { ...n, stage: "open" } : n)), 720);
  };

  // A press that caught a petal (or closed a note) doesn't also open the
  // keyboard.
  const handled = useRef(false);

  const onPointerDown = (e: ReactPointerEvent) => {
    handled.current = false;
    if (leaving) return;
    // Controls handle their own presses.
    if (isButton(e.target)) {
      handled.current = true;
      return;
    }
    if (note) {
      handled.current = true;
      if (note.stage === "open") closeNote();
      return;
    }
    if (messages.length === 0 || state !== "idle") return;
    const caught = fieldRef.current?.catchAt(e.clientX, e.clientY);
    if (caught) {
      handled.current = true;
      catchPetal(caught);
    }
  };

  const onClick = () => {
    if (handled.current) {
      handled.current = false;
      return;
    }
    focusInput();
  };

  // Pointer cursor over a catchable petal (mouse only).
  const [overPetal, setOverPetal] = useState(false);
  const onPointerMove = (e: ReactPointerEvent) => {
    if (e.pointerType !== "mouse" || messages.length === 0) return;
    const over = !!fieldRef.current?.isOver(e.clientX, e.clientY);
    if (over !== overPetal) setOverPetal(over);
  };

  // ── Signing in ──────────────────────────────────────────────────────────

  // Several paths lead here, deliberately, because none of them fires on
  // every keyboard: native implicit submission (the form's submit event),
  // Enter on keydown anywhere on the page, a beforeinput line break in the
  // input, and the Open button. One Enter can set off more than one of them.
  // `busy` is what keeps that to one POST: it's set synchronously, while
  // `state` only changes on the next render, so a second path in the same
  // keypress would still see "idle".
  const busy = useRef(false);

  // Line breaks reach the input as beforeinput on mobile keyboards whose
  // keydown says nothing useful. React's onBeforeInput isn't the native
  // event (no inputType), so listen directly.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const onBeforeInput = (e: InputEvent) => {
      if (e.inputType === "insertLineBreak" || e.inputType === "insertParagraph") submit();
    };
    input.addEventListener("beforeinput", onBeforeInput);
    return () => input.removeEventListener("beforeinput", onBeforeInput);
  });

  async function submit(event?: FormEvent) {
    // Always, even when not sending: the form must never navigate.
    event?.preventDefault();
    // The DOM value, in case input arrived without a React change yet.
    const passphrase = inputRef.current?.value || value;
    if (!passphrase || busy.current || state !== "idle") return;
    busy.current = true;
    setState("checking");
    setNotice("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: passphrase }),
    }).catch(() => null);

    if (response?.ok) {
      inputRef.current?.blur();
      setState("bloom");
      later(
        () => {
          setLeaving(true);
          router.refresh();
        },
        reduced ? 200 : 800,
      );
      return;
    }

    if (response?.status === 401) {
      wither();
      return;
    }

    busy.current = false;
    setState("idle");
    if (!response) setNotice("can’t reach the diary · check the connection");
    else if (response.status === 429) {
      const wait = Number(response.headers.get("Retry-After")) || 60;
      setNotice(`too many tries · wait ${wait}s`);
    } else {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setNotice(body.error ?? `error ${response.status}`);
    }
  }

  // Wrong: the moss dries, then the letters come apart as petals.
  function wither() {
    setState("wither");
    later(() => {
      setState("fall");
      if (!reduced && line && view) {
        const x0 = view.cx - line.width / 2;
        const points = line.chars.map((_, i) => ({
          x: x0 + line.xs[i] + line.widths[i] / 2,
          y: view.cy,
        }));
        fieldRef.current?.burst(points, line.chars.length > 20 ? 1 : 2);
      }
    }, 500);
    later(() => {
      setValue("");
      busy.current = false;
      setState("idle");
      if (!coarse) inputRef.current?.focus({ preventScroll: true });
    }, 1300);
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const hint = (() => {
    if (notice) return notice;
    if (state !== "idle" || note) return "";
    const petals = messages.length > 0 ? " · or catch a petal" : "";
    if (value) return coarse ? "tap go to open" : "press enter to open";
    if (!focused) return `${coarse ? "tap" : "click"} anywhere to write${petals}`;
    return `write your way in${petals}`;
  })();

  const rootStyle = (
    palette ? { background: css(palette.ground), "--hint": css(palette.hint) } : undefined
  ) as CSSProperties | undefined;

  const petalSize = 28;
  const noteStyle = (n: Note): CSSProperties => {
    const at =
      n.stage === "flying"
        ? `translate(${n.from.x}px, ${n.from.y}px) rotate(${n.from.rot}rad) scale(${n.from.size / petalSize})`
        : `translate(${view?.cx ?? 0}px, ${view?.cy ?? 0}px) rotate(0rad) scale(3.2)`;
    return { transform: at };
  };

  return (
    <main
      className={s.root}
      data-ready={ready || undefined}
      data-leaving={leaving || undefined}
      data-over-petal={overPetal || undefined}
      style={rootStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onClick={onClick}
    >
      <canvas ref={canvasRef} className={s.petals} aria-hidden="true" />

      <p className={s.label}>Diary · private</p>

      {palette && view && line && family && (
        <Writing
          line={line}
          x0={view.cx - line.width / 2}
          baseline={view.cy + line.fontSize * 0.28}
          family={family}
          state={state}
          palette={palette}
          caret={focused && state === "idle" && !note}
          width={view.w}
          height={view.h}
        />
      )}

      <form onSubmit={submit}>
        <input
          ref={inputRef}
          className={s.input}
          style={view ? { top: view.cy - 24 } : undefined}
          type="password"
          value={value}
          maxLength={MAX_LENGTH}
          readOnly={state !== "idle"}
          autoComplete="current-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          aria-label="Passphrase"
          onChange={(e) => {
            setValue(e.target.value);
            setNotice("");
          }}
          // The caret is drawn at the end of the line, so keep it there.
          onSelect={(e) => {
            const el = e.currentTarget;
            const end = el.value.length;
            if (el.selectionStart !== end || el.selectionEnd !== end) el.setSelectionRange(end, end);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {/* Always a way in that needs no key at all. */}
        <button
          type="submit"
          className={s.open}
          style={view && line ? { top: view.cy + line.fontSize * 0.75 + 34 } : undefined}
          disabled={!value || state !== "idle"}
          hidden={!!note}
        >
          Open the diary
        </button>
      </form>

      <p
        className={s.hint}
        style={view && line ? { top: view.cy + line.fontSize * 0.75 } : undefined}
        role={notice ? "alert" : undefined}
      >
        {hint}
      </p>

      {note && (
        <div className={s.note} data-stage={note.stage}>
          <div className={s.caught} style={noteStyle(note)} aria-hidden="true">
            <svg viewBox="-50 -50 100 100" width={petalSize} height={petalSize}>
              <path
                d={PETAL_PATH}
                fill={palette ? css(note.from.tint === 0 ? palette.petalA : palette.petalB) : "var(--rose)"}
                stroke={palette ? css(palette.edge, 0.35) : undefined}
                strokeWidth={2}
              />
            </svg>
          </div>
          <div
            className={s.card}
            style={view ? { left: view.cx, top: view.cy } : undefined}
            role="status"
            aria-live="polite"
          >
            {note.stage === "open" || note.stage === "closing" ? note.text : ""}
          </div>
        </div>
      )}
    </main>
  );
}
