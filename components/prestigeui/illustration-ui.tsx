"use client";

import * as React from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Strong ease-out for entrances and state changes. */
export const EASE = [0.16, 1, 0.3, 1] as const;

/** Pixels per second for anything travelling along a wire. */
export const SPEED = 230;

/** The raised card every node is built on: square, hairline, soft shadow. */
export const card =
  "border border-black/[0.08] bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-18px_rgba(15,23,42,0.3)] dark:border-white/[0.15] dark:bg-[color-mix(in_oklab,var(--card)_94%,white)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_14px_30px_-18px_rgba(0,0,0,0.8)]";

const noop = () => () => {};

// The server cannot know the motion preference, so the first client render
// matches it (motion on) and the reduced state applies right after hydration.
export function useHydratedReduce() {
  const reduce = useReducedMotion() ?? false;
  const hydrated = React.useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  return hydrated && reduce;
}

/* ------------------------------------------------------------------ */
/*  Geometry                                                           */
/* ------------------------------------------------------------------ */

export type Pt = readonly [number, number];

export type Route = {
  /** SVG path data, rounded so server and client agree. */
  d: string;
  /** Length in canvas pixels, used to keep travel at a constant speed. */
  len: number;
  from: Pt;
  to: Pt;
};

type Seg =
  | { kind: "L"; to: Pt }
  | { kind: "Q"; c: Pt; to: Pt }
  | { kind: "C"; c1: Pt; c2: Pt; to: Pt };

const r1 = (n: number) => Math.round(n * 10) / 10;
const fmt = (p: Pt) => `${r1(p[0])} ${r1(p[1])}`;
const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

function sampleLength(at: (t: number) => Pt) {
  let len = 0;
  let prev = at(0);
  for (let i = 1; i <= 32; i++) {
    const next = at(i / 32);
    len += dist(prev, next);
    prev = next;
  }
  return len;
}

function build(from: Pt, segs: Seg[]): Route {
  const parts = [`M ${fmt(from)}`];
  const lengths: number[] = [];
  let p = from;
  for (const s of segs) {
    const a = p;
    if (s.kind === "L") {
      parts.push(`L ${fmt(s.to)}`);
      lengths.push(dist(a, s.to));
    } else if (s.kind === "Q") {
      parts.push(`Q ${fmt(s.c)} ${fmt(s.to)}`);
      lengths.push(
        sampleLength((t) => {
          const u = 1 - t;
          return [
            u * u * a[0] + 2 * u * t * s.c[0] + t * t * s.to[0],
            u * u * a[1] + 2 * u * t * s.c[1] + t * t * s.to[1],
          ];
        }),
      );
    } else {
      parts.push(`C ${fmt(s.c1)} ${fmt(s.c2)} ${fmt(s.to)}`);
      lengths.push(
        sampleLength((t) => {
          const u = 1 - t;
          return [
            u * u * u * a[0] + 3 * u * u * t * s.c1[0] + 3 * u * t * t * s.c2[0] + t * t * t * s.to[0],
            u * u * u * a[1] + 3 * u * u * t * s.c1[1] + 3 * u * t * t * s.c2[1] + t * t * t * s.to[1],
          ];
        }),
      );
    }
    p = s.to;
  }
  const len = lengths.reduce((sum, l) => sum + l, 0);
  return { d: parts.join(" "), len: r1(len), from, to: p };
}

/** A route through right-angle points, with every corner rounded. */
export function elbow(points: Pt[], radius = 10): Route {
  const segs: Seg[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    const [prev, cur, next] = [points[i - 1], points[i], points[i + 1]];
    const r = Math.min(radius, dist(prev, cur) / 2, dist(cur, next) / 2);
    const toward = (from: Pt, to: Pt, by: number): Pt => {
      const l = dist(from, to) || 1;
      return [from[0] + ((to[0] - from[0]) / l) * by, from[1] + ((to[1] - from[1]) / l) * by];
    };
    segs.push({ kind: "L", to: toward(cur, prev, r) });
    segs.push({ kind: "Q", c: cur, to: toward(cur, next, r) });
  }
  segs.push({ kind: "L", to: points[points.length - 1] });
  return build(points[0], segs);
}

/** A soft S-curve that leaves and arrives along one axis. */
export function curve(a: Pt, b: Pt, axis: "x" | "y" = "x", bend = 0.55): Route {
  const c1: Pt =
    axis === "x" ? [a[0] + (b[0] - a[0]) * bend, a[1]] : [a[0], a[1] + (b[1] - a[1]) * bend];
  const c2: Pt =
    axis === "x" ? [b[0] - (b[0] - a[0]) * bend, b[1]] : [b[0], b[1] - (b[1] - a[1]) * bend];
  return build(a, [{ kind: "C", c1, c2, to: b }]);
}

/** Seconds a beam takes to run the whole route. */
export const travel = (route: Route, speed = SPEED) => route.len / speed;

/* ------------------------------------------------------------------ */
/*  Clock                                                              */
/* ------------------------------------------------------------------ */

/**
 * A looping clock in seconds. It runs only while the illustration is on
 * screen and not `paused`, and holds at `rest` (the finished state) when
 * motion is reduced or when paused before it has ever played.
 */
export function useLoop(duration: number, rest: number, paused = false) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduce = useHydratedReduce();
  const inView = useInView(ref, { margin: "-10% 0px -10% 0px" });
  const time = useMotionValue(0);
  const played = React.useRef(false);

  React.useEffect(() => {
    if (reduce || (paused && !played.current)) {
      time.set(rest);
      return;
    }
    if (!inView || paused) return;
    played.current = true;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time.set((time.get() + dt) % duration);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, inView, paused, reduce, rest, time]);

  return { ref, time, reduce };
}

const passed = (t: number, marks: readonly number[]) =>
  marks.filter((mark) => t >= mark).length;

/**
 * How many of the given moments the clock has passed, as React state, plus
 * the lap, so lists can key items across loops. Re-renders only on change.
 */
export function useTicks(time: MotionValue<number>, marks: readonly number[]) {
  const [state, setState] = React.useState(() => ({
    n: passed(time.get(), marks),
    lap: 0,
  }));
  useMotionValueEvent(time, "change", (t) => {
    const n = passed(t, marks);
    setState((prev) =>
      prev.n === n ? prev : { n, lap: n < prev.n ? prev.lap + 1 : prev.lap },
    );
  });
  return state;
}

/** 0 to 1 across a window of the clock, for rings and fills. */
export function useProgress(time: MotionValue<number>, start: number, length: number) {
  return useTransform(time, (t) => Math.min(1, Math.max(0, (t - start) / length)));
}

/* ------------------------------------------------------------------ */
/*  Wires and beams                                                    */
/* ------------------------------------------------------------------ */

/**
 * The inked line a beam leaves behind it. It draws in with the beam's head,
 * holds until `fadeAt`, then quietly lets go. Use one per pass.
 */
export function Trace({
  route,
  time,
  start,
  speed = SPEED,
  fadeAt,
}: {
  route: Route;
  time: MotionValue<number>;
  start: number;
  speed?: number;
  fadeAt?: number;
}) {
  const offset = useTransform(
    time,
    (t) => route.len - Math.min(route.len, Math.max(0, (t - start) * speed)),
  );
  const opacity = useTransform(time, (t) =>
    t < start || (fadeAt !== undefined && t >= fadeAt + 0.6)
      ? 0
      : fadeAt === undefined || t < fadeAt
        ? 1
        : 1 - (t - fadeAt) / 0.6,
  );
  return (
    <motion.path
      d={route.d}
      fill="none"
      className="stroke-foreground/40"
      strokeWidth={1.25}
      strokeDasharray={`${route.len} ${route.len + 8}`}
      style={{ strokeDashoffset: offset, opacity }}
    />
  );
}

/**
 * A connector. The quiet hairline is always there; once a beam has passed,
 * the line behind it stays inked until `fadeAt`, then quietly lets go.
 */
export function Wire({
  route,
  time,
  start,
  speed = SPEED,
  fadeAt,
}: {
  route: Route;
  time?: MotionValue<number>;
  /** When the beam leaves. Leave out for a wire that never lights. */
  start?: number;
  speed?: number;
  /** When the inked line fades back to the hairline. */
  fadeAt?: number;
}) {
  const fallback = useMotionValue(0);
  const clock = time ?? fallback;
  const lit = start !== undefined;
  const offset = useTransform(clock, (t) =>
    lit ? route.len - Math.min(route.len, Math.max(0, (t - start) * speed)) : route.len,
  );
  const opacity = useTransform(clock, (t) =>
    fadeAt === undefined || t < fadeAt ? 1 : Math.max(0, 1 - (t - fadeAt) / 0.6),
  );
  return (
    <g fill="none">
      <path d={route.d} className="stroke-foreground/[0.16] dark:stroke-foreground/[0.26]" strokeWidth={1} />
      {lit ? (
        <motion.path
          d={route.d}
          className="stroke-foreground/40"
          strokeWidth={1.25}
          strokeDasharray={`${route.len} ${route.len + 8}`}
          style={{ strokeDashoffset: offset, opacity }}
        />
      ) : null}
    </g>
  );
}

// A beam is a few stacked dashes of falling strength: a bright head and a
// tail that thins out behind it. Each dash ends at the head.
const LAYERS = [
  { len: 84, width: 2, opacity: 0.1 },
  { len: 52, width: 2, opacity: 0.22 },
  { len: 28, width: 2.25, opacity: 0.5 },
  { len: 14, width: 2.5, opacity: 1 },
] as const;

const TAIL = LAYERS[0].len;

function BeamLayer({
  route,
  head,
  len,
  width,
  opacity,
}: {
  route: Route;
  head: MotionValue<number>;
  len: number;
  width: number;
  opacity: number;
}) {
  // Held just off the route before it leaves and after it lands, so the
  // repeating dash pattern never shows a second pulse.
  const offset = useTransform(
    head,
    (d) => len - Math.min(route.len + len + 2, Math.max(-2, d)),
  );
  return (
    <motion.path
      d={route.d}
      stroke="currentColor"
      strokeWidth={width}
      strokeOpacity={opacity}
      strokeLinecap="round"
      strokeDasharray={`${len} ${route.len + 200}`}
      style={{ strokeDashoffset: offset }}
    />
  );
}

/**
 * The drawing of one beam, its head at `head` pixels along the route.
 * `tail` scales the trail, for short wires that carry a stream.
 */
export function BeamPath({
  route,
  head,
  opacity,
  tail = 1,
  className,
}: {
  route: Route;
  head: MotionValue<number>;
  opacity?: MotionValue<number>;
  tail?: number;
  className?: string;
}) {
  return (
    <motion.g fill="none" className={cn("text-foreground", className)} style={{ opacity }}>
      {LAYERS.map((layer) => (
        <BeamLayer
          key={layer.len}
          route={route}
          head={head}
          len={Math.max(layer === LAYERS[3] ? 10 : 6, Math.round(layer.len * tail))}
          width={layer.width}
          opacity={layer.opacity}
        />
      ))}
    </motion.g>
  );
}

/** A pulse that runs the route once at constant speed, leaving at `start`. */
export function Beam({
  route,
  time,
  start,
  speed = SPEED,
  className,
}: {
  route: Route;
  time: MotionValue<number>;
  start: number;
  speed?: number;
  className?: string;
}) {
  const head = useTransform(time, (t) =>
    Math.min(route.len + TAIL + 2, Math.max(-2, (t - start) * speed)),
  );
  return <BeamPath route={route} head={head} className={className} />;
}

/** Where a wire plugs into a card. Inks in once `on`. */
export function Port({ at, on = false }: { at: Pt; on?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute z-10 size-[7px] -translate-x-1/2 -translate-y-1/2 border bg-card transition-colors duration-300",
        on ? "border-foreground bg-foreground" : "border-foreground/30 dark:border-foreground/50",
      )}
      style={{ left: at[0], top: at[1] }}
    />
  );
}

/**
 * A number whose changed digits roll like an odometer: up when it rises.
 * Unchanged digits hold still, and tabular figures keep the width steady.
 */
export function Odometer({ value, className }: { value: number; className?: string }) {
  const chars = value.toLocaleString("en-US").split("");
  return (
    <span className={cn("inline-flex tabular-nums", className)}>
      <span className="sr-only">{value.toLocaleString("en-US")}</span>
      {chars.map((char, i) => (
        // Keyed by place from the right, so a new leading digit doesn't
        // shift the rest.
        <span key={chars.length - i} aria-hidden className="relative inline-grid overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={char}
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-100%", opacity: 0 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="col-start-1 row-start-1"
            >
              {char}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

/**
 * A square traces its own outline while work happens (`progress` 0 to 1);
 * the moment it is done it gives way to a check.
 */
export function StatusMark({
  working,
  done,
  progress,
}: {
  working: boolean;
  done: boolean;
  progress: MotionValue<number>;
}) {
  return (
    <span className="relative grid size-4 shrink-0 place-items-center">
      <svg viewBox="0 0 16 16" className="absolute inset-0 size-4" fill="none" aria-hidden>
        <motion.g
          initial={false}
          animate={{ opacity: working ? 1 : 0 }}
          transition={{ duration: working ? 0.2 : 0.15 }}
        >
          <rect x="2.5" y="2.5" width="11" height="11" className="stroke-foreground/20" strokeWidth={1.25} />
          <motion.rect
            x="2.5"
            y="2.5"
            width="11"
            height="11"
            className="stroke-foreground"
            strokeWidth={1.5}
            style={{ pathLength: progress }}
          />
        </motion.g>
      </svg>
      <motion.span
        className="absolute inset-0 grid place-items-center text-foreground"
        initial={false}
        animate={{ opacity: done ? 1 : 0, scale: done ? 1 : 0.6 }}
        transition={done ? { type: "spring", stiffness: 420, damping: 26 } : { duration: 0.3, ease: EASE }}
      >
        <Check className="size-4" strokeWidth={2.5} />
      </motion.span>
    </span>
  );
}

/**
 * One even ring out of a round tile the moment something lands on it. Give
 * each landing its own `id`; `null` shows nothing.
 */
export function Ripple({ id }: { id: string | null }) {
  return (
    <AnimatePresence>
      {id ? (
        <motion.span
          key={id}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full outline outline-[1.5px] outline-foreground/30 dark:outline-white/40"
          initial={{ outlineOffset: 0, opacity: 0.9 }}
          animate={{ outlineOffset: 16, opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
        />
      ) : null}
    </AnimatePresence>
  );
}

/**
 * A ring that traces around a round tile of radius `r` while it works, then
 * settles to a quiet complete state once `done`.
 */
export function WorkRing({
  r,
  progress,
  visible,
  done,
}: {
  r: number;
  progress: MotionValue<number>;
  visible: boolean;
  done: boolean;
}) {
  const ring = r + 7;
  const size = ring * 2 + 4;
  return (
    <motion.svg
      aria-hidden
      className="absolute"
      width={size}
      height={size}
      style={{ left: r - size / 2, top: r - size / 2 }}
      initial={false}
      animate={{ opacity: visible ? (done ? 0.3 : 1) : 0 }}
      transition={{ duration: done ? 0.6 : 0.3, ease: EASE }}
    >
      <circle cx={size / 2} cy={size / 2} r={ring} fill="none" className="stroke-foreground/10" strokeWidth={1.5} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={ring}
        fill="none"
        className="stroke-foreground"
        strokeWidth={1.5}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ pathLength: progress }}
      />
    </motion.svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Streaming text                                                     */
/* ------------------------------------------------------------------ */

/**
 * When each word of `text` appears, starting at `start`. Longer words take
 * longer, and the pace slows after commas and full stops, like a person.
 */
export function wordTimes(text: string, start: number, rate = 1) {
  const words = text.split(/\s+/).filter(Boolean);
  const times: number[] = [];
  let clock = start;
  for (const word of words) {
    times.push(clock);
    const pause = /[.!?]$/.test(word) ? 0.2 : /[,;:]$/.test(word) ? 0.11 : 0;
    clock += (0.045 + word.length * 0.011 + pause) * rate;
  }
  return { words, times, end: clock };
}

function Word({
  word,
  at,
  time,
  fadeAt,
}: {
  word: string;
  at: number;
  time: MotionValue<number>;
  fadeAt?: number;
}) {
  const shown = (t: number) => {
    const appear = Math.min(1, Math.max(0, (t - at) / 0.5));
    if (fadeAt === undefined || t < fadeAt) return appear;
    return Math.min(appear, Math.max(0, 1 - (t - fadeAt) / 0.4));
  };
  const opacity = useTransform(time, shown);
  const y = useTransform(time, (t) => (1 - Math.min(1, Math.max(0, (t - at) / 0.5))) * 3);
  // "[1]" becomes a citation chip pointing back at a source.
  const cite = /^\[(\d+)\]([.,]?)$/.exec(word);
  return (
    <motion.span className="inline-block" style={{ opacity, y }}>
      {cite ? (
        <>
          <span className="inline-grid h-[15px] min-w-[15px] translate-y-[-1px] place-items-center border border-foreground/15 bg-foreground/[0.04] px-1 align-middle text-[10px] leading-none font-medium text-foreground/70 tabular-nums">
            {cite[1]}
          </span>
          {cite[2]}
        </>
      ) : (
        word
      )}
    </motion.span>
  );
}

/**
 * Text that streams in word by word from the clock. Every word is laid out
 * from the start (invisible), so nothing reflows as it writes.
 */
export function Words({
  text,
  time,
  start,
  rate,
  fadeAt,
}: {
  text: string;
  time: MotionValue<number>;
  start: number;
  rate?: number;
  fadeAt?: number;
}) {
  const { words, times } = wordTimes(text, start, rate);
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((word, i) => (
          <React.Fragment key={i}>
            {i > 0 ? " " : null}
            <Word word={word} at={times[i]} time={time} fadeAt={fadeAt} />
          </React.Fragment>
        ))}
      </span>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Canvas                                                             */
/* ------------------------------------------------------------------ */

export type Size = { w: number; h: number };

/**
 * A fixed coordinate space that scales down to fit its container, so the
 * SVG wires and the HTML cards always line up. Below `compactBelow` pixels
 * it switches to the compact layout instead of shrinking the wide one.
 */
export function Diagram({
  wide,
  compact,
  compactBelow = 600,
  interactive = false,
  className,
  children,
}: {
  /** Leave the diagram in the accessibility tree because it holds controls. */
  interactive?: boolean;
  wide: Size;
  compact?: Size;
  compactBelow?: number;
  className?: string;
  children: (layout: { compact: boolean; size: Size }) => React.ReactNode;
}) {
  const box = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.round(entry.contentRect.width)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isCompact = Boolean(compact) && width > 0 && width < compactBelow;
  const size = isCompact && compact ? compact : wide;
  const scale = width ? Math.min(1, width / size.w) : 1;

  return (
    <div
      ref={box}
      aria-hidden={interactive ? undefined : true}
      className={cn("relative w-full", !width && "invisible", className)}
      style={{ height: size.h * scale }}
    >
      <div
        className="absolute top-0 left-1/2 origin-top"
        style={{
          width: size.w,
          height: size.h,
          transform: `translateX(-50%) scale(${scale})`,
        }}
      >
        {children({ compact: isCompact, size })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Brand marks                                                        */
/* ------------------------------------------------------------------ */

// Paths from Simple Icons. Marks that are black in their brand use ink, so
// they survive dark mode.
export const BRANDS = {
  stripe: "M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z",
  github: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
  hubspot: "M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z",
  linear: "M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z",
  intercom: "M21 0H3C1.343 0 0 1.343 0 3v18c0 1.658 1.343 3 3 3h18c1.658 0 3-1.342 3-3V3c0-1.657-1.342-3-3-3zm-5.801 4.399c0-.44.36-.8.802-.8.44 0 .8.36.8.8v10.688c0 .442-.36.801-.8.801-.443 0-.802-.359-.802-.801V4.399zM11.2 3.994c0-.44.357-.799.8-.799s.8.359.8.799v11.602c0 .44-.357.8-.8.8s-.8-.36-.8-.8V3.994zm-4 .405c0-.44.359-.8.799-.8.443 0 .802.36.802.8v10.688c0 .442-.36.801-.802.801-.44 0-.799-.359-.799-.801V4.399zM3.199 6c0-.442.36-.8.802-.8.44 0 .799.358.799.8v7.195c0 .441-.359.8-.799.8-.443 0-.802-.36-.802-.8V6zM20.52 18.202c-.123.105-3.086 2.593-8.52 2.593-5.433 0-8.397-2.486-8.521-2.593-.335-.288-.375-.792-.086-1.128.285-.334.79-.375 1.125-.09.047.041 2.693 2.211 7.481 2.211 4.848 0 7.456-2.186 7.479-2.207.334-.289.839-.25 1.128.086.289.336.25.84-.086 1.128zm.281-5.007c0 .441-.36.8-.801.8-.441 0-.801-.36-.801-.8V6c0-.442.361-.8.801-.8.441 0 .801.357.801.8v7.195z",
  notion: "M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z",
  slack: "M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z",
  postgresql: "M23.5594 14.7228a.5269.5269 0 0 0-.0563-.1191c-.139-.2632-.4768-.3418-1.0074-.2321-1.6533.3411-2.2935.1312-2.5256-.0191 1.342-2.0482 2.445-4.522 3.0411-6.8297.2714-1.0507.7982-3.5237.1222-4.7316a1.5641 1.5641 0 0 0-.1509-.235C21.6931.9086 19.8007.0248 17.5099.0005c-1.4947-.0158-2.7705.3461-3.1161.4794a9.449 9.449 0 0 0-.5159-.0816 8.044 8.044 0 0 0-1.3114-.1278c-1.1822-.0184-2.2038.2642-3.0498.8406-.8573-.3211-4.7888-1.645-7.2219.0788C.9359 2.1526.3086 3.8733.4302 6.3043c.0409.818.5069 3.334 1.2423 5.7436.4598 1.5065.9387 2.7019 1.4334 3.582.553.9942 1.1259 1.5933 1.7143 1.7895.4474.1491 1.1327.1441 1.8581-.7279.8012-.9635 1.5903-1.8258 1.9446-2.2069.4351.2355.9064.3625 1.39.3772a.0569.0569 0 0 0 .0004.0041 11.0312 11.0312 0 0 0-.2472.3054c-.3389.4302-.4094.5197-1.5002.7443-.3102.064-1.1344.2339-1.1464.8115-.0025.1224.0329.2309.0919.3268.2269.4231.9216.6097 1.015.6331 1.3345.3335 2.5044.092 3.3714-.6787-.017 2.231.0775 4.4174.3454 5.0874.2212.5529.7618 1.9045 2.4692 1.9043.2505 0 .5263-.0291.8296-.0941 1.7819-.3821 2.5557-1.1696 2.855-2.9059.1503-.8707.4016-2.8753.5388-4.1012.0169-.0703.0357-.1207.057-.1362.0007-.0005.0697-.0471.4272.0307a.3673.3673 0 0 0 .0443.0068l.2539.0223.0149.001c.8468.0384 1.9114-.1426 2.5312-.4308.6438-.2988 1.8057-1.0323 1.5951-1.6698zM2.371 11.8765c-.7435-2.4358-1.1779-4.8851-1.2123-5.5719-.1086-2.1714.4171-3.6829 1.5623-4.4927 1.8367-1.2986 4.8398-.5408 6.108-.13-.0032.0032-.0066.0061-.0098.0094-2.0238 2.044-1.9758 5.536-1.9708 5.7495-.0002.0823.0066.1989.0162.3593.0348.5873.0996 1.6804-.0735 2.9184-.1609 1.1504.1937 2.2764.9728 3.0892.0806.0841.1648.1631.2518.2374-.3468.3714-1.1004 1.1926-1.9025 2.1576-.5677.6825-.9597.5517-1.0886.5087-.3919-.1307-.813-.5871-1.2381-1.3223-.4796-.839-.9635-2.0317-1.4155-3.5126zm6.0072 5.0871c-.1711-.0428-.3271-.1132-.4322-.1772.0889-.0394.2374-.0902.4833-.1409 1.2833-.2641 1.4815-.4506 1.9143-1.0002.0992-.126.2116-.2687.3673-.4426a.3549.3549 0 0 0 .0737-.1298c.1708-.1513.2724-.1099.4369-.0417.156.0646.3078.26.3695.4752.0291.1016.0619.2945-.0452.4444-.9043 1.2658-2.2216 1.2494-3.1676 1.0128zm2.094-3.988-.0525.141c-.133.3566-.2567.6881-.3334 1.003-.6674-.0021-1.3168-.2872-1.8105-.8024-.6279-.6551-.9131-1.5664-.7825-2.5004.1828-1.3079.1153-2.4468.079-3.0586-.005-.0857-.0095-.1607-.0122-.2199.2957-.2621 1.6659-.9962 2.6429-.7724.4459.1022.7176.4057.8305.928.5846 2.7038.0774 3.8307-.3302 4.7363-.084.1866-.1633.3629-.2311.5454zm7.3637 4.5725c-.0169.1768-.0358.376-.0618.5959l-.146.4383a.3547.3547 0 0 0-.0182.1077c-.0059.4747-.054.6489-.115.8693-.0634.2292-.1353.4891-.1794 1.0575-.11 1.4143-.8782 2.2267-2.4172 2.5565-1.5155.3251-1.7843-.4968-2.0212-1.2217a6.5824 6.5824 0 0 0-.0769-.2266c-.2154-.5858-.1911-1.4119-.1574-2.5551.0165-.5612-.0249-1.9013-.3302-2.6462.0044-.2932.0106-.5909.019-.8918a.3529.3529 0 0 0-.0153-.1126 1.4927 1.4927 0 0 0-.0439-.208c-.1226-.4283-.4213-.7866-.7797-.9351-.1424-.059-.4038-.1672-.7178-.0869.067-.276.1831-.5875.309-.9249l.0529-.142c.0595-.16.134-.3257.213-.5012.4265-.9476 1.0106-2.2453.3766-5.1772-.2374-1.0981-1.0304-1.6343-2.2324-1.5098-.7207.0746-1.3799.3654-1.7088.5321a5.6716 5.6716 0 0 0-.1958.1041c.0918-1.1064.4386-3.1741 1.7357-4.4823a4.0306 4.0306 0 0 1 .3033-.276.3532.3532 0 0 0 .1447-.0644c.7524-.5706 1.6945-.8506 2.802-.8325.4091.0067.8017.0339 1.1742.081 1.939.3544 3.2439 1.4468 4.0359 2.3827.8143.9623 1.2552 1.9315 1.4312 2.4543-1.3232-.1346-2.2234.1268-2.6797.779-.9926 1.4189.543 4.1729 1.2811 5.4964.1353.2426.2522.4522.2889.5413.2403.5825.5515.9713.7787 1.2552.0696.087.1372.1714.1885.245-.4008.1155-1.1208.3825-1.0552 1.717-.0123.1563-.0423.4469-.0834.8148-.0461.2077-.0702.4603-.0994.7662zm.8905-1.6211c-.0405-.8316.2691-.9185.5967-1.0105a2.8566 2.8566 0 0 0 .135-.0406 1.202 1.202 0 0 0 .1342.103c.5703.3765 1.5823.4213 3.0068.1344-.2016.1769-.5189.3994-.9533.6011-.4098.1903-1.0957.333-1.7473.3636-.7197.0336-1.0859-.0807-1.1721-.151zm.5695-9.2712c-.0059.3508-.0542.6692-.1054 1.0017-.055.3576-.112.7274-.1264 1.1762-.0142.4368.0404.8909.0932 1.3301.1066.887.216 1.8003-.2075 2.7014a3.5272 3.5272 0 0 1-.1876-.3856c-.0527-.1276-.1669-.3326-.3251-.6162-.6156-1.1041-2.0574-3.6896-1.3193-4.7446.3795-.5427 1.3408-.5661 2.1781-.463zm.2284 7.0137a12.3762 12.3762 0 0 0-.0853-.1074l-.0355-.0444c.7262-1.1995.5842-2.3862.4578-3.4385-.0519-.4318-.1009-.8396-.0885-1.2226.0129-.4061.0666-.7543.1185-1.0911.0639-.415.1288-.8443.1109-1.3505.0134-.0531.0188-.1158.0118-.1902-.0457-.4855-.5999-1.938-1.7294-3.253-.6076-.7073-1.4896-1.4972-2.6889-2.0395.5251-.1066 1.2328-.2035 2.0244-.1859 2.0515.0456 3.6746.8135 4.8242 2.2824a.908.908 0 0 1 .0667.1002c.7231 1.3556-.2762 6.2751-2.9867 10.5405zm-8.8166-6.1162c-.025.1794-.3089.4225-.6211.4225a.5821.5821 0 0 1-.0809-.0056c-.1873-.026-.3765-.144-.5059-.3156-.0458-.0605-.1203-.178-.1055-.2844.0055-.0401.0261-.0985.0925-.1488.1182-.0894.3518-.1226.6096-.0867.3163.0441.6426.1938.6113.4186zm7.9305-.4114c.0111.0792-.049.201-.1531.3102-.0683.0717-.212.1961-.4079.2232a.5456.5456 0 0 1-.075.0052c-.2935 0-.5414-.2344-.5607-.3717-.024-.1765.2641-.3106.5611-.352.297-.0414.6111.0088.6356.1851z",
  figma: "M15.852 8.981h-4.588V0h4.588c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.491-4.49 4.491zM12.735 7.51h3.117c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019h-3.117V7.51zm0 1.471H8.148c-2.476 0-4.49-2.014-4.49-4.49S5.672 0 8.148 0h4.588v8.981zm-4.587-7.51c-1.665 0-3.019 1.355-3.019 3.019s1.354 3.02 3.019 3.02h3.117V1.471H8.148zm4.587 15.019H8.148c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h4.588v8.98zM8.148 8.981c-1.665 0-3.019 1.355-3.019 3.019s1.355 3.019 3.019 3.019h3.117V8.981H8.148zM8.172 24c-2.489 0-4.515-2.014-4.515-4.49s2.014-4.49 4.49-4.49h4.588v4.441c0 2.503-2.047 4.539-4.563 4.539zm-.024-7.51a3.023 3.023 0 0 0-3.019 3.019c0 1.665 1.365 3.019 3.044 3.019 1.705 0 3.093-1.376 3.093-3.068v-2.97H8.148zm7.704 0h-.098c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h.098c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.49-4.49 4.49zm-.097-7.509c-1.665 0-3.019 1.355-3.019 3.019s1.355 3.019 3.019 3.019h.098c1.665 0 3.019-1.355 3.019-3.019s-1.355-3.019-3.019-3.019h-.098z",
  googledrive: "M12.01 1.485c-2.082 0-3.754.02-3.743.047.01.02 1.708 3.001 3.774 6.62l3.76 6.574h3.76c2.081 0 3.753-.02 3.742-.047-.005-.02-1.708-3.001-3.775-6.62l-3.76-6.574zm-4.76 1.73a789.828 789.861 0 0 0-3.63 6.319L0 15.868l1.89 3.298 1.885 3.297 3.62-6.335 3.618-6.33-1.88-3.287C8.1 4.704 7.255 3.22 7.25 3.214zm2.259 12.653-.203.348c-.114.198-.96 1.672-1.88 3.287a423.93 423.948 0 0 1-1.698 2.97c-.01.026 3.24.042 7.222.042h7.244l1.796-3.157c.992-1.734 1.85-3.23 1.906-3.323l.104-.167h-7.249z",
  claude: "m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z",
  cursor: "M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23",
  vercel: "m12 1.608 12 20.784H0Z",
  supabase: "M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C-.33 13.427.65 15.455 2.409 15.455h9.579l.113 7.51c.014.985 1.259 1.408 1.873.636l9.262-11.653c1.093-1.375.113-3.403-1.645-3.403h-9.642z",
  cloudflare: "M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.3154-.2246-.3164-.6045-.499-1.0615-.5205l-8.6592-.1123a.1559.1559 0 0 1-.1333-.0713c-.0283-.042-.0351-.0986-.021-.1553.0278-.084.1123-.1484.2036-.1562l8.7359-.1123c1.0351-.0489 2.1601-.8868 2.5537-1.9136l.499-1.3013c.0215-.0561.0293-.1128.0147-.168-.5625-2.5463-2.835-4.4453-5.5499-4.4453-2.5039 0-4.6284 1.6177-5.3876 3.8614-.4927-.3658-1.1187-.5625-1.794-.499-1.2026.119-2.1665 1.083-2.2861 2.2856-.0283.31-.0069.6128.0635.894C1.5683 13.171 0 14.7754 0 16.752c0 .1748.0142.3515.0352.5273.0141.083.0844.1475.1689.1475h15.9814c.0909 0 .1758-.0645.2032-.1553l.12-.4268zm2.7568-5.5634c-.0771 0-.1611 0-.2383.0112-.0566 0-.1054.0415-.127.0976l-.3378 1.1744c-.1475.5068-.0918.9707.1543 1.3164.2256.3164.6055.498 1.0625.5195l1.8437.1133c.0557 0 .1055.0263.1329.0703.0283.043.0351.1074.0214.1562-.0283.084-.1132.1485-.204.1553l-1.921.1123c-1.041.0488-2.1582.8867-2.5527 1.914l-.1406.3585c-.0283.0713.0215.1416.0986.1416h6.5977c.0771 0 .1474-.0489.169-.126.1122-.4082.1757-.837.1757-1.2803 0-2.6025-2.125-4.727-4.7344-4.727",
  nextdotjs: "M18.665 21.978C16.758 23.255 14.465 24 12 24 5.377 24 0 18.623 0 12S5.377 0 12 0s12 5.377 12 12c0 3.583-1.574 6.801-4.067 9.001L9.219 7.2H7.2v9.596h1.615V9.251l9.85 12.727Zm-3.332-8.533 1.6 2.061V7.2h-1.6v6.245Z",
  astro: "M8.358 20.162c-1.186-1.07-1.532-3.316-1.038-4.944.856 1.026 2.043 1.352 3.272 1.535 1.897.283 3.76.177 5.522-.678.202-.098.388-.229.608-.36.166.473.209.95.151 1.437-.14 1.185-.738 2.1-1.688 2.794-.38.277-.782.525-1.175.787-1.205.804-1.531 1.747-1.078 3.119l.044.148a3.158 3.158 0 0 1-1.407-1.188 3.31 3.31 0 0 1-.544-1.815c-.004-.32-.004-.642-.048-.958-.106-.769-.472-1.113-1.161-1.133-.707-.02-1.267.411-1.415 1.09-.012.053-.028.104-.045.165h.002zm-5.961-4.445s3.24-1.575 6.49-1.575l2.451-7.565c.092-.366.36-.614.662-.614.302 0 .57.248.662.614l2.45 7.565c3.85 0 6.491 1.575 6.491 1.575L16.088.727C15.93.285 15.663 0 15.303 0H8.697c-.36 0-.615.285-.784.727l-5.516 14.99z",
  svelte: "M10.354 21.125a4.44 4.44 0 0 1-4.765-1.767 4.109 4.109 0 0 1-.703-3.107 3.898 3.898 0 0 1 .134-.522l.105-.321.287.21a7.21 7.21 0 0 0 2.186 1.092l.208.063-.02.208a1.253 1.253 0 0 0 .226.83 1.337 1.337 0 0 0 1.435.533 1.231 1.231 0 0 0 .343-.15l5.59-3.562a1.164 1.164 0 0 0 .524-.778 1.242 1.242 0 0 0-.211-.937 1.338 1.338 0 0 0-1.435-.533 1.23 1.23 0 0 0-.343.15l-2.133 1.36a4.078 4.078 0 0 1-1.135.499 4.44 4.44 0 0 1-4.765-1.766 4.108 4.108 0 0 1-.702-3.108 3.855 3.855 0 0 1 1.742-2.582l5.589-3.563a4.072 4.072 0 0 1 1.135-.499 4.44 4.44 0 0 1 4.765 1.767 4.109 4.109 0 0 1 .703 3.107 3.943 3.943 0 0 1-.134.522l-.105.321-.286-.21a7.204 7.204 0 0 0-2.187-1.093l-.208-.063.02-.207a1.255 1.255 0 0 0-.226-.831 1.337 1.337 0 0 0-1.435-.532 1.231 1.231 0 0 0-.343.15L8.62 9.368a1.162 1.162 0 0 0-.524.778 1.24 1.24 0 0 0 .211.937 1.338 1.338 0 0 0 1.435.533 1.235 1.235 0 0 0 .344-.151l2.132-1.36a4.067 4.067 0 0 1 1.135-.498 4.44 4.44 0 0 1 4.765 1.766 4.108 4.108 0 0 1 .702 3.108 3.857 3.857 0 0 1-1.742 2.583l-5.589 3.562a4.072 4.072 0 0 1-1.135.499m10.358-17.95C18.484-.015 14.082-.96 10.9 1.068L5.31 4.63a6.412 6.412 0 0 0-2.896 4.295 6.753 6.753 0 0 0 .666 4.336 6.43 6.43 0 0 0-.96 2.396 6.833 6.833 0 0 0 1.168 5.167c2.229 3.19 6.63 4.135 9.812 2.108l5.59-3.562a6.41 6.41 0 0 0 2.896-4.295 6.756 6.756 0 0 0-.665-4.336 6.429 6.429 0 0 0 .958-2.396 6.831 6.831 0 0 0-1.167-5.168Z",
  nuxt: "M13.4642 19.8295h8.9218c.2834 0 .5618-.0723.8072-.2098a1.5899 1.5899 0 0 0 .5908-.5732 1.5293 1.5293 0 0 0 .216-.783 1.529 1.529 0 0 0-.2167-.7828L17.7916 7.4142a1.5904 1.5904 0 0 0-.5907-.573 1.6524 1.6524 0 0 0-.807-.2099c-.2833 0-.5616.0724-.807.2098a1.5904 1.5904 0 0 0-.5907.5731L13.4642 9.99l-2.9954-5.0366a1.5913 1.5913 0 0 0-.591-.573 1.6533 1.6533 0 0 0-.8071-.2098c-.2834 0-.5617.0723-.8072.2097a1.5913 1.5913 0 0 0-.591.573L.2168 17.4808A1.5292 1.5292 0 0 0 0 18.2635c-.0001.2749.0744.545.216.783a1.59 1.59 0 0 0 .5908.5732c.2454.1375.5238.2098.8072.2098h5.6003c2.219 0 3.8554-.9454 4.9813-2.7899l2.7337-4.5922L16.3935 9.99l4.3944 7.382h-5.8586ZM7.123 17.3694l-3.9083-.0009 5.8586-9.8421 2.9232 4.921-1.9572 3.2892c-.7478 1.1967-1.5972 1.6328-2.9163 1.6328z",
  remix: "M21.511 18.508c.216 2.773.216 4.073.216 5.492H15.31c0-.309.006-.592.011-.878.018-.892.036-1.821-.109-3.698-.19-2.747-1.374-3.358-3.55-3.358H1.574v-5h10.396c2.748 0 4.122-.835 4.122-3.049 0-1.946-1.374-3.125-4.122-3.125H1.573V0h11.541c6.221 0 9.313 2.938 9.313 7.632 0 3.511-2.176 5.8-5.114 6.182 2.48.497 3.93 1.909 4.198 4.694ZM1.573 24v-3.727h6.784c1.133 0 1.379.84 1.379 1.342V24Z",
  openai: "M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z",
  googlegemini: "M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81",
  meta: "M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z",
  snowflake: "M24 3.459c0 .646-.418 1.18-1.141 1.18-.723 0-1.142-.534-1.142-1.18 0-.647.419-1.18 1.142-1.18.723 0 1.141.533 1.141 1.18zm-.228 0c0-.533-.38-.951-.913-.951s-.913.38-.913.95c0 .533.38.952.913.952.57 0 .913-.419.913-.951zm-1.37-.533h.495c.266 0 .456.152.456.38 0 .153-.076.229-.19.305l.19.266v.038h-.266l-.19-.266h-.229v.266h-.266zm.495.228h-.229v.267h.229c.114 0 .152-.038.152-.114.038-.077-.038-.153-.152-.153zM7.602 12.4c.038-.151.076-.304.076-.456 0-.114-.038-.228-.038-.342-.114-.343-.304-.647-.646-.838l-4.87-2.777c-.685-.38-1.56-.152-1.94.533-.381.685-.153 1.56.532 1.94l2.701 1.56-2.701 1.56c-.685.38-.913 1.256-.533 1.94.38.685 1.256.914 1.94.533l4.832-2.777c.343-.267.571-.533.647-.876zm1.332 2.626c-.266-.038-.57.038-.837.19l-4.832 2.777c-.685.38-.913 1.256-.532 1.94.38.686 1.255.914 1.94.533l2.701-1.56v3.12c0 .8.647 1.408 1.446 1.408.799 0 1.407-.647 1.407-1.408v-5.592c0-.761-.57-1.37-1.293-1.408zm4.946-6.088c.266.038.57-.038.837-.19l4.832-2.777c.685-.38.913-1.256.532-1.94-.38-.686-1.255-.914-1.94-.533l-2.701 1.56V1.975c0-.799-.647-1.408-1.446-1.408-.799 0-1.446.609-1.446 1.408V7.53c0 .76.609 1.37 1.332 1.407zM3.265 5.97l4.832 2.777c.266.152.533.19.837.19.723-.038 1.331-.684 1.331-1.407V1.975c0-.799-.646-1.408-1.407-1.408-.799 0-1.446.647-1.446 1.408v3.12l-2.701-1.56c-.685-.38-1.56-.152-1.94.533-.419.646-.19 1.521.494 1.902zm9.093 6.011a.412.412 0 00-.114-.266l-.57-.571a.346.346 0 00-.267-.114.412.412 0 00-.266.114l-.571.57a.411.411 0 00-.114.267c0 .076.038.19.114.267l.57.57a.345.345 0 00.267.114c.076 0 .19-.038.266-.114l.571-.57a.412.412 0 00.114-.267zm1.598.533L11.94 14.53c-.039.038-.153.114-.229.114h-.608a.411.411 0 01-.267-.114L8.82 12.514a.408.408 0 01-.076-.229v-.608c0-.076.038-.19.114-.267l2.016-2.016a.41.41 0 01.267-.114h.608a.41.41 0 01.267.114l2.016 2.016a.347.347 0 01.114.267v.608c-.076.077-.114.19-.19.229zm5.593 5.44l-4.832-2.777c-.266-.152-.57-.19-.837-.152-.723.038-1.332.684-1.332 1.408v5.554c0 .8.647 1.408 1.408 1.408.799 0 1.446-.647 1.446-1.408v-3.12l2.7 1.56c.686.38 1.561.152 1.941-.533.419-.646.19-1.521-.494-1.94zm2.549-7.533l-2.701 1.56 2.7 1.56c.686.38.914 1.256.533 1.94-.38.685-1.255.913-1.94.533l-4.832-2.778a1.644 1.644 0 01-.647-.798c-.037-.153-.076-.305-.076-.457 0-.114.039-.228.039-.342.114-.343.342-.647.646-.837l4.832-2.778c.685-.38 1.56-.152 1.94.533.457.609.19 1.484-.494 1.864",
  shopify: "M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-1.275-1.274-1.439-1.411c-.045-.037-.075-.057-.121-.074l-.914 21.104h.023zM11.71 11.305s-.81-.424-1.774-.424c-1.447 0-1.504.906-1.504 1.141 0 1.232 3.24 1.715 3.24 4.629 0 2.295-1.44 3.76-3.406 3.76-2.354 0-3.54-1.465-3.54-1.465l.646-2.086s1.245 1.066 2.28 1.066c.675 0 .975-.545.975-.932 0-1.619-2.654-1.694-2.654-4.359-.034-2.237 1.571-4.416 4.827-4.416 1.257 0 1.875.361 1.875.361l-.945 2.715-.02.01zM11.17.83c.136 0 .271.038.405.135-.984.465-2.064 1.639-2.508 3.992-.656.213-1.293.405-1.889.578C7.697 3.75 8.951.84 11.17.84V.83zm1.235 2.949v.135c-.754.232-1.583.484-2.394.736.466-1.777 1.333-2.645 2.085-2.971.193.501.309 1.176.309 2.1zm.539-2.234c.694.074 1.141.867 1.429 1.755-.349.114-.735.231-1.158.366v-.252c0-.752-.096-1.371-.271-1.871v.002zm2.992 1.289c-.02 0-.06.021-.078.021s-.289.075-.714.21c-.423-1.233-1.176-2.37-2.508-2.37h-.115C12.135.209 11.669 0 11.265 0 8.159 0 6.675 3.877 6.21 5.846c-1.194.365-2.063.636-2.16.674-.675.213-.694.232-.772.87-.075.462-1.83 14.063-1.83 14.063L15.009 24l.927-21.166z",
  clerk: "m21.47 20.829-2.881-2.881a.572.572 0 0 0-.7-.084 6.854 6.854 0 0 1-7.081 0 .576.576 0 0 0-.7.084l-2.881 2.881a.576.576 0 0 0-.103.69.57.57 0 0 0 .166.186 12 12 0 0 0 14.113 0 .58.58 0 0 0 .239-.423.576.576 0 0 0-.172-.453Zm.002-17.668-2.88 2.88a.569.569 0 0 1-.701.084A6.857 6.857 0 0 0 8.724 8.08a6.862 6.862 0 0 0-1.222 3.692 6.86 6.86 0 0 0 .978 3.764.573.573 0 0 1-.083.699l-2.881 2.88a.567.567 0 0 1-.864-.063A11.993 11.993 0 0 1 6.771 2.7a11.99 11.99 0 0 1 14.637-.405.566.566 0 0 1 .232.418.57.57 0 0 1-.168.448Zm-7.118 12.261a3.427 3.427 0 1 0 0-6.854 3.427 3.427 0 0 0 0 6.854Z",
  resend: "M14.679 0c4.648 0 7.413 2.765 7.413 6.434s-2.765 6.434-7.413 6.434H12.33L24 24h-8.245l-8.88-8.44c-.636-.588-.93-1.273-.93-1.86 0-.831.587-1.565 1.713-1.883l4.574-1.224c1.737-.465 2.936-1.81 2.936-3.572 0-2.153-1.761-3.4-3.939-3.4H0V0z",
} as const;

export type BrandId = keyof typeof BRANDS;

export const BRAND_COLORS: Partial<Record<BrandId, string>> = {
  stripe: "#635BFF",
  hubspot: "#FF7A59",
  linear: "#5E6AD2",
  slack: "#E01E5A",
  snowflake: "#29B5E8",
  shopify: "#7AB55C",
  postgresql: "#4169E1",
  figma: "#F24E1E",
  googledrive: "#4285F4",
  claude: "#D97757",
  supabase: "#3FCF8E",
  cloudflare: "#F38020",
  svelte: "#FF3E00",
  nuxt: "#00DC82",
  meta: "#0467DF",
};

export type Mark = BrandId | { path: string; color?: string };

export function BrandMark({ mark, className }: { mark: Mark; className?: string }) {
  const path = typeof mark === "string" ? BRANDS[mark] : mark.path;
  const color = typeof mark === "string" ? BRAND_COLORS[mark] : mark.color;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d={path} fill={color ?? "currentColor"} />
    </svg>
  );
}

/** A neutral square well for a node that has an icon rather than a brand. */
export function IconWell({
  children,
  size = 32,
  className,
}: {
  children: React.ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center border border-black/[0.06] bg-[color-mix(in_oklab,var(--foreground)_5%,var(--card))] text-foreground dark:border-white/[0.12] [&>svg]:size-1/2",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  );
}

/** The square well a brand mark sits in, washed faintly in its own color. */
export function MarkWell({
  mark,
  size = 32,
  className,
}: {
  mark: Mark;
  size?: number;
  className?: string;
}) {
  const color = typeof mark === "string" ? BRAND_COLORS[mark] : mark.color;
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center border border-black/[0.06] text-foreground dark:border-white/[0.12]",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: color
          ? `color-mix(in oklab, ${color} 9%, var(--card))`
          : "color-mix(in oklab, var(--foreground) 5%, var(--card))",
      }}
    >
      <BrandMark mark={mark} className="size-1/2" />
    </span>
  );
}
