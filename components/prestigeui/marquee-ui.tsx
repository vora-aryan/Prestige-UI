"use client";

import * as React from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  type MotionValue,
} from "motion/react";
import { cn } from "@/lib/utils";

/** Strong ease-out for entrances and state changes. */
export const EASE = [0.16, 1, 0.3, 1] as const;

export const hairline = "border-black/[0.07] dark:border-white/[0.08]";

export const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27180%27 height=%27180%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.85%27 numOctaves=%273%27 stitchTiles=%27stitch%27/%3E%3CfeColorMatrix values=%270 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.9 0%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E\")";

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

/** A fade at both ends of the travel axis, so items arrive and leave softly. */
export function fadeMask(axis: "x" | "y", amount = 10) {
  const dir = axis === "x" ? "to right" : "to bottom";
  const mask = `linear-gradient(${dir}, transparent, #000 ${amount}%, #000 ${100 - amount}%, transparent)`;
  return { maskImage: mask, WebkitMaskImage: mask } as React.CSSProperties;
}

// How quickly a strip settles: a quick stop under the pointer, a slower
// pick-up when it leaves, so it never lurches back to speed.
const STOP_TAU = 0.32;
const GO_TAU = 0.9;

const wrap = (v: number, size: number) => (size ? ((v % size) - size) % size : 0);

type Children = React.ReactNode | ((copy: boolean) => React.ReactNode);

export type MarqueeProps = {
  /** Items for one lap. A function receives `copy` for the hidden second lap. */
  children: Children;
  axis?: "x" | "y";
  /** Travel the other way: right instead of left, down instead of up. */
  reverse?: boolean;
  /** Pixels per second. */
  speed?: number;
  /** Space between items, in pixels. */
  gap?: number;
  /** Ease to a stop while the pointer is over the strip. */
  pauseOnHover?: boolean;
  /** Hold still, for example while something inside is open. */
  paused?: boolean;
  /** Extra speed added on top, e.g. from scrolling. Signed with the travel. */
  boost?: MotionValue<number>;
  /** Fade the ends, in percent of the strip. 0 turns it off. */
  fade?: number;
  className?: string;
  /** Classes for each lap (the flex row or column of items). */
  laneClassName?: string;
  /** Classes for the single lap shown when motion is reduced. */
  reducedClassName?: string;
};

/**
 * A seamless loop driven by a frame clock instead of a CSS animation, so it
 * can ease to a stop, take a speed boost, and pause off screen.
 */
export function Marquee({
  children,
  axis = "x",
  reverse = false,
  speed = 32,
  gap = 12,
  pauseOnHover = true,
  paused = false,
  boost,
  fade = 10,
  className,
  laneClassName,
  reducedClassName,
}: MarqueeProps) {
  const reduce = useHydratedReduce();
  const viewport = React.useRef<HTMLDivElement>(null);
  const lap = React.useRef<HTMLDivElement>(null);
  const inView = useInView(viewport, { margin: "120px" });
  const offset = useMotionValue(0);
  const [hover, setHover] = React.useState(false);
  // Laps on the track. Two are enough when one lap is longer than the strip;
  // a short lap on a wide screen needs more, or the end shows a gap.
  const [laps, setLaps] = React.useState(2);
  const live = React.useRef({ velocity: speed, size: 0, stopped: false });

  React.useEffect(() => {
    live.current.stopped = paused || (pauseOnHover && hover);
  }, [hover, pauseOnHover, paused]);

  // One lap's length, so the track can wrap without a seam.
  React.useEffect(() => {
    const el = lap.current;
    if (!el || reduce) return;
    const box = viewport.current;
    const measure = () => {
      const size = axis === "x" ? el.offsetWidth : el.offsetHeight;
      const room = box ? (axis === "x" ? box.clientWidth : box.clientHeight) : 0;
      live.current.size = size;
      // Capped, so a strip whose height follows its content cannot feed itself.
      if (size) setLaps(Math.min(6, Math.max(2, Math.ceil(room / size) + 1)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (box) observer.observe(box);
    return () => observer.disconnect();
  }, [axis, reduce]);

  React.useEffect(() => {
    if (reduce || !inView) return;
    let frame = 0;
    let last = performance.now();
    const sign = reverse ? 1 : -1;
    const tick = (now: number) => {
      const s = live.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const target = s.stopped ? 0 : speed;
      const tau = s.stopped ? STOP_TAU : GO_TAU;
      s.velocity += (target - s.velocity) * (1 - Math.exp(-dt / tau));
      // Settle fully instead of creeping for another second.
      if (s.stopped && s.velocity < 2) s.velocity = 0;
      const extra = s.stopped ? 0 : (boost?.get() ?? 0);
      const step = (s.velocity + extra) * dt;
      if (step) offset.set(wrap(offset.get() + sign * step, s.size));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [boost, inView, offset, reduce, reverse, speed]);

  const render = (copy: boolean) =>
    typeof children === "function" ? children(copy) : children;
  const lapStyle: React.CSSProperties =
    axis === "x" ? { gap, paddingRight: gap } : { gap, paddingBottom: gap };

  return (
    <div
      ref={viewport}
      className={cn(
        "relative",
        axis === "x" ? "overflow-clip" : "overflow-x-visible overflow-y-clip",
        className,
      )}
      style={reduce || !fade ? undefined : fadeMask(axis, fade)}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHover(false)}
    >
      {reduce ? (
        <div
          className={cn(
            "flex",
            axis === "x" ? "flex-wrap justify-center" : "flex-col",
            laneClassName,
            reducedClassName,
          )}
          style={{ gap }}
        >
          {render(false)}
        </div>
      ) : (
        <motion.div
          style={axis === "x" ? { x: offset } : { y: offset }}
          className={cn("flex", axis === "x" ? "w-max" : "flex-col")}
        >
          <div
            ref={lap}
            className={cn("flex shrink-0", axis === "y" && "flex-col", laneClassName)}
            style={lapStyle}
          >
            {render(false)}
          </div>
          {Array.from({ length: laps - 1 }, (_, i) => (
            <div
              key={i}
              aria-hidden
              className={cn("flex shrink-0", axis === "y" && "flex-col", laneClassName)}
              style={lapStyle}
            >
              {render(true)}
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared section parts                                               */
/* ------------------------------------------------------------------ */

export const preventPlaceholder = (event: React.MouseEvent<HTMLAnchorElement>) => {
  if (event.currentTarget.getAttribute("href") === "#") event.preventDefault();
};

/** A once-only rise on entering view, off when motion is reduced. */
export const rise = (reduce: boolean, delay = 0) => ({
  initial: reduce ? false : ({ opacity: 0, y: 12 } as const),
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.3 },
  transition: { duration: 0.7, delay, ease: EASE },
});

export const focusRing =
  "outline-none focus-visible:ring-[3px] focus-visible:ring-foreground/20";

/** Matte color fields, like printed card stock. Muted near-black in dark mode. */
export const TONES = {
  sage: "bg-[#c9d4c3] dark:bg-[#1f2a23]",
  blue: "bg-[#c6d0dc] dark:bg-[#1d2430]",
  clay: "bg-[#dfcbb7] dark:bg-[#2c231b]",
  sand: "bg-[#ece3d3] dark:bg-[#26221c]",
  forest: "bg-[#163527] dark:bg-[#0e2219]",
} as const;

export type Tone = keyof typeof TONES;

/** A colored stage: the tone, a soft light from the top left and fine grain. */
export function Stage({
  tone,
  className,
  children,
}: {
  tone: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-[20px]",
        TONES[tone],
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_15%_0%,rgba(255,255,255,0.38),transparent_60%)] dark:bg-[radial-gradient(120%_90%_at_15%_0%,rgba(255,255,255,0.06),transparent_60%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.22] mix-blend-multiply dark:opacity-[0.35] dark:mix-blend-soft-light"
        style={{ backgroundImage: GRAIN }}
      />
      {children}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[20px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.045)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]"
      />
    </div>
  );
}

/** The ink primary action and a quiet text link. */
export function Actions({
  primaryLabel,
  primaryHref = "#",
  secondaryLabel,
  secondaryHref = "#",
  icon,
  square = false,
  className,
}: {
  /** Square corners, for sections built on the square system. */
  square?: boolean;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-3", className)}>
      {primaryLabel ? (
        <a
          href={primaryHref}
          onClick={preventPlaceholder}
          className={cn(
            "group inline-flex h-10 items-center gap-2 bg-foreground px-4 text-[13.5px] font-medium text-background transition-[scale,opacity] duration-150 hover:opacity-90 active:scale-[0.97]",
            square ? "rounded-none" : "rounded-[8px]",
            focusRing,
          )}
        >
          {primaryLabel}
          {icon}
        </a>
      ) : null}
      {secondaryLabel ? (
        <a
          href={secondaryHref}
          onClick={preventPlaceholder}
          className={cn(
            "rounded-[4px] text-[13.5px] font-medium text-foreground/60 transition-colors duration-150 hover:text-foreground",
            focusRing,
          )}
        >
          {secondaryLabel}
        </a>
      ) : null}
    </div>
  );
}
