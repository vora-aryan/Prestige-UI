import type { ValueFormat } from "@/components/prestigeui/dashboard-ui";

/*
 * The shape of the Overview dashboard's data, and sample data to preview it.
 *
 * To use your own data: return an OverviewData from your API and pass it to
 * <DashboardOverview data={...} />. You can then delete everything below
 * "Sample data".
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type OverviewPoint = {
  /** A plain day, as YYYY-MM-DD. For weekly data, the first day of the week. */
  date: string;
  /** Null when there's no data for this point. It leaves a gap in the line. */
  value: number | null;
  /** The matching point in the period being compared against. */
  previous?: number | null;
  /** What made up this point, by part id. Used by the breakdown beside the chart. */
  parts?: Record<string, number>;
};

export type OverviewMetric = {
  id: string;
  label: string;
  format: ValueFormat;
  /** How points add up to the headline: revenue is a sum, a rate is an average. */
  aggregate: "sum" | "average";
  /** Which direction is good news. Refunds and churn want "down". */
  goodWhen?: "up" | "down";
  /** Names the breakdown, e.g. "By plan". */
  partsLabel?: string;
  /** The breakdown's rows, in a fixed order. Each keeps its color. Up to 5 are colored. */
  parts?: { id: string; label: string }[];
  points: OverviewPoint[];
};

/** Something to reach, where a higher value is better. */
export type OverviewGoal = {
  id: string;
  label: string;
  value: number;
  target: number;
  format: ValueFormat;
  /** From 0 to 1: how far through the goal's period we are. Marks "Behind pace" when short of it. */
  pace?: number;
};

export type OverviewActivity = {
  id: string;
  /** Who or what it's about. */
  name: string;
  /** The kind of thing, such as a plan or product. */
  detail: string;
  amount: number;
  status: string;
  tone: "success" | "info" | "warning" | "danger" | "neutral";
  /** A plain day, as YYYY-MM-DD. */
  date: string;
};

export type OverviewData = {
  /** Names the shown period, e.g. "Last 30 days". */
  periodLabel: string;
  /** Names the period it's compared with, e.g. "Previous 30 days". */
  previousLabel: string;
  /** Whether each point is a day or a week. */
  bucket: "day" | "week";
  metrics: OverviewMetric[];
  goals: OverviewGoal[];
  activity: OverviewActivity[];
};

/** A choice in the date range menu. */
export type OverviewRange = { id: string; label: string };

export const DEFAULT_RANGES: OverviewRange[] = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "12m", label: "Last 12 months" },
];

/* ------------------------------------------------------------------ */
/*  Sample data                                                        */
/* ------------------------------------------------------------------ */

const TODAY = Date.UTC(2026, 10, 5);
const DAY = 86_400_000;

/** A small seeded generator, so the sample is the same on the server and the client. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type MetricSeed = {
  metric: Omit<OverviewMetric, "points">;
  seed: number;
  /** The daily value two years ago. */
  start: number;
  /** How much it grows over the two years: 0.5 is 50%. */
  growth: number;
  /** Weekend days, as a share of a weekday. */
  weekend: number;
  /** Day-to-day wobble, as a share of the value. */
  noise: number;
  decimals: number;
  shares?: number[];
};

const SEEDS: MetricSeed[] = [
  {
    metric: {
      id: "revenue",
      label: "Revenue",
      format: "currency",
      aggregate: "sum",
      partsLabel: "By plan",
      parts: [
        { id: "business", label: "Business" },
        { id: "team", label: "Team" },
        { id: "enterprise", label: "Enterprise" },
        { id: "starter", label: "Starter" },
      ],
    },
    shares: [0.42, 0.28, 0.18, 0.12],
    seed: 11,
    start: 2900,
    growth: 1.1,
    weekend: 0.84,
    noise: 0.07,
    decimals: 0,
  },
  {
    metric: {
      id: "customers",
      label: "New customers",
      format: "number",
      aggregate: "sum",
      partsLabel: "By source",
      parts: [
        { id: "organic", label: "Organic search" },
        { id: "paid", label: "Paid ads" },
        { id: "referral", label: "Referrals" },
        { id: "direct", label: "Direct" },
      ],
    },
    shares: [0.38, 0.26, 0.22, 0.14],
    seed: 23,
    start: 28,
    growth: 0.9,
    weekend: 0.72,
    noise: 0.12,
    decimals: 0,
  },
  {
    metric: {
      id: "active",
      label: "Active users",
      format: "number",
      aggregate: "average",
      partsLabel: "By device",
      parts: [
        { id: "desktop", label: "Desktop" },
        { id: "mobile", label: "Mobile" },
        { id: "tablet", label: "Tablet" },
      ],
    },
    shares: [0.61, 0.33, 0.06],
    seed: 37,
    start: 7800,
    growth: 0.62,
    weekend: 0.78,
    noise: 0.04,
    decimals: 0,
  },
  {
    metric: {
      id: "refunds",
      label: "Refund rate",
      format: "percent",
      aggregate: "average",
      goodWhen: "down",
    },
    seed: 41,
    start: 3.4,
    growth: -0.42,
    weekend: 1.03,
    noise: 0.07,
    decimals: 2,
  },
];

const round = (value: number, decimals: number) =>
  Number(value.toFixed(decimals));
const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);

/** One metric's value for every day in the sample's two years. */
function history(spec: MetricSeed) {
  const random = seeded(spec.seed);
  const days = 730;
  return Array.from({ length: days }, (_, i) => {
    const time = TODAY - (days - 1 - i) * DAY;
    const weekday = new Date(time).getUTCDay();
    // Steady change, picking up over the last four months so the sample has a story.
    const recent = Math.max(0, i - (days - 120)) / 120;
    const trend =
      (1 + spec.growth * (i / days)) *
      (1 + Math.sign(spec.growth) * 0.32 * recent);
    const week = weekday === 0 || weekday === 6 ? spec.weekend : 1;
    const value =
      spec.start * trend * week * (1 + (random() - 0.5) * 2 * spec.noise);
    const parts: Record<string, number> = {};
    spec.metric.parts?.forEach((part, index) => {
      parts[part.id] =
        (spec.shares?.[index] ?? 0) * (1 + (random() - 0.5) * 0.5);
    });
    const shareTotal =
      Object.values(parts).reduce((sum, share) => sum + share, 0) || 1;
    for (const id of Object.keys(parts)) {
      parts[id] = round((parts[id] / shareTotal) * value, spec.decimals);
    }
    return { time, value: round(value, spec.decimals), parts };
  });
}

/** Worked out on first use, so importing the types costs nothing. */
let cache: ReturnType<typeof history>[] | null = null;
const getHistory = () => (cache ??= SEEDS.map(history));

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
}
function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function metricFor(
  spec: MetricSeed,
  days: number[],
  range: number,
  size: number,
): OverviewMetric {
  const { metric, decimals } = spec;
  const all = getHistory()[SEEDS.indexOf(spec)];
  const combine = metric.aggregate === "sum" ? sum : mean;
  const points = days.map((at) => {
    const window = all.slice(at, at + size);
    const before = all.slice(at - range, at - range + size);
    const parts: Record<string, number> = {};
    metric.parts?.forEach((part) => {
      parts[part.id] = round(
        combine(window.map((day) => day.parts[part.id] ?? 0)),
        decimals,
      );
    });
    return {
      date: isoDay(window[0].time),
      value: round(combine(window.map((day) => day.value)), decimals),
      previous: round(combine(before.map((day) => day.value)), decimals),
      parts: metric.parts ? parts : undefined,
    };
  });
  return { ...metric, points };
}

const ACTIVITY: OverviewActivity[] = [
  {
    id: "a1",
    name: "Halden Studio",
    detail: "Business, yearly",
    amount: 4680,
    status: "Paid",
    tone: "success",
    date: "2026-11-05",
  },
  {
    id: "a2",
    name: "Vellum Labs",
    detail: "Team, monthly",
    amount: 240,
    status: "Paid",
    tone: "success",
    date: "2026-11-05",
  },
  {
    id: "a3",
    name: "Kestrel Freight",
    detail: "Enterprise, yearly",
    amount: 18400,
    status: "Invoice sent",
    tone: "info",
    date: "2026-11-04",
  },
  {
    id: "a4",
    name: "Northfold Coffee",
    detail: "Starter, monthly",
    amount: 49,
    status: "Payment failed",
    tone: "danger",
    date: "2026-11-04",
  },
  {
    id: "a5",
    name: "Marrow & Finch",
    detail: "Team, yearly",
    amount: 2592,
    status: "Paid",
    tone: "success",
    date: "2026-11-03",
  },
  {
    id: "a6",
    name: "Oakline Dental",
    detail: "Business, monthly",
    amount: 390,
    status: "Refunded",
    tone: "warning",
    date: "2026-11-02",
  },
];

/** Sample data for a range id from DEFAULT_RANGES. */
export function sampleOverview(rangeId: string): OverviewData {
  const total = getHistory()[0].length;
  const spec = {
    "7d": { range: 7, size: 1, label: "7 days" },
    "90d": { range: 90, size: 1, label: "90 days" },
    "12m": { range: 364, size: 7, label: "12 months" },
  }[rangeId] ?? { range: 30, size: 1, label: "30 days" };
  const days = Array.from(
    { length: Math.floor(spec.range / spec.size) },
    (_, i) => total - spec.range + i * spec.size,
  );
  return {
    periodLabel: `Last ${spec.label}`,
    previousLabel: `Previous ${spec.label}`,
    bucket: spec.size === 7 ? "week" : "day",
    metrics: SEEDS.map((seed) => metricFor(seed, days, spec.range, spec.size)),
    goals: [
      {
        id: "g1",
        label: "Q4 revenue",
        value: 186_400,
        target: 420_000,
        format: "currency",
        pace: 0.39,
      },
      {
        id: "g2",
        label: "New customers",
        value: 1_184,
        target: 2_400,
        format: "number",
        pace: 0.39,
      },
      {
        id: "g3",
        label: "Active users",
        value: 11_129,
        target: 12_000,
        format: "number",
      },
    ],
    activity: ACTIVITY,
  };
}
