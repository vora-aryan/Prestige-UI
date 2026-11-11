"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BarChart3,
  Download,
  FileText,
  House,
  Settings,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/prestigeui/prestige-brand";
import { Button, Select, ring } from "@/components/prestigeui/settings-ui";
import {
  DataTable,
  StatusBadge,
  downloadFile,
  toCsv,
  type Column,
} from "@/components/prestigeui/table-ui";
import type { SidebarUser } from "@/components/prestigeui/sidebar-ui";
import {
  Meter,
  SegmentedBar,
  TimeChart,
} from "@/components/prestigeui/dashboard-charts";
import {
  Delta,
  DashboardShell,
  Panel,
  PanelEmpty,
  PanelError,
  Placeholder,
  categoryColor,
  changeBetween,
  createFormatters,
  dashboardThemes,
  dashboardVars,
  panelSurface,
  type DashboardNavItem,
  type DashboardTheme,
  type Formatters,
} from "@/components/prestigeui/dashboard-ui";
import {
  DEFAULT_RANGES,
  sampleOverview,
  type OverviewActivity,
  type OverviewData,
  type OverviewGoal,
  type OverviewMetric,
  type OverviewPoint,
  type OverviewRange,
} from "@/components/prestigeui/dashboard-overview.data";

const EASE = [0.16, 1, 0.3, 1] as const;

/* ------------------------------------------------------------------ */
/*  Working out the numbers                                            */
/* ------------------------------------------------------------------ */

function combine(
  values: (number | null | undefined)[],
  aggregate: OverviewMetric["aggregate"],
) {
  const known = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  if (!known.length) return null;
  const total = known.reduce((sum, value) => sum + value, 0);
  return aggregate === "sum" ? total : total / known.length;
}

function headline(metric: OverviewMetric) {
  const current = combine(
    metric.points.map((p) => p.value),
    metric.aggregate,
  );
  const previous = combine(
    metric.points.map((p) => p.previous),
    metric.aggregate,
  );
  return { current, previous, change: changeBetween(current, previous) };
}

/** The metric's parts over some points, keeping the metric's order so colors never move. */
function partsOver(metric: OverviewMetric, points: OverviewPoint[]) {
  return (metric.parts ?? []).map((part, index) => ({
    ...part,
    color: categoryColor(index),
    value:
      combine(
        points.map((p) => p.parts?.[part.id]),
        metric.aggregate,
      ) ?? 0,
  }));
}

/** One plain sentence on what's happening with the metric on show. */
function summarize(
  metric: OverviewMetric,
  data: OverviewData,
  format: Formatters,
) {
  const { current, change } = headline(metric);
  if (current === null)
    return `No ${metric.label.toLowerCase()} data for this period yet.`;
  const compared =
    data.previousLabel.charAt(0).toLowerCase() + data.previousLabel.slice(1);
  const lead =
    metric.aggregate === "sum"
      ? [...partsOver(metric, metric.points)].sort(
          (a, b) => b.value - a.value,
        )[0]
      : undefined;
  const led = lead && lead.value > 0 ? `, led by ${lead.label}` : "";
  if (change === null)
    return `${metric.label}: ${format.value(current, metric.format)} for this period${led}.`;
  if (Math.abs(change) < 0.0005)
    return `${metric.label} level with the ${compared}${led}.`;
  const size = format.delta(Math.abs(change)).replace(/^\+/, "");
  return `${metric.label} ${change > 0 ? "up" : "down"} ${size} compared with the ${compared}${led}.`;
}

/* ------------------------------------------------------------------ */
/*  Metric tabs                                                        */
/* ------------------------------------------------------------------ */

function MetricTabs({
  metrics,
  activeId,
  onChange,
  panelId,
  format,
}: {
  metrics: OverviewMetric[];
  activeId: string;
  onChange: (id: string) => void;
  panelId: string;
  format: Formatters;
}) {
  const layoutId = React.useId();
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const at = metrics.findIndex((metric) => metric.id === activeId);
    const next =
      metrics[(at + moves[event.key] + metrics.length) % metrics.length];
    onChange(next.id);
    event.currentTarget
      .querySelector<HTMLElement>(`[data-metric="${next.id}"]`)
      ?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label="Metrics"
      onKeyDown={onKeyDown}
      className="grid grid-cols-2 border-b border-(--dash-line-soft) @[720px]/page:grid-cols-[repeat(var(--count),minmax(0,1fr))] @[820px]/page:grid-cols-[repeat(var(--rest),minmax(0,1fr))_299px]"
      style={
        {
          "--count": metrics.length,
          "--rest": metrics.length - 1,
        } as React.CSSProperties
      }
    >
      {metrics.map((metric, index) => {
        const active = metric.id === activeId;
        const { current, change } = headline(metric);
        return (
          <button
            key={metric.id}
            type="button"
            role="tab"
            data-metric={metric.id}
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(metric.id)}
            className={cn(
              "relative min-w-0 cursor-pointer px-4 py-3.5 text-left transition-colors duration-150",
              metrics.length % 2 === 1 &&
                index === metrics.length - 1 &&
                "col-span-2 @[720px]/page:col-span-1",
              // Hairlines between cells, in both the 2x2 and the single row.
              index % 2 === 1 && "border-l border-(--dash-line-soft)",
              index >= 2 &&
                "border-t border-(--dash-line-soft) @[720px]/page:border-t-0",
              index % 2 === 0 &&
                index > 0 &&
                "border-(--dash-line-soft) @[720px]/page:border-l",
              active
                ? "bg-(--dash-panel)"
                : "bg-(--dash-recess) hover:bg-[color-mix(in_oklab,var(--foreground)_3%,var(--dash-recess))]",
              "outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-[color-mix(in_oklab,var(--foreground)_14%,transparent)]",
            )}
          >
            {active ? (
              <motion.span
                layoutId={layoutId}
                transition={{ type: "spring", bounce: 0, duration: 0.35 }}
                className="absolute inset-x-0 -bottom-px z-10 h-0.5 bg-(--dash-1)"
              />
            ) : null}
            <span
              className={cn(
                "block truncate text-[13px] transition-colors duration-150",
                active
                  ? "text-foreground"
                  : "text-foreground/60 dark:text-foreground/65",
              )}
            >
              {metric.label}
            </span>
            <span
              title={
                current === null
                  ? undefined
                  : format.value(current, metric.format)
              }
              className="mt-1 block truncate text-[22px] leading-7 font-semibold tracking-[-0.02em]"
            >
              {current === null ? "—" : format.headline(current, metric.format)}
            </span>
            <span className="mt-0.5 block h-5 truncate">
              <Delta
                value={change}
                goodWhen={metric.goodWhen}
                format={format.delta}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Breakdown                                                          */
/* ------------------------------------------------------------------ */

/** For a metric with no parts: its range over the period, or one point against its previous value. */
function facts(
  metric: OverviewMetric,
  picked: OverviewPoint | undefined,
  format: Formatters,
) {
  const show = (value: number | null | undefined) =>
    typeof value === "number" ? format.value(value, metric.format) : "—";
  if (picked) {
    const change = changeBetween(picked.value, picked.previous ?? null);
    return [
      { label: metric.label, value: show(picked.value) },
      { label: "Previous period", value: show(picked.previous) },
      { label: "Change", value: change === null ? "—" : format.delta(change) },
    ];
  }
  const known = metric.points.filter(
    (p): p is OverviewPoint & { value: number } => typeof p.value === "number",
  );
  const high = known.reduce<(typeof known)[number] | undefined>(
    (best, p) => (!best || p.value > best.value ? p : best),
    undefined,
  );
  const low = known.reduce<(typeof known)[number] | undefined>(
    (best, p) => (!best || p.value < best.value ? p : best),
    undefined,
  );
  return [
    {
      label: metric.aggregate === "sum" ? "Total" : "Average",
      value: show(
        combine(
          known.map((p) => p.value),
          metric.aggregate,
        ),
      ),
    },
    {
      label: "Highest",
      note: high ? format.day(high.date) : undefined,
      value: show(high?.value),
    },
    {
      label: "Lowest",
      note: low ? format.day(low.date) : undefined,
      value: show(low?.value),
    },
  ];
}

/**
 * What made up the metric, over the whole period or for the picked day. Every
 * row is always there, so picking a day changes numbers and moves nothing.
 */
function Breakdown({
  metric,
  data,
  pickedDate,
  onClear,
  format,
}: {
  metric: OverviewMetric;
  data: OverviewData;
  pickedDate: string | null;
  onClear: () => void;
  format: Formatters;
}) {
  const picked = pickedDate
    ? metric.points.find((p) => p.date === pickedDate)
    : undefined;
  const parts = partsOver(metric, picked ? [picked] : metric.points);
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  const heading = picked
    ? data.bucket === "week"
      ? `Week of ${format.day(picked.date)}`
      : format.day(picked.date)
    : data.periodLabel;

  return (
    <div className="flex h-full min-w-0 flex-col p-4">
      <div className="flex h-7 items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-[13.5px] font-medium">
          {metric.parts?.length
            ? (metric.partsLabel ?? "Breakdown")
            : "Summary"}
        </h3>
        <span className="flex min-w-0 items-center gap-1 text-[13px] text-foreground/55">
          <span className="truncate tabular-nums">{heading}</span>
          {picked ? (
            <button
              type="button"
              aria-label="Back to the whole period"
              onClick={onClear}
              className={cn(
                "-mr-1 grid size-6 shrink-0 cursor-pointer place-items-center rounded-[7px] transition-colors duration-150 hover:bg-foreground/[0.06] hover:text-foreground",
                ring,
              )}
            >
              <X className="size-3.5" strokeWidth={2.2} />
            </button>
          ) : null}
        </span>
      </div>

      <div className="relative grid min-h-[196px] flex-1">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={metric.id}
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { duration: 0.4, ease: EASE, delay: 0.1 },
            }}
            exit={{ opacity: 0, transition: { duration: 0.14 } }}
            className="col-start-1 row-start-1 min-w-0"
          >
            {parts.length ? (
              <>
                {metric.aggregate === "sum" ? (
                  <SegmentedBar parts={parts} className="mt-3" />
                ) : null}
                <ul className="mt-3 flex flex-col">
                  {parts.map((part) => (
                    <li
                      key={part.id}
                      className="flex h-10 items-center gap-2.5 border-b border-(--dash-line-soft) text-[13px] last:border-b-0"
                    >
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-[3px]"
                        style={{ background: part.color }}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {part.label}
                      </span>
                      <span className="font-medium tabular-nums">
                        {format.value(part.value, metric.format)}
                      </span>
                      <span className="w-11 shrink-0 text-right text-foreground/50 tabular-nums">
                        {metric.aggregate === "sum" && total > 0
                          ? `${Math.round((part.value / total) * 100)}%`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <ul className="mt-3 flex flex-col">
                  {facts(metric, picked, format).map((fact) => (
                    <li
                      key={fact.label}
                      className="flex h-10 items-center gap-2.5 border-b border-(--dash-line-soft) text-[13px] last:border-b-0"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {fact.label}
                      </span>
                      {fact.note ? (
                        <span className="text-foreground/50 tabular-nums">
                          {fact.note}
                        </span>
                      ) : null}
                      <span className="font-medium tabular-nums">
                        {fact.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      {metric.points.length ? (
        <p className="pt-3 text-[12.5px] text-pretty text-foreground/50 dark:text-foreground/60">
          {picked
            ? "Click the day again to clear it."
            : "Click a point on the chart to see just that day."}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Goals                                                              */
/* ------------------------------------------------------------------ */

function Goals({
  goals,
  format,
}: {
  goals: OverviewGoal[];
  format: Formatters;
}) {
  if (!goals.length)
    return (
      <PanelEmpty title="No goals yet" detail="Goals you set will show here." />
    );
  return (
    <>
      <ul className="flex flex-col">
        {goals.map((goal) => {
          const progress = goal.target > 0 ? goal.value / goal.target : 0;
          const behind = goal.pace !== undefined && progress < goal.pace - 0.02;
          return (
            <li
              key={goal.id}
              className="border-b border-(--dash-line-soft) px-4 py-3.5 last:border-b-0"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[13px]">
                  {goal.label}
                </span>
                {behind ? (
                  <span className="shrink-0 text-[12.5px] font-medium text-(--dash-down)">
                    Behind pace
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[15px] font-semibold tracking-[-0.01em] tabular-nums">
                {format.value(goal.value, goal.format)}
                <span className="ml-1 text-[13px] font-normal tracking-normal text-foreground/50">
                  of {format.value(goal.target, goal.format)}
                </span>
              </p>
              <Meter value={progress} pace={goal.pace} className="mt-2.5" />
            </li>
          );
        })}
      </ul>
      {goals.some((goal) => goal.pace !== undefined) ? (
        <p className="border-t border-(--dash-line-soft) px-4 py-2.5 text-[12.5px] text-foreground/50 dark:text-foreground/60">
          The tick marks where you should be today.
        </p>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading                                                            */
/* ------------------------------------------------------------------ */

/** The first load: the page's own shape, so nothing moves when the data lands. */
function OverviewPlaceholder() {
  return (
    <div aria-hidden className="grid gap-4">
      <Panel>
        <div className="grid grid-cols-2 border-b border-(--dash-line-soft) @[720px]/page:grid-cols-4 @[820px]/page:grid-cols-[repeat(3,minmax(0,1fr))_299px]">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="px-4 py-3.5">
              <Placeholder className="h-3.5 w-20" />
              <Placeholder className="mt-2.5 h-6 w-28" />
              <Placeholder className="mt-2 h-3.5 w-14" />
            </div>
          ))}
        </div>
        <div className="grid h-[328px] grid-rows-4 px-4 py-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-t border-(--dash-line-soft)" />
          ))}
        </div>
      </Panel>
      <div className="grid min-w-0 items-start gap-4 @[820px]/page:grid-cols-[minmax(0,1fr)_300px]">
        {[6, 3].map((rows) => (
          <div key={rows} className="min-w-0">
            <Placeholder className="mb-3 ml-1 h-3.5 w-28" />
            <Panel>
              {Array.from({ length: rows }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex h-11 items-center px-4",
                    i > 0 && "border-t border-(--dash-line-soft)",
                  )}
                >
                  <Placeholder className="h-3.5 w-2/5" />
                </div>
              ))}
            </Panel>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  The dashboard's content                                            */
/* ------------------------------------------------------------------ */

export type DashboardOverviewProps = {
  /**
   * The data for the chosen range. Leave it out to preview the sample data.
   * The shape is documented in dashboard-overview.data.ts.
   */
  data?: OverviewData;
  /** A new range is loading. Old data stays on screen, dimmed, so nothing jumps. */
  loading?: boolean;
  /** Set when loading failed. Shows the message with a Try again button. */
  error?: string | null;
  /** Called by Try again. */
  onRetry?: () => void;
  /** The chosen range's id. Leave it out and the block keeps track itself. */
  range?: string;
  defaultRange?: string;
  /** Fetch the new range's data here. */
  onRangeChange?: (id: string) => void;
  ranges?: OverviewRange[];
  /** Formats every number and date, e.g. "de-DE". */
  locale?: string;
  /** An ISO currency code, e.g. "EUR". */
  currency?: string;
  /** The page's heading. */
  title?: string;
  /** Called when a row in the recent list is clicked. */
  onActivityClick?: (row: OverviewActivity) => void;
  theme?: DashboardTheme;
  className?: string;
};

/**
 * The Overview page's content, without the app frame. Render it inside your
 * own layout, or use DashboardOverviewPage below for the frame as well.
 */
export function DashboardOverview({
  data: dataProp,
  loading: loadingProp = false,
  error = null,
  onRetry,
  range,
  defaultRange = "30d",
  onRangeChange,
  ranges = DEFAULT_RANGES,
  locale = "en-US",
  currency = "USD",
  title = "Overview",
  onActivityClick,
  theme = "cobalt",
  className,
}: DashboardOverviewProps) {
  const [ownRange, setOwnRange] = React.useState(defaultRange);
  const rangeId = range ?? ownRange;

  // With no data, no fetch running and no error, preview the sample, with a short wait like a real fetch.
  const usesSample = dataProp === undefined && !loadingProp && !error;
  const [sample, setSample] = React.useState(() =>
    usesSample ? sampleOverview(rangeId) : null,
  );
  const [sampleLoading, setSampleLoading] = React.useState(false);
  const sampleTimer = React.useRef(0);
  React.useEffect(() => () => window.clearTimeout(sampleTimer.current), []);

  const chooseRange = (id: string) => {
    if (range === undefined) setOwnRange(id);
    onRangeChange?.(id);
    if (!usesSample) return;
    window.clearTimeout(sampleTimer.current);
    setSampleLoading(true);
    sampleTimer.current = window.setTimeout(() => {
      setSample(sampleOverview(id));
      setSampleLoading(false);
    }, 320);
  };

  const data = dataProp ?? (usesSample ? sample : null);
  const loading = loadingProp || sampleLoading;

  const format = React.useMemo(
    () => createFormatters(locale, currency),
    [locale, currency],
  );
  const [metricId, setMetricId] = React.useState<string | null>(null);
  const [pickedDate, setPickedDate] = React.useState<string | null>(null);
  const metric =
    data?.metrics.find((m) => m.id === metricId) ?? data?.metrics[0];
  const panelId = React.useId();

  const exportCsv = () => {
    if (!metric || !data) return;
    const rows = metric.points.map((p) => [
      p.date,
      p.value ?? "",
      p.previous ?? "",
    ]);
    downloadFile(
      `${metric.id}-${rangeId}.csv`,
      toCsv(["Date", metric.label, data.previousLabel], rows),
    );
  };

  const columns: Column<OverviewActivity>[] = [
    {
      id: "name",
      header: "Customer",
      minWidth: 120,
      cell: (row) => (
        <span className="block truncate font-medium">{row.name}</span>
      ),
      title: (row) => row.name,
    },
    {
      id: "detail",
      header: "Plan",
      minWidth: 140,
      showFrom: "2xl",
      cell: (row) => (
        <span className="block truncate text-foreground/60">{row.detail}</span>
      ),
      title: (row) => row.detail,
    },
    {
      id: "status",
      header: "Status",
      width: 132,
      cell: (row) => (
        <span className="block max-w-full overflow-hidden rounded-[6px]">
          <StatusBadge tone={row.tone}>{row.status}</StatusBadge>
        </span>
      ),
      title: (row) => row.status,
    },
    {
      id: "date",
      header: "Date",
      width: 84,
      showFrom: "xl",
      cell: (row) => (
        <span className="text-foreground/60 tabular-nums">
          {format.day(row.date)}
        </span>
      ),
    },
    {
      id: "amount",
      header: "Amount",
      width: 92,
      align: "end",
      cell: (row) => (
        <span className="block truncate tabular-nums">
          {format.value(row.amount, "currency")}
        </span>
      ),
      title: (row) => format.value(row.amount, "currency"),
    },
  ];

  return (
    <div
      className={cn(
        "@container/page w-full font-sans text-foreground",
        dashboardVars,
        dashboardThemes[theme],
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-4 pt-5 pb-16 @[720px]/page:px-6 @[720px]/page:pt-6">
        {/* Heading: what's going on, and the one control that changes the page */}
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 flex-[1_1_320px]">
            <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.022em]">
              {title}
            </h1>
            <div
              className="relative mt-1 min-h-5 text-[14px] leading-5 text-pretty text-foreground/60"
              aria-live="polite"
            >
              <AnimatePresence initial={false} mode="popLayout">
                <motion.p
                  key={
                    metric && data ? summarize(metric, data, format) : "none"
                  }
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: 1,
                    transition: { duration: 0.35, ease: EASE, delay: 0.06 },
                  }}
                  exit={{ opacity: 0, transition: { duration: 0.14 } }}
                >
                  {metric && data ? summarize(metric, data, format) : " "}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select
              label="Date range"
              value={rangeId}
              options={ranges.map((r) => ({ value: r.id, label: r.label }))}
              onChange={chooseRange}
              className="w-[168px]"
            />
            <Button
              aria-label="Export this chart as a CSV file"
              disabled={!metric?.points.length}
              onClick={exportCsv}
              className="px-3"
            >
              <Download aria-hidden className="size-4" strokeWidth={2} />
              <span className="hidden @[480px]/page:inline">Export</span>
            </Button>
          </div>
        </header>

        {error && !data ? (
          <Panel>
            <PanelError
              className="min-h-[420px]"
              message={error}
              onRetry={onRetry}
            />
          </Panel>
        ) : !data ? (
          <OverviewPlaceholder />
        ) : (
          <div
            aria-busy={loading}
            className={cn(
              "grid gap-4 transition-opacity duration-200",
              loading && "opacity-55",
            )}
          >
            {error ? (
              <Panel>
                <PanelError
                  className="py-5"
                  message={error}
                  onRetry={onRetry}
                />
              </Panel>
            ) : null}

            {/* The main chart with its metrics and breakdown */}
            {data.metrics.length && metric ? (
              <Panel>
                <MetricTabs
                  metrics={data.metrics}
                  activeId={metric.id}
                  onChange={setMetricId}
                  panelId={panelId}
                  format={format}
                />
                <div
                  id={panelId}
                  role="tabpanel"
                  className="grid min-w-0 @[820px]/page:grid-cols-[minmax(0,1fr)_299px]"
                >
                  <div className="min-w-0 p-4 pb-3">
                    <div className="mb-2 flex h-7 items-center gap-x-4 text-[12.5px] text-foreground/60">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span
                          aria-hidden
                          className="h-0.5 w-3.5 shrink-0 rounded-full bg-(--dash-1)"
                        />
                        <span className="truncate">{data.periodLabel}</span>
                      </span>
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span
                          aria-hidden
                          className="w-3.5 shrink-0 border-t-[1.5px] border-dashed border-foreground/35"
                        />
                        <span className="truncate">{data.previousLabel}</span>
                      </span>
                    </div>
                    {metric.points.length ? (
                      <TimeChart
                        points={metric.points}
                        seriesKey={`${metric.id}-${rangeId}`}
                        label={`${metric.label}, ${data.periodLabel.toLowerCase()}`}
                        seriesLabel={metric.label}
                        previousLabel="Previous"
                        selected={pickedDate}
                        onSelect={setPickedDate}
                        formatValue={(value) =>
                          format.value(value, metric.format)
                        }
                        formatAxis={(value) =>
                          format.axis(value, metric.format)
                        }
                        formatDate={format.fullDay}
                        formatTick={format.day}
                      />
                    ) : (
                      <PanelEmpty
                        className="h-[264px]"
                        title={`No ${metric.label.toLowerCase()} yet`}
                        detail="It will show here once there's data for this period."
                      />
                    )}
                  </div>
                  <div className="min-w-0 border-t border-(--dash-line-soft) @[820px]/page:border-t-0 @[820px]/page:border-l">
                    <Breakdown
                      metric={metric}
                      data={data}
                      pickedDate={pickedDate}
                      onClear={() => setPickedDate(null)}
                      format={format}
                    />
                  </div>
                </div>
              </Panel>
            ) : (
              <Panel>
                <PanelEmpty
                  className="min-h-[320px]"
                  title="Nothing to show for this period"
                  detail="Try a longer date range."
                />
              </Panel>
            )}

            {/* What just happened, and where things stand */}
            <div className="grid min-w-0 items-start gap-4 @[820px]/page:grid-cols-[minmax(0,1fr)_300px]">
              <section className="min-w-0">
                <h2 className="mb-2 px-1 text-[14px] font-medium">
                  Recent activity
                </h2>
                {data.activity.length ? (
                  <DataTable
                    label="Recent activity"
                    columns={columns}
                    rows={data.activity}
                    getRowId={(row) => row.id}
                    onRowClick={onActivityClick}
                    className={cn(
                      panelSurface,
                      "dark:[&_td]:border-white/[0.08] dark:[&_th]:border-white/[0.08]",
                    )}
                  />
                ) : (
                  <Panel>
                    <PanelEmpty
                      className="min-h-[220px]"
                      title="No activity yet"
                      detail="New payments will show here."
                    />
                  </Panel>
                )}
              </section>
              <section className="min-w-0">
                <h2 className="mb-2 px-1 text-[14px] font-medium">Goals</h2>
                <Panel>
                  <Goals goals={data.goals} format={format} />
                </Panel>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  With the app frame                                                 */
/* ------------------------------------------------------------------ */

const NAV: DashboardNavItem[] = [
  { id: "overview", label: "Overview", icon: House },
  { id: "customers", label: "Customers", icon: Users },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "invoices", label: "Invoices", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings },
];

const USER: SidebarUser = {
  name: "Lena Ortiz",
  email: "lena@prestigeui.com",
  avatar:
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&crop=faces&w=96&h=96&q=80",
};

export type DashboardOverviewPageProps = DashboardOverviewProps & {
  /** The logo and name at the top of the sidebar. */
  brand?: React.ReactNode;
  nav?: DashboardNavItem[];
  activeNav?: string;
  onNavigate?: (item: DashboardNavItem) => void;
  user?: SidebarUser;
};

/** The Overview page inside the app frame: a sidebar beside it, filling the screen. */
export function DashboardOverviewPage({
  brand = (
    <>
      <BrandMark className="size-6" />
      Prestige UI
    </>
  ),
  nav = NAV,
  activeNav = "overview",
  onNavigate,
  user = USER,
  className,
  ...props
}: DashboardOverviewPageProps) {
  return (
    <DashboardShell
      brand={brand}
      nav={nav}
      activeNav={activeNav}
      onNavigate={onNavigate}
      user={user}
      className={className}
    >
      <DashboardOverview {...props} />
    </DashboardShell>
  );
}

export default DashboardOverviewPage;
