"use client";

import * as React from "react";
import {
  AnimatePresence,
  cubicBezier,
  motion,
  useReducedMotion,
} from "motion/react";
import { cn } from "@/lib/utils";

/*
 * Charts for the Dashboard family, drawn with plain SVG and no chart library.
 * Colors come from CSS variables (see dashboardThemes in dashboard-ui.tsx), so
 * a chart follows the theme and dark mode by itself.
 */

/** Travel: an even start and a soft landing, for things moving between values. */
const TRAVEL = [0.65, 0, 0.35, 1] as const;
const travel = cubicBezier(...TRAVEL);

/* ------------------------------------------------------------------ */
/*  Scale                                                              */
/* ------------------------------------------------------------------ */

/**
 * Round axis values that contain every number passed in. Always returns the
 * same number of ticks, so gridlines stay put when the data changes.
 */
export function niceScale(
  values: number[],
  { zeroBased = true, count = 5 } = {},
) {
  const finite = values.filter(Number.isFinite);
  let low = finite.length ? Math.min(...finite) : 0;
  let high = finite.length ? Math.max(...finite) : 1;
  if (zeroBased) {
    low = Math.min(low, 0);
    high = Math.max(high, 0);
  }
  if (low === high) {
    // A flat line: give it room rather than dividing by zero.
    const pad = Math.abs(high) * 0.1 || 1;
    low = low === 0 || (zeroBased && low > 0) ? 0 : low - pad;
    high += pad;
  }
  // The smallest round step whose ticks reach both ends of the data.
  const intervals = count - 1;
  const power = 10 ** Math.floor(Math.log10((high - low) / intervals));
  for (const size of [1, 2, 2.5, 5, 10, 20, 25, 50, 100]) {
    const step = size * power;
    const min = Math.floor(low / step) * step;
    if (min + step * intervals >= high) {
      return {
        min,
        max: min + step * intervals,
        ticks: Array.from({ length: count }, (_, i) => min + step * i),
      };
    }
  }
  return {
    min: low,
    max: high,
    ticks: Array.from(
      { length: count },
      (_, i) => low + ((high - low) / intervals) * i,
    ),
  };
}

/** Evenly spaced indexes, counted back from the last point. */
function labelIndexes(length: number, room: number) {
  if (length <= 1) return length ? [0] : [];
  const step = Math.ceil((length - 1) / Math.max(1, Math.floor(room) - 1));
  const out: number[] = [];
  for (let i = length - 1; i >= 0; i -= step) out.unshift(i);
  return out;
}

function useWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      // A hidden chart reads 0. Keep the last width, so it does not redraw from scratch when shown.
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/* ------------------------------------------------------------------ */
/*  Morphing line                                                      */
/* ------------------------------------------------------------------ */

const MORPH_MS = 820;
/** How much of the move the wave takes to cross from the first point to the last. */
const MORPH_SPREAD = 0.34;

/** Joins points into a path. A missing value leaves a gap in the line. */
function pathOf(xs: number[], ys: number[], gaps: boolean[]) {
  let out = "";
  let pen = false;
  xs.forEach((x, i) => {
    if (gaps[i]) {
      pen = false;
      return;
    }
    out += `${pen ? "L" : "M"}${x.toFixed(1)} ${ys[i].toFixed(1)}`;
    pen = true;
  });
  return out;
}

/** The same points closed down to a baseline, one shape per unbroken run, for a fill. */
function areaOf(xs: number[], ys: number[], gaps: boolean[], floor: number) {
  let out = "";
  let run: number[] = [];
  const close = () => {
    if (run.length > 1) {
      out += `M${xs[run[0]].toFixed(1)} ${floor.toFixed(1)}`;
      run.forEach((i) => {
        out += `L${xs[i].toFixed(1)} ${ys[i].toFixed(1)}`;
      });
      out += `L${xs[run[run.length - 1]].toFixed(1)} ${floor.toFixed(1)}Z`;
    }
    run = [];
  };
  xs.forEach((_, i) => {
    if (gaps[i]) close();
    else run.push(i);
  });
  close();
  return out;
}

/** Stretches a line to a new number of points, so any shape can turn into any other. */
function resample(values: number[], length: number) {
  if (values.length === length) return values;
  return Array.from({ length }, (_, i) => {
    const at = length > 1 ? (i / (length - 1)) * (values.length - 1) : 0;
    const low = Math.floor(at);
    const high = Math.min(low + 1, values.length - 1);
    return values[low] + (values[high] - values[low]) * (at - low);
  });
}

/**
 * A line that turns into its next shape as a wave, left to right, so the eye
 * can follow what changed. It rises from the baseline on first show, follows
 * a resize at once, and restarts smoothly from wherever it is if the data
 * changes mid-move. It paints directly, so React doesn't render every frame.
 */
function MorphLine({
  xs,
  ys,
  revision,
  baseline,
  delay = 0,
  showEnd = false,
  areaFill,
  reduce,
  ...path
}: {
  xs: number[];
  /** Pixel heights. Null leaves a gap. */
  ys: (number | null)[];
  /** Changes when the line means something else, even at a different width. */
  revision: string;
  /** Where the line rises from the first time. */
  baseline: number;
  delay?: number;
  /** Marks the latest point with a dot that rides the line. */
  showEnd?: boolean;
  /** Fills under the line with this color, down to the baseline. */
  areaFill?: string;
  reduce: boolean;
} & React.SVGProps<SVGPathElement>) {
  const line = React.useRef<SVGPathElement>(null);
  const area = React.useRef<SVGPathElement>(null);
  const end = React.useRef<SVGCircleElement>(null);
  const shown = React.useRef<number[] | null>(null);
  const seen = React.useRef({ revision, xsKey: "" });
  const xsKey = xs.join();
  const ysKey = ys.join();

  React.useLayoutEffect(() => {
    const count = ys.length;
    const gaps = ys.map((y) => y === null);
    // A gap holds the height of the last known point while it moves.
    const first = ys.find((y) => y !== null) ?? baseline;
    const target: number[] = [];
    ys.forEach((y, i) => target.push(y ?? (i ? target[i - 1] : first)));

    const paint = (values: number[]) => {
      line.current?.setAttribute("d", pathOf(xs, values, gaps));
      area.current?.setAttribute("d", areaOf(xs, values, gaps, baseline));
      const dot = end.current;
      if (!dot) return;
      dot.setAttribute("cx", String(xs[count - 1] ?? 0));
      dot.setAttribute("cy", String(values[count - 1] ?? 0));
      dot.style.opacity = count && !gaps[count - 1] ? "1" : "0";
    };

    const resized =
      seen.current.xsKey !== xsKey &&
      seen.current.xsKey !== "" &&
      seen.current.revision === revision;
    seen.current = { revision, xsKey };
    if (reduce || resized || !count) {
      shown.current = target;
      paint(target);
      return;
    }

    const from = resample(shown.current ?? target.map(() => baseline), count);
    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      start ||= now;
      const t = (now - start - delay) / MORPH_MS;
      const values = target.map((to, i) => {
        const wave = count > 1 ? (i / (count - 1)) * MORPH_SPREAD : 0;
        const local = Math.max(0, Math.min(1, (t - wave) / (1 - MORPH_SPREAD)));
        return from[i] + (to - from[i]) * travel(local);
      });
      shown.current = values;
      paint(values);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    paint(from);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // xsKey and ysKey stand in for xs and ys, which are new arrays on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xsKey, ysKey, revision, baseline, delay, reduce]);

  return (
    <>
      {areaFill ? <path ref={area} fill={areaFill} stroke="none" /> : null}
      <path ref={line} fill="none" {...path} />
      {showEnd ? (
        <circle
          ref={end}
          r={4}
          fill={path.stroke}
          stroke="var(--background)"
          strokeWidth={2}
          style={{ opacity: 0 }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Time chart                                                         */
/* ------------------------------------------------------------------ */

export type TimePoint = {
  /** The point's date, as YYYY-MM-DD. */
  date: string;
  value: number | null;
  /** The same point in the period being compared against. */
  previous?: number | null;
  /** The whole this point is part of, drawn in grey behind the line. */
  total?: number | null;
};

const TOP = 12;
const BOTTOM = 28;
const AXIS = 56;

export type TimeChartProps = {
  points: TimePoint[];
  /** Names the chart for screen readers, e.g. "Revenue, last 30 days". */
  label: string;
  /** Changes when the data means something else. The line glides to its new shape. */
  seriesKey: string;
  /** Changes when the line moves within the same series, e.g. a filter. Nothing redraws from scratch. */
  filterKey?: string;
  /** Names used in the tooltip. */
  seriesLabel: string;
  previousLabel?: string;
  totalLabel?: string;
  /** Show the previous period. Fading it out keeps the line ready to return. */
  showPrevious?: boolean;
  /** Show each point's total in grey behind the line. */
  showTotal?: boolean;
  /** Fill softly under the lines. */
  filled?: boolean;
  /** The picked point's date. */
  selected?: string | null;
  /** Called with a date on click or Enter, and null to clear. */
  onSelect?: (date: string | null) => void;
  formatValue: (value: number) => string;
  formatAxis: (value: number) => string;
  /** A full date, for the tooltip. */
  formatDate: (date: string) => string;
  /** A short date, for the axis. */
  formatTick: (date: string) => string;
  /** Start the axis at zero rather than fitting it to the data. */
  zeroBased?: boolean;
  height?: number;
  className?: string;
};

/**
 * One line over time, with the previous period dashed behind it. Hover or use
 * the arrow keys to read a point. Click or press Enter to pick it.
 */
export function TimeChart({
  points: rawPoints,
  label,
  seriesKey,
  filterKey = "",
  seriesLabel,
  previousLabel = "Previous",
  totalLabel = "Total",
  showPrevious = true,
  showTotal = false,
  filled = false,
  selected = null,
  onSelect,
  formatValue,
  formatAxis,
  formatDate,
  formatTick,
  zeroBased = false,
  height = 264,
  className,
}: TimeChartProps) {
  const reduce = useReducedMotion() ?? false;
  const [boxRef, width] = useWidth<HTMLDivElement>();
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const [hover, setHover] = React.useState<number | null>(null);
  const [keyed, setKeyed] = React.useState<number | null>(null);

  // The picked point's marker waits until the line has arrived under it.
  const [seenKey, setSeenKey] = React.useState(seriesKey);
  const [morphing, setMorphing] = React.useState(false);
  if (seenKey !== seriesKey) {
    setSeenKey(seriesKey);
    setMorphing(true);
  }
  React.useEffect(() => {
    if (!morphing) return;
    const timer = window.setTimeout(() => setMorphing(false), MORPH_MS);
    return () => window.clearTimeout(timer);
  }, [morphing]);

  // NaN and Infinity from a bad query count as no data, here and in the tooltip.
  const points = rawPoints.map((p) => ({
    ...p,
    value:
      typeof p.value === "number" && Number.isFinite(p.value) ? p.value : null,
    previous:
      p.previous === undefined
        ? undefined
        : typeof p.previous === "number" && Number.isFinite(p.previous)
          ? p.previous
          : null,
    total:
      typeof p.total === "number" && Number.isFinite(p.total) ? p.total : null,
  }));
  const count = points.length;
  const plotW = Math.max(width - AXIS, 1);
  const plotH = height - TOP - BOTTOM;
  const numbers = points
    .flatMap((p) => [p.value, p.total, showPrevious ? p.previous : null])
    .filter((v): v is number => typeof v === "number");
  const scale = niceScale(numbers, { zeroBased });
  const x = (i: number) => (count <= 1 ? plotW / 2 : (i / (count - 1)) * plotW);
  const y = (v: number) =>
    TOP + (1 - (v - scale.min) / (scale.max - scale.min)) * plotH;

  const xs = points.map((_, i) => x(i));
  const toPixels = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value) ? y(value) : null;
  const lineYs = points.map((p) => toPixels(p.value));
  const previousYs = points.map((p) => toPixels(p.previous));
  const hasPrevious = previousYs.some((value) => value !== null);
  const totalYs = points.map((p) => toPixels(p.total));
  const hasTotal = totalYs.some((value) => value !== null);

  const active = hover ?? keyed;
  const activePoint = active !== null ? points[active] : undefined;
  const pickedAt = selected ? points.findIndex((p) => p.date === selected) : -1;
  const ticks = labelIndexes(count, Math.max(plotW / 84, 4));

  const indexAt = (clientX: number, element: HTMLElement) => {
    const box = element.getBoundingClientRect();
    if (count <= 1) return count - 1;
    return Math.max(
      0,
      Math.min(
        count - 1,
        Math.round(((clientX - box.left) / plotW) * (count - 1)),
      ),
    );
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!count) return;
    const at = keyed ?? (pickedAt >= 0 ? pickedAt : count - 1);
    const moves: Record<string, number> = {
      ArrowLeft: at - 1,
      ArrowRight: at + 1,
      Home: 0,
      End: count - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      setKeyed(Math.max(0, Math.min(count - 1, moves[event.key])));
    } else if ((event.key === "Enter" || event.key === " ") && keyed !== null) {
      event.preventDefault();
      const date = points[keyed]?.date;
      onSelect?.(date === selected ? null : (date ?? null));
    } else if (event.key === "Escape") {
      if (selected) onSelect?.(null);
      setKeyed(null);
    }
  };

  const tipLeft = active !== null ? x(active) : 0;
  const tipOnLeft = tipLeft + 196 > plotW;

  return (
    <div className={cn("relative min-w-0", className)}>
      <div
        ref={boxRef}
        role="group"
        tabIndex={0}
        aria-label={`${label}. Use the left and right arrow keys to read each point${onSelect ? ", and Enter to pick one" : ""}.`}
        aria-describedby={`${id}-table`}
        onKeyDown={onKeyDown}
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible"))
            setKeyed(pickedAt >= 0 ? pickedAt : count - 1);
        }}
        onBlur={() => setKeyed(null)}
        onPointerMove={(event) =>
          setHover(indexAt(event.clientX, event.currentTarget))
        }
        onPointerLeave={() => setHover(null)}
        onClick={(event) => {
          const date =
            points[indexAt(event.clientX, event.currentTarget)]?.date;
          if (date) onSelect?.(date === selected ? null : date);
        }}
        style={{ height }}
        className="relative cursor-crosshair touch-pan-y rounded-[var(--r-control,10px)] outline-none select-none focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_oklab,var(--foreground)_14%,transparent)]"
      >
        {width > 0 ? (
          <svg
            aria-hidden
            width={width}
            height={height}
            className="absolute inset-0 block overflow-visible"
          >
            {filled ? (
              <defs>
                <linearGradient id={`${id}-main`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="var(--dash-1)" stopOpacity="0.14" />
                  <stop offset="1" stopColor="var(--dash-1)" stopOpacity="0" />
                </linearGradient>
                <linearGradient id={`${id}-total`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="currentColor" stopOpacity="0.08" />
                  <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
            ) : null}
            {/* Gridlines stay put. Their values crossfade when the scale changes. */}
            {scale.ticks.map((tick, i) => (
              <line
                key={i}
                x1={0}
                x2={plotW}
                y1={y(tick)}
                y2={y(tick)}
                stroke="currentColor"
                className="text-foreground/[0.07] dark:text-foreground/[0.11]"
              />
            ))}
                          {scale.ticks.map((tick, i) => (
                <motion.text
                  key={`${i}-${formatAxis(tick)}`}
                  x={plotW + 10}
                  y={y(tick)}
                  dy="0.32em"
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: 1,
                    transition: {
                      duration: reduce ? 0 : 0.4,
                      delay: reduce ? 0 : 0.14,
                    },
                  }}
                  className="fill-foreground/45 text-[11.5px] tabular-nums dark:fill-foreground/60"
                >
                  {formatAxis(tick)}
                </motion.text>
              ))}

            {/* Dates */}
                          {ticks.map((i) => (
                <motion.text
                  key={points[i].date}
                  x={x(i)}
                  y={height - 8}
                  textAnchor={
                    i === count - 1 && count > 1
                      ? "end"
                      : i === 0 && count > 1
                        ? "start"
                        : "middle"
                  }
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: 1,
                    transition: {
                      duration: reduce ? 0 : 0.4,
                      delay: reduce ? 0 : 0.14,
                    },
                  }}
                  className="fill-foreground/45 text-[11.5px] tabular-nums dark:fill-foreground/60"
                >
                  {formatTick(points[i].date)}
                </motion.text>
              ))}

            {/* The whole, in grey, sits still behind a filtered line */}
            {hasTotal ? (
              <motion.g
                initial={false}
                animate={{ opacity: showTotal ? 1 : 0 }}
                transition={{ duration: reduce ? 0 : 0.3 }}
              >
                <MorphLine
                  xs={xs}
                  ys={totalYs}
                  revision={seriesKey}
                  baseline={height - BOTTOM}
                  reduce={reduce}
                  areaFill={filled ? `url(#${id}-total)` : undefined}
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-foreground/25 dark:text-foreground/35"
                />
              </motion.g>
            ) : null}
            {/* The previous period sets off just after the main line */}
            {hasPrevious ? (
              <motion.g
                initial={false}
                animate={{ opacity: showPrevious ? 1 : 0 }}
                transition={{ duration: reduce ? 0 : 0.3 }}
              >
                <MorphLine
                  xs={xs}
                  ys={previousYs}
                  revision={seriesKey}
                  baseline={height - BOTTOM}
                  delay={70}
                  reduce={reduce}
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeDasharray="3 4"
                  strokeLinecap="round"
                  className="text-foreground/30 dark:text-foreground/45"
                />
              </motion.g>
            ) : null}
            <MorphLine
              xs={xs}
              ys={lineYs}
              revision={`${seriesKey}|${filterKey}`}
              baseline={height - BOTTOM}
              showEnd
              reduce={reduce}
              areaFill={filled ? `url(#${id}-main)` : undefined}
              stroke="var(--dash-1)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* The picked point stays marked */}
            {pickedAt >= 0 && points[pickedAt]?.value != null ? (
              <motion.g
                initial={false}
                animate={{ opacity: morphing ? 0 : 1 }}
                transition={{ duration: reduce ? 0 : morphing ? 0.1 : 0.25 }}
              >
                <line
                  x1={x(pickedAt)}
                  x2={x(pickedAt)}
                  y1={TOP}
                  y2={height - BOTTOM}
                  stroke="var(--dash-1)"
                  strokeWidth={1}
                />
                <circle
                  cx={x(pickedAt)}
                  cy={y(points[pickedAt].value as number)}
                  r={5}
                  fill="var(--dash-1)"
                  stroke="var(--background)"
                  strokeWidth={2}
                />
              </motion.g>
            ) : null}

            {/* The point under the pointer */}
            {activePoint ? (
              <g>
                <line
                  x1={x(active as number)}
                  x2={x(active as number)}
                  y1={TOP}
                  y2={height - BOTTOM}
                  stroke="currentColor"
                  className="text-foreground/25"
                />
                {showPrevious && typeof activePoint.previous === "number" ? (
                  <circle
                    cx={x(active as number)}
                    cy={y(activePoint.previous)}
                    r={3.5}
                    className="fill-foreground/40"
                    stroke="var(--background)"
                    strokeWidth={2}
                  />
                ) : null}
                {typeof activePoint.value === "number" ? (
                  <circle
                    cx={x(active as number)}
                    cy={y(activePoint.value)}
                    r={4.5}
                    fill="var(--dash-1)"
                    stroke="var(--background)"
                    strokeWidth={2}
                  />
                ) : null}
              </g>
            ) : null}
          </svg>
        ) : null}

        {/* One tooltip with every series */}
        {activePoint ? (
          <div
            aria-hidden
            style={{
              transform: `translateX(${tipOnLeft ? tipLeft - 196 : tipLeft + 12}px)`,
            }}
            className="pointer-events-none absolute top-2 left-0 w-[184px] rounded-[var(--r-control,10px)] bg-(--st-pop) px-3 py-2 text-[12.5px] shadow-[0_0_0_1px_rgba(0,0,0,0.07),0_2px_4px_rgba(0,0,0,0.05),0_12px_28px_-14px_rgba(0,0,0,0.3)] transition-transform duration-100 ease-out dark:shadow-[0_0_0_1px_rgba(255,255,255,0.09),0_12px_28px_-14px_rgba(0,0,0,0.8)]"
          >
            <p className="truncate text-foreground/55">
              {formatDate(activePoint.date)}
            </p>
            <p className="mt-1 flex items-center gap-2">
              <span className="h-0.5 w-3 shrink-0 rounded-full bg-(--dash-1)" />
              <span className="font-semibold tabular-nums">
                {activePoint.value === null
                  ? "No data"
                  : formatValue(activePoint.value)}
              </span>
              <span className="ml-auto min-w-0 truncate text-foreground/55">
                {seriesLabel}
              </span>
            </p>
            {showTotal && activePoint.total !== null ? (
              <p className="mt-0.5 flex items-center gap-2">
                <span className="h-0.5 w-3 shrink-0 rounded-full bg-foreground/30" />
                <span className="font-medium text-foreground/75 tabular-nums">
                  {formatValue(activePoint.total)}
                </span>
                <span className="ml-auto min-w-0 truncate text-foreground/55">
                  {totalLabel}
                </span>
              </p>
            ) : null}
            {showPrevious && activePoint.previous !== undefined ? (
              <p className="mt-0.5 flex items-center gap-2">
                <span className="h-0.5 w-3 shrink-0 rounded-full bg-foreground/30" />
                <span className="font-medium text-foreground/75 tabular-nums">
                  {activePoint.previous === null
                    ? "No data"
                    : formatValue(activePoint.previous)}
                </span>
                <span className="ml-auto min-w-0 truncate text-foreground/55">
                  {previousLabel}
                </span>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* What a keyboard user just moved to */}
      <p aria-live="polite" className="sr-only">
        {keyed !== null && points[keyed]
          ? `${formatDate(points[keyed].date)}: ${points[keyed].value === null ? "no data" : formatValue(points[keyed].value as number)}`
          : ""}
      </p>
      {/* Every value, without needing to hover */}
      <table id={`${id}-table`} className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">{seriesLabel}</th>
            <th scope="col">{previousLabel}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <th scope="row">{formatDate(p.date)}</th>
              <td>{p.value === null ? "No data" : formatValue(p.value)}</td>
              <td>
                {p.previous == null ? "No data" : formatValue(p.previous)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Diverging bars                                                     */
/* ------------------------------------------------------------------ */

export type BarSeries = {
  id: string;
  label: string;
  color: string;
  /** Gains stack above zero, losses below it. */
  direction: "up" | "down";
};

export type BarPoint = {
  /** The bar's date, as YYYY-MM-DD. */
  date: string;
  /** The size of each series, by id, always positive. */
  values: Record<string, number>;
};

/** Room above the tallest bar for the label that rides on it. */
const BAR_TOP = 30;
const BAR_BOTTOM = 28;
const BAR_AXIS = 56;
/** How long the wave of bars takes to cross the chart. */
const BAR_WAVE = 0.28;
/** The space between the parts of a bar. */
const BAR_GAP = 2;
const NET_TAG = 104;

/** A number we can draw: anything else from a bad query counts as nothing. */
const sizeOf = (value: number | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(value, 0) : 0;

export type DivergingBarsProps = {
  points: BarPoint[];
  series: BarSeries[];
  /** Names the chart for screen readers, e.g. "MRR movements, last 12 months". */
  label: string;
  /** Changes when the data means something else. The bars rise again. */
  seriesKey: string;
  /** The picked bar's date. */
  selected?: string | null;
  /** Called with a date on click or Enter. */
  onSelect?: (date: string) => void;
  formatValue: (value: number) => string;
  /** The same value with its sign: +$2,400. */
  formatSigned: (value: number) => string;
  formatAxis: (value: number) => string;
  /** A full date, for the tooltip. */
  formatDate: (date: string) => string;
  /** A short date, for the axis. */
  formatTick: (date: string, index: number) => string;
  height?: number;
  className?: string;
};

/**
 * Gains above zero and losses below it, one bar per period, with the picked one
 * at full strength. Hover or use the arrow keys to read a bar and its net.
 * Click or press Enter to pick it.
 */
export function DivergingBars({
  points,
  series,
  label,
  seriesKey,
  selected = null,
  onSelect,
  formatValue,
  formatSigned,
  formatAxis,
  formatDate,
  formatTick,
  height = 304,
  className,
}: DivergingBarsProps) {
  const reduce = useReducedMotion() ?? false;
  const [boxRef, width] = useWidth<HTMLDivElement>();
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const [hover, setHover] = React.useState<number | null>(null);
  const [keyed, setKeyed] = React.useState<number | null>(null);

  const ups = series.filter((s) => s.direction === "up");
  const downs = series.filter((s) => s.direction === "down");
  const bars = points.map((point) => {
    const up = ups.reduce((sum, s) => sum + sizeOf(point.values[s.id]), 0);
    const down = downs.reduce((sum, s) => sum + sizeOf(point.values[s.id]), 0);
    return { date: point.date, values: point.values, up, down, net: up - down };
  });

  const count = bars.length;
  const plotW = Math.max(width - BAR_AXIS, 1);
  const plotH = height - BAR_TOP - BAR_BOTTOM;
  // The tightest round axis, so the bars use the height they're given.
  const extremes = bars.flatMap((bar) => [bar.up, -bar.down]);
  const scale = [4, 5, 6, 7]
    .map((ticks) => niceScale(extremes, { count: ticks }))
    .reduce((best, next) =>
      next.max - next.min < best.max - best.min ? next : best,
    );
  const span = scale.max - scale.min || 1;
  const toPx = (size: number) => (size / span) * plotH;
  const zero = BAR_TOP + toPx(scale.max);
  const y = (value: number) => zero - toPx(value);
  const slot = count ? plotW / count : plotW;
  const barWidth = Math.max(Math.min(slot * 0.5, 34), 3);
  const centerOf = (i: number) => (i + 0.5) * slot;

  const active = hover ?? keyed;
  const activeBar = active !== null ? bars[active] : undefined;
  const pickedAt = selected ? bars.findIndex((b) => b.date === selected) : -1;
  const ticks = labelIndexes(count, Math.max(plotW / 44, 3));

  const indexAt = (clientX: number, element: HTMLElement) => {
    const box = element.getBoundingClientRect();
    return Math.max(
      0,
      Math.min(count - 1, Math.floor((clientX - box.left) / slot)),
    );
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!count) return;
    const at = keyed ?? (pickedAt >= 0 ? pickedAt : count - 1);
    const moves: Record<string, number> = {
      ArrowLeft: at - 1,
      ArrowRight: at + 1,
      Home: 0,
      End: count - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      setKeyed(Math.max(0, Math.min(count - 1, moves[event.key])));
    } else if ((event.key === "Enter" || event.key === " ") && keyed !== null) {
      event.preventDefault();
      const date = bars[keyed]?.date;
      if (date) onSelect?.(date);
    } else if (event.key === "Escape") {
      setKeyed(null);
    }
  };

  const tipWidth = 176;
  const tipLeft = active !== null ? centerOf(active) : 0;
  const tipOnLeft = tipLeft + barWidth / 2 + 8 + tipWidth > plotW;

  return (
    <div className={cn("relative min-w-0", className)}>
      <div
        ref={boxRef}
        role="group"
        tabIndex={0}
        aria-label={`${label}. Use the left and right arrow keys to read each bar, and Enter to pick one.`}
        aria-describedby={`${id}-table`}
        onKeyDown={onKeyDown}
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible"))
            setKeyed(pickedAt >= 0 ? pickedAt : count - 1);
        }}
        onBlur={() => setKeyed(null)}
        onPointerMove={(event) =>
          setHover(indexAt(event.clientX, event.currentTarget))
        }
        onPointerLeave={() => setHover(null)}
        onClick={(event) => {
          const date = bars[indexAt(event.clientX, event.currentTarget)]?.date;
          if (date) onSelect?.(date);
        }}
        style={{ height }}
        className="relative cursor-pointer touch-pan-y rounded-[var(--r-control,10px)] outline-none select-none focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_oklab,var(--foreground)_14%,transparent)]"
      >
        {width > 0 ? (
          <>
            <svg
              aria-hidden
              width={width}
              height={height}
              className="pointer-events-none absolute inset-0 block overflow-visible"
            >
              {scale.ticks.map((tick, i) => (
                <line
                  key={i}
                  x1={0}
                  x2={plotW}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke="currentColor"
                  className={
                    tick === 0
                      ? "text-foreground/25 dark:text-foreground/35"
                      : "text-foreground/[0.055] dark:text-foreground/[0.09]"
                  }
                />
              ))}
                              {scale.ticks.map((tick, i) => (
                  <motion.text
                    key={`${i}-${formatAxis(tick)}`}
                    x={plotW + 10}
                    y={y(tick)}
                    dy="0.32em"
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: 1,
                      transition: {
                        duration: reduce ? 0 : 0.4,
                        delay: reduce ? 0 : 0.14,
                      },
                    }}
                    className="fill-foreground/45 text-[11.5px] tabular-nums dark:fill-foreground/60"
                  >
                    {formatAxis(tick)}
                  </motion.text>
                ))}
                              {ticks.map((i) => (
                  <motion.text
                    key={bars[i].date}
                    x={centerOf(i)}
                    y={height - 8}
                    textAnchor="middle"
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: 1,
                      transition: {
                        duration: reduce ? 0 : 0.4,
                        delay: reduce ? 0 : 0.14,
                      },
                    }}
                    className={cn(
                      "text-[11.5px] tabular-nums transition-[fill] duration-200",
                      i === pickedAt
                        ? "fill-foreground"
                        : "fill-foreground/45 dark:fill-foreground/60",
                    )}
                  >
                    {formatTick(bars[i].date, i)}
                  </motion.text>
                ))}
            </svg>

            {/* New data rises from the zero line as a wave, left to right. */}
            <AnimatePresence initial={false}>
              <motion.div
                key={seriesKey}
                aria-hidden
                exit={{
                  opacity: 0,
                  transition: { duration: reduce ? 0 : 0.14 },
                }}
                className="pointer-events-none absolute inset-0"
              >
                {bars.map((bar, i) => {
                  const delay =
                    reduce || count < 2
                      ? 0
                      : 0.08 + (i / (count - 1)) * BAR_WAVE;
                  const left = centerOf(i) - barWidth / 2;
                  const rise = {
                    initial: { scaleY: reduce ? 1 : 0 },
                    animate: { scaleY: 1 },
                    transition: {
                      duration: reduce ? 0 : 0.6,
                      ease: TRAVEL,
                      delay,
                    },
                  };
                  // Only the month in focus is at full strength, so it can be read at a glance.
                  const lit = pickedAt < 0 || i === pickedAt || i === active;
                  const stack = (group: BarSeries[], edge: "bottom" | "top") => {
                    let used = 0;
                    return group.map((s) => {
                      const size = toPx(sizeOf(bar.values[s.id]));
                      const at = used;
                      used += size;
                      if (size <= 0) return null;
                      return (
                        <span
                          key={s.id}
                          style={{
                            [edge]: at,
                            height: Math.max(size - BAR_GAP, 1),
                            background: s.color,
                          }}
                          className="absolute inset-x-0 block rounded-[3px]"
                        />
                      );
                    });
                  };
                  return (
                    <div
                      key={bar.date}
                      className={cn(
                        "absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none",
                        lit ? "opacity-100" : "opacity-[0.38] dark:opacity-[0.42]",
                      )}
                    >
                      <motion.div
                        {...rise}
                        style={{
                          left,
                          width: barWidth,
                          top: zero - toPx(bar.up) - 1,
                          height: toPx(bar.up),
                        }}
                        className="absolute origin-bottom"
                      >
                        {stack(ups, "bottom")}
                      </motion.div>
                      <motion.div
                        {...rise}
                        style={{
                          left,
                          width: barWidth,
                          top: zero + BAR_GAP,
                          height: toPx(bar.down),
                        }}
                        className="absolute origin-top"
                      >
                        {stack(downs, "top")}
                      </motion.div>
                    </div>
                  );
                })}
              </motion.div>
            </AnimatePresence>

            {/* The picked month's net, riding above its bar. The tooltip says the same, so it steps aside. */}
            {pickedAt >= 0 ? (
              <motion.div
                key={seriesKey}
                aria-hidden
                initial={{ opacity: reduce ? 1 : 0 }}
                animate={{ opacity: activeBar ? 0 : 1 }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : activeBar
                      ? { duration: 0.12 }
                      : { duration: 0.3, delay: 0.1 }
                }
                style={{
                  width: NET_TAG,
                  transform: `translate(${Math.max(
                    0,
                    Math.min(plotW - NET_TAG, centerOf(pickedAt) - NET_TAG / 2),
                  )}px, ${Math.max(zero - toPx(bars[pickedAt].up) - 24, 0)}px)`,
                  transition: reduce
                    ? undefined
                    : "transform 420ms cubic-bezier(0.65,0,0.35,1)",
                }}
                className="pointer-events-none absolute top-0 left-0 text-center text-[12px] leading-[18px] font-medium whitespace-nowrap tabular-nums"
              >
                <span className="rounded-[4px] bg-(--background) px-1 py-px">
                  {formatSigned(bars[pickedAt].net)} net
                </span>
              </motion.div>
            ) : null}
          </>
        ) : null}

        {activeBar ? (
          <div
            aria-hidden
            style={{
              width: tipWidth,
              transform: `translateX(${
                tipOnLeft
                  ? tipLeft - barWidth / 2 - 8 - tipWidth
                  : tipLeft + barWidth / 2 + 8
              }px)`,
            }}
            className="pointer-events-none absolute top-2 left-0 rounded-[var(--r-control,10px)] bg-(--st-pop) px-3 py-2 text-[12.5px] shadow-[0_0_0_1px_rgba(0,0,0,0.07),0_2px_4px_rgba(0,0,0,0.05),0_12px_28px_-14px_rgba(0,0,0,0.3)] transition-transform duration-100 ease-out dark:shadow-[0_0_0_1px_rgba(255,255,255,0.09),0_12px_28px_-14px_rgba(0,0,0,0.8)]"
          >
            <p className="truncate text-foreground/55">
              {formatDate(activeBar.date)}
            </p>
            <p className="mt-1 flex justify-between gap-2">
              <span className="text-foreground/60">Added</span>
              <span className="tabular-nums">{formatValue(activeBar.up)}</span>
            </p>
            <p className="mt-0.5 flex justify-between gap-2">
              <span className="text-foreground/60">Lost</span>
              <span className="tabular-nums">
                {formatValue(activeBar.down)}
              </span>
            </p>
            <p className="mt-0.5 flex justify-between gap-2 font-semibold">
              <span>Net</span>
              <span className="tabular-nums">
                {formatSigned(activeBar.net)}
              </span>
            </p>
          </div>
        ) : null}
      </div>

      <p aria-live="polite" className="sr-only">
        {keyed !== null && bars[keyed]
          ? `${formatDate(bars[keyed].date)}: net ${formatSigned(bars[keyed].net)}`
          : ""}
      </p>
      <table id={`${id}-table`} className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            {series.map((s) => (
              <th key={s.id} scope="col">
                {s.label}
              </th>
            ))}
            <th scope="col">Net</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((bar) => (
            <tr key={bar.date}>
              <th scope="row">{formatDate(bar.date)}</th>
              {series.map((s) => (
                <td key={s.id}>{formatValue(sizeOf(bar.values[s.id]))}</td>
              ))}
              <td>{formatSigned(bar.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stacked areas                                                      */
/* ------------------------------------------------------------------ */

export type StackSeries = { id: string; label: string; color: string };

/**
 * Several series stacked over time, so the top edge is their total. Hover to read
 * every series on a day. Pass `focus` to bring one series forward and fade the
 * rest, e.g. while its name is hovered in a legend.
 */
export function StackedAreaChart({
  points,
  series,
  label,
  seriesKey,
  focus = null,
  formatValue,
  formatAxis,
  formatDate,
  formatTick,
  height = 232,
  className,
}: {
  points: { date: string; values: Record<string, number> }[];
  series: StackSeries[];
  label: string;
  /** Changes when the data means something else. The chart wipes in again. */
  seriesKey: string;
  focus?: string | null;
  formatValue: (value: number) => string;
  formatAxis: (value: number) => string;
  formatDate: (date: string) => string;
  formatTick: (date: string) => string;
  height?: number;
  className?: string;
}) {
  const reduce = useReducedMotion() ?? false;
  const [boxRef, width] = useWidth<HTMLDivElement>();
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const [hover, setHover] = React.useState<number | null>(null);
  const size = (value: number | undefined) =>
    typeof value === "number" && Number.isFinite(value) ? Math.max(value, 0) : 0;

  const count = points.length;
  const plotW = Math.max(width - AXIS, 1);
  const plotH = height - TOP - BOTTOM;
  const totals = points.map((p) =>
    series.reduce((sum, s) => sum + size(p.values[s.id]), 0),
  );
  const scale = niceScale(totals, { zeroBased: true });
  const x = (i: number) => (count <= 1 ? plotW / 2 : (i / (count - 1)) * plotW);
  const y = (v: number) =>
    TOP + (1 - (v - scale.min) / (scale.max - scale.min || 1)) * plotH;

  // Each layer sits on the ones before it.
  const below = points.map(() => 0);
  const layers = series.map((s) => {
    const lower = [...below];
    const upper = points.map((p, i) => {
      below[i] += size(p.values[s.id]);
      return below[i];
    });
    const top = upper.map((v, i) => `${x(i).toFixed(1)} ${y(v).toFixed(1)}`);
    const bottom = lower
      .map((v, i) => `${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
      .reverse();
    return {
      ...s,
      line: count ? `M${top.join("L")}` : "",
      area: count ? `M${top.join("L")}L${bottom.join("L")}Z` : "",
    };
  });
  const ticks = labelIndexes(count, Math.max(plotW / 84, 3));
  const active = hover !== null ? points[hover] : undefined;
  const tipLeft = hover !== null ? x(hover) : 0;
  const tipOnLeft = tipLeft + 208 > plotW;

  return (
    <div className={cn("relative min-w-0", className)}>
      <div
        ref={boxRef}
        role="group"
        tabIndex={0}
        aria-label={`${label}. Use the left and right arrow keys to read each day.`}
        aria-describedby={`${id}-table`}
        onKeyDown={(event) => {
          if (!count) return;
          const at = hover ?? count - 1;
          const moves: Record<string, number> = {
            ArrowLeft: at - 1,
            ArrowRight: at + 1,
            Home: 0,
            End: count - 1,
          };
          if (event.key in moves) {
            event.preventDefault();
            setHover(Math.max(0, Math.min(count - 1, moves[event.key])));
          } else if (event.key === "Escape") setHover(null);
        }}
        onBlur={() => setHover(null)}
        onPointerMove={(event) => {
          if (count < 1) return;
          const box = event.currentTarget.getBoundingClientRect();
          const at = Math.round(((event.clientX - box.left) / plotW) * (count - 1));
          setHover(Math.max(0, Math.min(count - 1, at)));
        }}
        onPointerLeave={() => setHover(null)}
        style={{ height }}
        className="relative cursor-crosshair touch-pan-y rounded-[var(--r-control,10px)] outline-none select-none focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_oklab,var(--foreground)_14%,transparent)]"
      >
        {width > 0 ? (
          <svg
            aria-hidden
            width={width}
            height={height}
            className="absolute inset-0 block overflow-visible"
          >
            {scale.ticks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={0}
                  x2={plotW}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke="currentColor"
                  className="text-foreground/[0.07] dark:text-foreground/[0.11]"
                />
                <text
                  x={plotW + 10}
                  y={y(tick)}
                  dy="0.32em"
                  className="fill-foreground/45 text-[11.5px] tabular-nums dark:fill-foreground/60"
                >
                  {formatAxis(tick)}
                </text>
              </g>
            ))}
            {ticks.map((i) => (
              <text
                key={`${points[i].date}-${i}`}
                x={x(i)}
                y={height - 8}
                textAnchor={
                  i === count - 1 && count > 1
                    ? "end"
                    : i === 0 && count > 1
                      ? "start"
                      : "middle"
                }
                className="fill-foreground/45 text-[11.5px] tabular-nums dark:fill-foreground/60"
              >
                {formatTick(points[i].date)}
              </text>
            ))}
            <AnimatePresence initial={false}>
              <motion.g
                key={seriesKey}
                initial={{ opacity: reduce ? 1 : 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.3 }}
              >
                {layers.map((layer) => (
                  <g
                    key={layer.id}
                    style={{
                      opacity: focus && focus !== layer.id ? 0.28 : 1,
                      transition: reduce ? undefined : "opacity 200ms",
                    }}
                  >
                    <path d={layer.area} fill={layer.color} fillOpacity={0.82} />
                    <path
                      d={layer.line}
                      fill="none"
                      stroke="var(--dash-panel)"
                      strokeWidth={1}
                      strokeLinejoin="round"
                    />
                  </g>
                ))}
              </motion.g>
            </AnimatePresence>
            {hover !== null ? (
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={TOP}
                y2={height - BOTTOM}
                stroke="currentColor"
                className="text-foreground/40"
              />
            ) : null}
          </svg>
        ) : null}

        {active ? (
          <div
            aria-hidden
            style={{
              transform: `translateX(${tipOnLeft ? tipLeft - 196 : tipLeft + 12}px)`,
            }}
            className="pointer-events-none absolute top-1 left-0 w-[184px] rounded-[var(--r-control,10px)] bg-(--st-pop) px-3 py-2 text-[12.5px] shadow-[0_0_0_1px_rgba(0,0,0,0.07),0_2px_4px_rgba(0,0,0,0.05),0_12px_28px_-14px_rgba(0,0,0,0.3)] transition-transform duration-100 ease-out dark:shadow-[0_0_0_1px_rgba(255,255,255,0.09),0_12px_28px_-14px_rgba(0,0,0,0.8)]"
          >
            <p className="mb-1 truncate text-foreground/55">
              {formatDate(active.date)}
            </p>
            {[...series].reverse().map((s) => (
              <p key={s.id} className="flex items-center gap-2 leading-[19px]">
                <span
                  className="size-2 shrink-0 rounded-[3px]"
                  style={{ background: s.color }}
                />
                <span className="min-w-0 flex-1 truncate text-foreground/70">
                  {s.label}
                </span>
                <span className="font-medium tabular-nums">
                  {formatValue(size(active.values[s.id]))}
                </span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
      <table id={`${id}-table`} className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            {series.map((s) => (
              <th key={s.id} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={`${p.date}-${i}`}>
              <th scope="row">{formatDate(p.date)}</th>
              {series.map((s) => (
                <td key={s.id}>{formatValue(size(p.values[s.id]))}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hour heatmap                                                       */
/* ------------------------------------------------------------------ */

/**
 * A week by the hour, in greys, with the busiest hour in the accent. A line
 * above names the busiest hour, or the hour under the pointer.
 */
export function HourHeatmap({
  values,
  days,
  formatHour,
  formatValue,
  unit,
  className,
}: {
  /** Seven rows of 24 values. */
  values: number[][];
  /** The name of each row. */
  days: string[];
  /** Names an hour from 0 to 23. */
  formatHour: (hour: number) => string;
  formatValue: (value: number) => string;
  /** What the values count, e.g. "visitors". */
  unit: string;
  className?: string;
}) {
  const [hover, setHover] = React.useState<[number, number] | null>(null);
  const size = (value: number | undefined) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(value, 0)
      : 0;
  const hours = Array.from({ length: 24 }, (_, hour) => hour);
  let peak: [number, number] = [0, 0];
  let high = 0;
  values.forEach((row, day) =>
    hours.forEach((hour) => {
      if (size(row[hour]) > high) {
        high = size(row[hour]);
        peak = [day, hour];
      }
    }),
  );
  const shown = hover ?? peak;
  const shownValue = size(values[shown[0]]?.[shown[1]]);

  return (
    <div className={cn("min-w-0", className)}>
      <p className="mb-3 text-[13px] leading-5 tabular-nums">
        <span className="text-foreground/60 dark:text-foreground/65">
          {hover ? "" : "Busiest: "}
        </span>
        <span className="font-medium">
          {days[shown[0]]}, {formatHour(shown[1])}
        </span>
        <span className="text-foreground/60 dark:text-foreground/65">
          {" "}
          with {formatValue(shownValue)} {unit}
        </span>
      </p>
      <div
        role="img"
        aria-label={`${unit} by weekday and hour. Busiest: ${days[peak[0]]}, ${formatHour(peak[1])}, with ${formatValue(high)}.`}
        onPointerLeave={() => setHover(null)}
        className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-2 gap-y-0.5"
      >
        {values.map((row, day) => (
          <React.Fragment key={day}>
            <span className="flex h-(--heat,22px) items-center text-[11.5px] text-foreground/50 dark:text-foreground/60">
              {days[day]}
            </span>
            <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-0.5">
              {hours.map((hour) => {
                const isPeak =
                  high > 0 && day === peak[0] && hour === peak[1];
                const strength = high > 0 ? size(row[hour]) / high : 0;
                return (
                  <span
                    key={hour}
                    onPointerEnter={() => setHover([day, hour])}
                    style={{
                      background: isPeak
                        ? "var(--dash-1)"
                        : `color-mix(in oklab, var(--foreground) ${(4 + strength * 44).toFixed(1)}%, var(--dash-panel))`,
                    }}
                    className={cn(
                      "h-(--heat,22px) rounded-[3px] transition-[background-color] duration-300 motion-reduce:transition-none",
                      hover?.[0] === day &&
                        hover[1] === hour &&
                        "outline-[1.5px] -outline-offset-[1.5px] outline-foreground/60",
                    )}
                  />
                );
              })}
            </div>
          </React.Fragment>
        ))}
        <span />
        <div
          aria-hidden
          className="mt-1 grid grid-cols-[repeat(24,minmax(0,1fr))] gap-0.5 text-[11.5px] text-foreground/50 tabular-nums dark:text-foreground/60"
        >
          {[0, 6, 12, 18].map((hour) => (
            <span key={hour} style={{ gridColumnStart: hour + 1, gridColumnEnd: "span 6" }}>
              {formatHour(hour)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Segmented bar                                                      */
/* ------------------------------------------------------------------ */

export type Segment = {
  id: string;
  label: string;
  value: number;
  color: string;
};

/** One whole split into parts. A part at zero draws nothing. */
export function SegmentedBar({
  parts,
  className,
}: {
  parts: Segment[];
  className?: string;
}) {
  const total = parts.reduce((sum, part) => sum + Math.max(part.value, 0), 0);
  return (
    <div
      aria-hidden
      className={cn(
        "flex h-2 w-full gap-0.5 overflow-hidden rounded-full",
        total === 0 && "bg-foreground/[0.06]",
        className,
      )}
    >
      {total > 0
        ? parts.map((part) => (
            <span
              key={part.id}
              title={part.label}
              style={{
                flexGrow: Math.max(part.value, 0),
                flexBasis: 0,
                background: part.color,
                display: part.value > 0 ? undefined : "none",
              }}
              className="min-w-0.5 transition-[flex-grow] duration-500 ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none"
            />
          ))
        : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Meter                                                              */
/* ------------------------------------------------------------------ */

/** How far along something is, with an optional tick for where it should be by now. */
export function Meter({
  value,
  pace,
  color = "var(--dash-1)",
  className,
}: {
  /** From 0 to 1. Anything above 1 fills the track. */
  value: number;
  /** From 0 to 1: where it should be by now. */
  pace?: number;
  color?: string;
  className?: string;
}) {
  const reduce = useReducedMotion() ?? false;
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  return (
    <div
      aria-hidden
      className={cn(
        "relative h-1.5 w-full rounded-[var(--r-bar,9999px)] bg-foreground/[0.07] dark:bg-foreground/[0.12]",
        className,
      )}
    >
      <div className="absolute inset-0 overflow-hidden rounded-[var(--r-bar,9999px)]">
        <motion.div
          initial={false}
          animate={{ scaleX: safe }}
          transition={
            reduce ? { duration: 0 } : { duration: 0.6, ease: TRAVEL }
          }
          style={{ background: color }}
          className="h-full origin-left rounded-[var(--r-bar,9999px)]"
        />
      </div>
      {pace !== undefined && Number.isFinite(pace) ? (
        <span
          style={{ left: `${Math.max(0, Math.min(1, pace)) * 100}%` }}
          className="absolute -top-[3px] h-3 w-0.5 -translate-x-1/2 rounded-full bg-foreground/55 shadow-[0_0_0_2px_var(--background)]"
        />
      ) : null}
    </div>
  );
}
