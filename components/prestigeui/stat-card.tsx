"use client";

import * as React from "react";
import { useInView } from "motion/react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatPoint = {
  /** Shown while this point is scrubbed, e.g. "Nov 3". */
  label: string;
  value: number;
};

export type StatTone = "ink" | "cobalt" | "ember" | "forest" | "wine";

export interface StatCardProps {
  /** What is measured, e.g. "Revenue". */
  label: string;
  /** Oldest first. The last point is the headline number. */
  data: StatPoint[];
  /** How the number reads, e.g. `{ style: "currency", currency: "USD" }`. */
  format?: Intl.NumberFormatOptions;
  locale?: string;
  /** Shown under the number at rest, e.g. "Last 30 days". */
  period?: string;
  /** Which way is good. For response time or churn, pass "down". */
  goodDirection?: "up" | "down";
  chart?: "line" | "bar";
  /** Color of the chart, the icon well and a good change. */
  tone?: StatTone;
  /** Small icon beside the label, e.g. a lucide icon. */
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  className?: string;
}

const TONES: Record<StatTone, string> = {
  ink: "[--stat:#18181b] dark:[--stat:#ededf0]",
  cobalt: "[--stat:#2f6bff] dark:[--stat:#6b93ff]",
  ember: "[--stat:#e8571f] dark:[--stat:#ff7a45]",
  forest: "[--stat:#1f6b4a] dark:[--stat:#5fb38c]",
  wine: "[--stat:#9b2c4f] dark:[--stat:#e07a99]",
};

const EASE = "cubic-bezier(0.16,1,0.3,1)";
const IN_OUT = "cubic-bezier(0.65,0,0.35,1)";
const DRAW = 1.2;

const subscribeReduce = (cb: () => void) => {
  const m = window.matchMedia("(prefers-reduced-motion: reduce)");
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/** A smooth curve through the points that never overshoots them (monotone cubic). */
function smooth(pts: [number, number][]) {
  const n = pts.length;
  if (n < 3) return pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join("");
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]));
  const m = pts.map((_, i) => {
    if (i === 0) return d[0];
    if (i === n - 1) return d[n - 2];
    return d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]);
  });
  const parts = [`M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`];
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const h = (x1 - x0) / 3;
    parts.push(
      `C${(x0 + h).toFixed(2)},${(y0 + m[i] * h).toFixed(2)} ${(x1 - h).toFixed(2)},${(y1 - m[i + 1] * h).toFixed(2)} ${x1.toFixed(2)},${y1.toFixed(2)}`,
    );
  }
  return parts.join("");
}

/* ------------------------------------------------------------------ */
/*  Odometer                                                           */
/* ------------------------------------------------------------------ */

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Each digit is a 0-9 strip that rolls to its value; other characters sit still. */
function Odometer({ text, duration, stagger, instant }: { text: string; duration: number; stagger: number; instant: boolean }) {
  const chars = text.split("");
  return (
    <span aria-hidden className="inline-flex tabular-nums">
      {chars.map((char, i) => {
        // Keyed by place from the right, so a new leading digit doesn't shift the rest.
        const key = chars.length - i;
        const d = Number(char);
        if (char === " " || Number.isNaN(d)) {
          return (
            <span key={`${key}-${char}`} className="whitespace-pre">
              {char}
            </span>
          );
        }
        return (
          // The window is taller than the glyphs (margins keep the line box at 1em) and fades at
          // its edges, so mid-roll digits glide in instead of showing hard slivers.
          <span
            key={key}
            className="relative -my-[0.15em] inline-block h-[1.3em] overflow-clip leading-[1.3em] [mask-image:linear-gradient(transparent,black_24%,black_76%,transparent)]"
          >
            <span className="invisible">0</span>
            <span
              className="absolute inset-x-0 top-0 flex flex-col"
              style={{
                transform: `translateY(${-d * 10}%)`,
                transition: instant ? "none" : `transform ${duration}s ${EASE} ${i * stagger}s`,
              }}
            >
              {DIGITS.map((n) => (
                <span key={n} className="h-[1.3em] text-center">
                  {n}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Card                                                               */
/* ------------------------------------------------------------------ */

/**
 * A metric card: the number rolls into place like an odometer when the card
 * comes into view while the chart draws under it. Scrub the chart (pointer,
 * touch or arrow keys) and the number rolls to that day; let go and it rolls
 * back to today.
 */
export function StatCard({
  label,
  data,
  format,
  locale = "en-US",
  period = "Last 30 days",
  goodDirection = "up",
  chart = "line",
  tone = "cobalt",
  icon: Icon,
  className,
}: StatCardProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const plotRef = React.useRef<HTMLDivElement>(null);
  const gradientId = React.useId();
  const inView = useInView(ref, { once: true, amount: 0.5 });
  // Server snapshot false: the server draws the "before" frame and the browser plays it in.
  const reduce = React.useSyncExternalStore(
    subscribeReduce,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  const played = inView || reduce;
  const [scrub, setScrub] = React.useState<number | null>(null);
  const [scrubbing, setScrubbing] = React.useState(false);

  const n = data.length;
  const last = n - 1;
  const index = scrub ?? last;
  const point = data[index];
  const base = data[0]?.value ?? 0;

  const fmt = React.useMemo(() => new Intl.NumberFormat(locale, format), [locale, format]);
  const pct = React.useMemo(
    () => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" }),
    [locale],
  );

  // Before the card is seen every digit waits at zero, so it rolls up into place.
  // Same shape as the real number ("0,000 ms"), so every digit has a strip to roll.
  const formatted = fmt.format(point.value);
  const text = played ? formatted : formatted.replace(/\d/g, "0");
  const change = base === 0 ? 0 : (point.value - base) / Math.abs(base);
  const good = change === 0 || (change > 0) === (goodDirection === "up");

  /* Geometry: a 0-100 box, with room above the peak and below the trough. */
  const values = data.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (n === 1 ? 50 : (i / last) * 100);
  const y = (v: number) => 100 - (8 + ((v - min) / span) * 76);
  const line = smooth(data.map((p, i) => [x(i), y(p.value)]));
  const area = `${line}L100,100L0,100Z`;
  const at = x(index);
  // Inset on the right so the marker on today never touches the card edge.
  const inset = chart === "line" ? "right-3.5 left-0" : "inset-x-3";

  const pick = (clientX: number) => {
    const r = plotRef.current?.getBoundingClientRect();
    if (!r || n < 2) return;
    const i = Math.round(((clientX - r.left) / r.width) * last);
    setScrub(Math.max(0, Math.min(last, i)));
  };

  const drawn = played ? "inset(0 0 0 0)" : "inset(0 100% 0 0)";
  const drawTransition = reduce ? "none" : `clip-path ${DRAW}s ${IN_OUT}`;
  // The part of the line after the scrubbed day steps back.
  const ahead = `inset(0 ${(100 - at).toFixed(2)}% 0 0)`;

  return (
    <div
      ref={ref}
      className={cn(
        "@container relative flex min-w-0 flex-col overflow-clip rounded-lg bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] transition-shadow duration-300 [--stat-soft:0.22] [--stat-surface:#fff] hover:shadow-[0_0_0_1px_rgba(0,0,0,0.09),0_12px_32px_-16px_rgba(0,0,0,0.18)] dark:bg-[#17171b] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.14),inset_0_1px_0_rgba(255,255,255,0.05)] dark:[--stat-soft:0.35] dark:[--stat-surface:#17171b] dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2),inset_0_1px_0_rgba(255,255,255,0.06)]",
        TONES[tone],
        className,
      )}
    >
      <div className="px-5 pt-5">
        <div className="flex h-7 items-center gap-2.5">
          {Icon && (
            <span className="grid size-7 shrink-0 place-items-center rounded-[6px] bg-[color-mix(in_oklab,var(--stat)_11%,transparent)] text-[var(--stat)]">
              <Icon className="size-[15px]" strokeWidth={2} />
            </span>
          )}
          <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-foreground/80">{label}</p>
          <p className="shrink-0 text-[12.5px] text-muted-foreground">{period}</p>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1.5">
          <p className="text-[32px] leading-none font-medium text-foreground @[280px]:text-[36px]">
            <span className="sr-only">{formatted}</span>
            <Odometer
              text={text}
              duration={scrub === null && !scrubbing ? 1.1 : 0.45}
              stagger={scrub === null && !scrubbing ? 0.04 : 0}
              instant={reduce}
            />
          </p>
          <span
            className={cn(
              "mb-0.5 inline-flex h-6 items-center gap-0.5 rounded-[5px] px-1.5 text-[12.5px] font-medium tabular-nums transition-[opacity,color,background-color] duration-300",
              good
                ? "bg-[color-mix(in_oklab,var(--stat)_11%,transparent)] text-[color-mix(in_oklab,var(--stat)_82%,black)] dark:bg-[color-mix(in_oklab,var(--stat)_16%,transparent)] dark:text-[var(--stat)]"
                : "bg-[#d4463e]/[0.1] text-[#b8372f] dark:bg-[#ff6b5e]/[0.14] dark:text-[#ff8a7f]",
              played ? "opacity-100" : "opacity-0",
            )}
            style={{ transitionDelay: played && scrub === null ? `${reduce ? 0 : DRAW - 0.2}s` : "0s" }}
          >
            {change >= 0 ? (
              <ArrowUpRight className="size-3.5" strokeWidth={2.25} />
            ) : (
              <ArrowDownRight className="size-3.5" strokeWidth={2.25} />
            )}
            {pct.format(change)}
          </span>
        </div>

        {/* What the change is measured against; the dashed line in the chart marks it. */}
        <p className="mt-2.5 truncate text-[12.5px] text-muted-foreground tabular-nums">
          vs {fmt.format(base)} on {data[0]?.label}
        </p>
      </div>

      {/* Plot: full bleed to the left edge. */}
      <div
        role="slider"
        tabIndex={0}
        aria-label={`${label} by day`}
        aria-valuemin={0}
        aria-valuemax={last}
        aria-valuenow={index}
        aria-valuetext={`${point.label}: ${fmt.format(point.value)}`}
        onPointerMove={(e) => (e.pointerType === "mouse" || scrubbing) && pick(e.clientX)}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") {
            e.currentTarget.setPointerCapture(e.pointerId);
            setScrubbing(true);
          }
          pick(e.clientX);
        }}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        onPointerLeave={(e) => e.pointerType === "mouse" && setScrub(null)}
        onKeyDown={(e) => {
          const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
          if (step) {
            e.preventDefault();
            setScrub(Math.max(0, Math.min(last, index + step)));
          } else if (e.key === "Home" || e.key === "End") {
            e.preventDefault();
            setScrub(e.key === "Home" ? 0 : last);
          } else if (e.key === "Escape") setScrub(null);
        }}
        onBlur={() => setScrub(null)}
        className="relative mt-5 h-[92px] cursor-crosshair touch-pan-y outline-none select-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-inset"
      >
        <div ref={plotRef} className={cn("absolute inset-y-0", inset)}>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground/20 transition-opacity duration-500"
          style={{ top: `${y(base).toFixed(2)}%`, opacity: played ? 1 : 0, transitionDelay: played && !reduce ? `${DRAW - 0.3}s` : "0s" }}
        />
        {chart === "line" ? (
          <>
            <div className="absolute inset-0" style={{ clipPath: drawn, transition: drawTransition }}>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--stat)" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="var(--stat)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Faint full line, then the bright part up to the scrubbed day. */}
                <path d={line} fill="none" stroke="var(--stat)" strokeOpacity="0.28" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              </svg>
              <div
                className="absolute inset-0"
                style={{ clipPath: ahead, transition: reduce ? "none" : `clip-path 0.2s ${EASE}` }}
              >
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
                  <path d={area} fill={`url(#${gradientId})`} />
                  <path d={line} fill="none" stroke="var(--stat)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            {/* Marker on the current day. It lands when the line arrives. */}
            <span
              aria-hidden
              className="pointer-events-none absolute size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--stat)] shadow-[0_0_0_2.5px_var(--stat-surface)]"
              style={{
                left: `${at}%`,
                top: `${y(point.value)}%`,
                opacity: played ? 1 : 0,
                scale: played ? "1" : "0.4",
                transition: reduce
                  ? "none"
                  : scrub === null && !scrubbing
                    ? `left 0.3s ${EASE}, top 0.3s ${EASE}, opacity 0.3s ${EASE} ${DRAW - 0.1}s, scale 0.4s ${EASE} ${DRAW - 0.1}s`
                    : `left 0.12s ${EASE}, top 0.12s ${EASE}`,
              }}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {data.map((p, i) => (
              <span
                key={i}
                aria-hidden
                className="min-w-0 flex-1 origin-bottom rounded-t-[2px] bg-[var(--stat)]"
                style={{
                  height: `${100 - y(p.value)}%`,
                  scale: played ? "1 1" : "1 0",
                  // A soft tint of the tone; the day on show is solid.
                  opacity: i === index ? 1 : "var(--stat-soft)",
                  transition: reduce
                    ? "none"
                    : `scale 0.7s ${EASE} ${scrub === null && !scrubbing ? (i / n) * 0.6 : 0}s, opacity 0.2s ${EASE}`,
                }}
              />
            ))}
          </div>
        )}

        {/* Scrub hairline. */}
        {chart === "line" && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-px bg-foreground/15 transition-opacity duration-150"
            style={{ left: `${at}%`, opacity: scrub === null ? 0 : 1 }}
          />
        )}
        </div>
      </div>

      {/* Date axis: first and last day; while scrubbing, the day under the cursor. */}
      <div aria-hidden className="relative h-9 text-[11.5px] text-muted-foreground tabular-nums">
        <div className={cn("absolute inset-y-0", inset)}>
          <span
            className={cn("absolute top-2.5 left-5 transition-opacity duration-200", chart === "bar" && "left-0", scrub !== null && at < 30 ? "opacity-0" : "opacity-100")}
          >
            {data[0]?.label}
          </span>
          <span
            className={cn("absolute top-2.5 right-1.5 transition-opacity duration-200", chart === "bar" && "right-0", scrub !== null && at > 70 ? "opacity-0" : "opacity-100")}
          >
            {data[last]?.label}
          </span>
          <span
            className="absolute top-1.5 -translate-x-1/2 rounded-[4px] bg-foreground px-1.5 py-0.5 text-[11.5px] font-medium text-background transition-opacity duration-150"
            style={{ left: `clamp(28px, ${at}%, calc(100% - 28px))`, opacity: scrub === null ? 0 : 1 }}
          >
            {point.label}
          </span>
        </div>
      </div>
    </div>
  );

  function endScrub() {
    if (!scrubbing) return;
    setScrubbing(false);
    setScrub(null);
  }
}
