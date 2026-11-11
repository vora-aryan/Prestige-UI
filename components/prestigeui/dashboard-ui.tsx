"use client";

import * as React from "react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Menu as MenuIcon,
  PanelLeft,
  X,
} from "lucide-react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  Button,
  popShadow,
  settingsVars,
} from "@/components/prestigeui/settings-ui";
import {
  AccountMenu,
  RailTip,
  ring,
  sidebarVars,
  thinScroll,
  useRailTip,
  useSidebarShortcut,
  type SidebarIcon,
  type SidebarUser,
} from "@/components/prestigeui/sidebar-ui";

/*
 * Shared kit for the Dashboard family: color themes, number and date
 * formatting, panels, panel states and the app shell.
 *
 * Corners read three variables, so a block can set its own shape without
 * touching the kit: --r-panel (panels, 14px), --r-control (buttons, menus and
 * fields, 10px), --r-item (rows and pills inside them, 9px) and --r-bar (meters,
 * round by default).
 */

/* ------------------------------------------------------------------ */
/*  Themes                                                             */
/* ------------------------------------------------------------------ */

/**
 * The first color is the theme's accent and the main series. The rest are for
 * categories, in a fixed order, so an item keeps its color when others are
 * hidden. Each set passes a colorblind check on light and dark surfaces.
 */
export const dashboardThemes = {
  cobalt:
    "[--dash-1:#1b70f7] [--dash-2:#d9702e] [--dash-3:#0d9488] [--dash-4:#c48a12] [--dash-5:#c2417c] dark:[--dash-1:#4d8eff] dark:[--dash-2:#d9702e] dark:[--dash-3:#12988a] dark:[--dash-4:#b98a14] dark:[--dash-5:#d0558c]",
  clay: "[--dash-1:#c2562f] [--dash-2:#2f6fc4] [--dash-3:#0d9488] [--dash-4:#c48a12] [--dash-5:#b5478f] dark:[--dash-1:#d8683e] dark:[--dash-2:#4d8ae0] dark:[--dash-3:#12988a] dark:[--dash-4:#b98a14] dark:[--dash-5:#c35aa2]",
  ember:
    "[--dash-1:#f4500c] [--dash-2:#1d1c16] [--dash-3:#f9bfa3] [--dash-4:#e8a33a] [--dash-5:#a89f94] [--dash-hero-from:#dc4a10] [--dash-hero-to:#bd3a08] [--dash-button:#d4430c] dark:[--dash-1:#ff6a2b] dark:[--dash-2:#f1ece3] dark:[--dash-3:#8f4a2c] dark:[--dash-4:#f2d27e] dark:[--dash-5:#8d857b] dark:[--dash-hero-from:#d84a12] dark:[--dash-hero-to:#a8350a] dark:[--dash-button:#d4430c]",
  pine: "[--dash-1:#14805c] [--dash-2:#d9702e] [--dash-3:#2f6fc4] [--dash-4:#c48a12] [--dash-5:#c2417c] dark:[--dash-1:#16996f] dark:[--dash-2:#d9702e] dark:[--dash-3:#5b83f0] dark:[--dash-4:#b98a14] dark:[--dash-5:#d0558c]",
} as const;

export type DashboardTheme = keyof typeof dashboardThemes;

/**
 * The page's surfaces and lines. The page sits lowest, panels are raised above
 * it, and unselected tabs are recessed into the panel. Green and red only ever
 * say "better" and "worse".
 */
export const dashboardVars = cn(
  settingsVars,
  sidebarVars,
  "[--dash-up:#1a7a4c] [--dash-down:#c23b33] dark:[--dash-up:#5cc792] dark:[--dash-down:#f0716a]",
  "dark:[--background:#0a0a0c] [--dash-panel:#ffffff] dark:[--dash-panel:#151518]",
  "[--dash-recess:color-mix(in_oklab,var(--foreground)_2.5%,var(--dash-panel))] dark:[--dash-recess:#0f0f12]",
  "[--dash-line:color-mix(in_oklab,var(--foreground)_10%,transparent)] dark:[--dash-line:rgba(255,255,255,0.13)]",
  "[--dash-line-soft:color-mix(in_oklab,var(--foreground)_7%,transparent)] dark:[--dash-line-soft:rgba(255,255,255,0.08)]",
);

/**
 * A raised panel. It also resets --background, so anything inside that needs
 * the surface color (a ring around a chart dot, a sticky header) gets the panel's.
 */
export const panelSurface =
  "rounded-[var(--r-panel,14px)] border border-(--dash-line) bg-(--dash-panel) [--background:var(--dash-panel)] shadow-[0_1px_2px_rgba(0,0,0,0.035)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_1px_3px_rgba(0,0,0,0.5),0_16px_32px_-20px_rgba(0,0,0,0.9)]";

/** The color of the nth category. Past the last color, it repeats the neutral. */
export const categoryColor = (index: number) =>
  index < 4
    ? `var(--dash-${index + 2})`
    : "color-mix(in oklab, var(--foreground) 35%, transparent)";

/* ------------------------------------------------------------------ */
/*  Formatting                                                         */
/* ------------------------------------------------------------------ */

export type ValueFormat = "currency" | "number" | "percent";

const parseDay = (iso: string) => {
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Every number and date in a dashboard goes through this, so one locale and
 * one currency apply everywhere. Dates are plain days (YYYY-MM-DD), read in
 * UTC, so they can't shift a day between the server and the browser.
 */
export function createFormatters(locale = "en-US", currency = "USD") {
  const plainCurrency = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  });
  const cents = plainCurrency.resolvedOptions().maximumFractionDigits ?? 2;
  const wholeCurrency = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
  const compactCurrency = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const compact = new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const percent = new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const smallPercent = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumSignificantDigits: 2,
  });
  const axisPercent = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumSignificantDigits: 3,
  });
  const axisCurrency = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumSignificantDigits: 3,
  });
  const delta = new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  });
  const day = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const monthYear = new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const monthOnly = new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
  });
  const oneDecimal = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const rate = new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const points = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  });
  const fullDay = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  return {
    /** The value as people read it: $48,210, 1,204, 3.42%. Rates are given as 3.42, not 0.0342. */
    value(value: number, format: ValueFormat) {
      if (!Number.isFinite(value)) return "—";
      // A rate under 0.01% would otherwise read as 0.00%.
      if (format === "percent")
        return (
          value !== 0 && Math.abs(value) < 0.01 ? smallPercent : percent
        ).format(value / 100);
      // Cents only when they say something, so a column never mixes $240.00 and $4,680.
      if (format === "currency")
        return (
          Math.abs(value) >= 1000 || cents === 0 || Number.isInteger(value)
            ? wholeCurrency
            : plainCurrency
        ).format(value);
      return Math.abs(value) >= 1000 || Number.isInteger(value)
        ? whole.format(value)
        : decimal.format(value);
    },
    /** Short enough for an axis: $48K, 1.2K, 3.4%. */
    axis(value: number, format: ValueFormat) {
      if (format === "percent") return axisPercent.format(value / 100);
      if (format === "currency")
        return (
          Math.abs(value) >= 1000 ? compactCurrency : axisCurrency
        ).format(value);
      return Math.abs(value) >= 1000
        ? compact.format(value)
        : decimal.format(value);
    },
    /** The value in full, or shortened if it would be too long to read at a glance: $339.8T. */
    headline(value: number, format: ValueFormat) {
      const full = this.value(value, format);
      if (full.length <= 11 || format === "percent") return full;
      return (format === "currency" ? compactCurrency : compact).format(value);
    },
    /** A change as a signed percent. 0.124 reads +12.4%. */
    delta: (value: number) => delta.format(value).replace("-", "\u2212"),
    /** Always one decimal, so a column of ratios lines up. 4 reads 4.0. */
    oneDecimal: (value: number) =>
      Number.isFinite(value) ? oneDecimal.format(value) : "—",
    /** A rate to one decimal, for figures read at a glance. 107.2 reads 107.2%. */
    rate: (value: number) =>
      Number.isFinite(value) ? rate.format(value / 100) : "—",
    /** A change between two percentages, in points. 0.4 reads +0.4 pts. */
    points: (value: number) =>
      `${points.format(value).replace("-", "\u2212")} pts`,
    /** Oct 2026 */
    month: (iso: string) => {
      const date = parseDay(iso);
      return date ? monthYear.format(date) : "—";
    },
    /** Oct */
    shortMonth: (iso: string) => {
      const date = parseDay(iso);
      return date ? monthOnly.format(date) : "—";
    },
    /** Oct 14 */
    day: (iso: string) => {
      const date = parseDay(iso);
      return date ? day.format(date) : "—";
    },
    /** Tue, Oct 14, 2026 */
    fullDay: (iso: string) => {
      const date = parseDay(iso);
      return date ? fullDay.format(date) : "—";
    },
  };
}

export type Formatters = ReturnType<typeof createFormatters>;

/* ------------------------------------------------------------------ */
/*  Change                                                             */
/* ------------------------------------------------------------------ */

/**
 * The change from one value to another, or null when it can't be worked out
 * (nothing to compare with, or a start of zero).
 */
export function changeBetween(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

/** A signed change. The arrow says the direction, the color says if that's good. */
export function Delta({
  value,
  goodWhen = "up",
  format,
  className,
}: {
  value: number | null;
  goodWhen?: "up" | "down";
  format: (value: number) => string;
  className?: string;
}) {
  if (value === null || !Number.isFinite(value))
    return (
      <span className={cn("text-[13px] text-foreground/40", className)}>
        No comparison
      </span>
    );
  const flat = Math.abs(value) < 0.0005;
  const good = value > 0 === (goodWhen === "up");
  const Arrow = value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[13px] font-medium tabular-nums",
        flat
          ? "text-foreground/50"
          : good
            ? "text-(--dash-up)"
            : "text-(--dash-down)",
        className,
      )}
    >
      {flat ? null : (
        <Arrow aria-hidden className="size-3.5" strokeWidth={2.2} />
      )}
      {flat ? "No change" : format(value)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Panels                                                             */
/* ------------------------------------------------------------------ */

/** A flat, hairlined section of the page. */
export function Panel({
  title,
  action,
  className,
  children,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    // clip, not hidden: a hidden box can still be scrolled by focus or scrollIntoView.
    <section className={cn("min-w-0 overflow-clip", panelSurface, className)}>
      {title ? (
        <header className="flex min-h-12 items-center justify-between gap-3 border-b border-(--dash-line-soft) px-4 py-2">
          <h2 className="min-w-0 text-[14px] font-medium">{title}</h2>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/** Nothing to show yet, and why. */
export function PanelEmpty({
  title,
  detail,
  className,
}: {
  title: string;
  detail?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid place-items-center px-6 py-10 text-center",
        className,
      )}
    >
      <div>
        <p className="text-[14px] font-medium">{title}</p>
        {detail ? (
          <p className="mt-1 text-[13px] text-pretty text-foreground/55">
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Loading this part failed. The rest of the page keeps working. */
export function PanelError({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "grid place-items-center px-6 py-10 text-center",
        className,
      )}
    >
      <div>
        <AlertCircle
          aria-hidden
          className="mx-auto size-5 text-(--dash-down)"
          strokeWidth={2}
        />
        <p className="mt-2 text-[14px] font-medium text-pretty">{message}</p>
        {onRetry ? (
          <Button className="mt-3 h-8 px-3 text-[13px]" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** A bar shaped like the text it stands in for. */
export function Placeholder({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("block rounded-[5px] bg-foreground/[0.06]", className)}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Shell                                                              */
/* ------------------------------------------------------------------ */

export type DashboardNavItem = {
  id: string;
  label: string;
  icon: SidebarIcon;
  href?: string;
};

export type DashboardShellProps = {
  /** The logo and name at the top of the sidebar. */
  brand: React.ReactNode;
  nav: DashboardNavItem[];
  /** The id of the page being shown. */
  activeNav?: string;
  /** Called with the item. Leave it out to follow each item's href. */
  onNavigate?: (item: DashboardNavItem) => void;
  user: SidebarUser;
  /**
   * How the sidebar sits beside the page. "plain" divides them with a line.
   * "inset" lays the page on the sidebar's surface as a raised sheet.
   */
  variant?: "plain" | "inset";
  children: React.ReactNode;
  className?: string;
};

/**
 * A quiet app frame: a sidebar beside a scrolling page. It fills the screen,
 * and below 900px wide the sidebar becomes a drawer. To use a dashboard in an
 * app that already has a frame, skip this and render the content on its own.
 */
export function DashboardShell({
  brand,
  nav,
  activeNav,
  onNavigate,
  user,
  variant = "plain",
  children,
  className,
}: DashboardShellProps) {
  const inset = variant === "inset";
  const [drawer, setDrawer] = React.useState(false);
  const panel = React.useRef<HTMLElement>(null);
  const opener = React.useRef<HTMLButtonElement>(null);

  // The drawer takes focus when it opens and gives it back when it closes.
  React.useEffect(() => {
    if (!drawer) return;
    panel.current
      ?.querySelector<HTMLElement>("a, button")
      ?.focus({ preventScroll: true });
    const button = opener.current;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawer(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      button?.focus({ preventScroll: true });
    };
  }, [drawer]);

  const links = (
    <nav aria-label="Pages" className="flex flex-col gap-0.5">
      {nav.map((item) => {
        const active = item.id === activeNav;
        const Icon = item.icon;
        return (
          <a
            key={item.id}
            href={item.href ?? "#"}
            aria-current={active ? "page" : undefined}
            onClick={(event) => {
              if (onNavigate || !item.href) event.preventDefault();
              onNavigate?.(item);
              setDrawer(false);
            }}
            className={cn(
              "flex h-[34px] items-center gap-2.5 rounded-[var(--r-item,9px)] px-2.5 text-[13.5px] transition-colors duration-150",
              active
                ? inset
                  ? "bg-background font-medium shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.06)] dark:bg-foreground/[0.08] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)]"
                  : "bg-foreground/[0.06] font-medium dark:bg-foreground/[0.09]"
                : "text-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground dark:text-foreground/65",
              ring,
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.9} />
            <span className="min-w-0 truncate">{item.label}</span>
          </a>
        );
      })}
    </nav>
  );

  return (
    <div
      className={cn(
        "@container relative h-dvh min-h-[560px] w-full overflow-clip font-sans text-foreground",
        dashboardVars,
        inset ? "bg-(--sb-panel)" : "bg-background",
        className,
      )}
    >
      <div className="flex h-full flex-col @[900px]:flex-row">
        {/* Wide: the sidebar */}
        <aside
          className={cn(
            "hidden w-[232px] shrink-0 flex-col bg-(--sb-panel) p-2.5 @[900px]:flex",
            !inset && "border-r border-(--dash-line-soft)",
          )}
        >
          <div className="flex h-11 items-center gap-2 px-2 text-[14px] font-semibold tracking-[-0.01em]">
            {brand}
          </div>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto">{links}</div>
          <AccountMenu user={user} />
        </aside>

        {/* Narrow: a bar with a menu button */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-(--dash-line-soft) px-3 @[900px]:hidden">
          <button
            ref={opener}
            type="button"
            aria-label="Open menu"
            aria-expanded={drawer}
            onClick={() => setDrawer(true)}
            className={cn(
              "grid size-9 cursor-pointer place-items-center rounded-[var(--r-control,10px)] transition-colors duration-150 hover:bg-foreground/[0.05]",
              ring,
            )}
          >
            <MenuIcon className="size-[18px]" strokeWidth={1.9} />
          </button>
          <div className="flex min-w-0 items-center gap-2 text-[14px] font-semibold tracking-[-0.01em]">
            {brand}
          </div>
        </header>

        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-y-auto",
            thinScroll,
            inset &&
              "bg-background @[900px]:my-2 @[900px]:mr-2 @[900px]:rounded-[var(--r-panel,14px)] @[900px]:shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.18)] @[900px]:dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)]",
          )}
        >
          {children}
        </div>
      </div>

      {/* The drawer */}
      <div
        aria-hidden
        onClick={() => setDrawer(false)}
        className={cn(
          "absolute inset-0 z-40 bg-black/30 transition-opacity duration-300 @[900px]:hidden",
          drawer ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        ref={panel}
        inert={!drawer}
        aria-label="Menu"
        className={cn(
          "absolute inset-y-0 left-0 z-50 flex w-[min(288px,86vw)] flex-col bg-background p-2.5 transition-transform duration-[350ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none @[900px]:hidden",
          popShadow,
          drawer ? "translate-x-0" : "-translate-x-[calc(100%+24px)]",
        )}
      >
        <div className="flex h-11 items-center gap-2 px-2 text-[14px] font-semibold tracking-[-0.01em]">
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {brand}
          </span>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawer(false)}
            className={cn(
              "grid size-8 cursor-pointer place-items-center rounded-[var(--r-item,9px)] text-foreground/55 transition-colors duration-150 hover:bg-foreground/[0.05] hover:text-foreground",
              ring,
            )}
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">{links}</div>
        <AccountMenu user={user} />
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Collapsible shell                                                  */
/* ------------------------------------------------------------------ */

export type SidebarNavItem = {
  id: string;
  label: string;
  icon: SidebarIcon;
  /** A small number or word at the end of the row. */
  badge?: React.ReactNode;
  href?: string;
};

export type SidebarNavGroup = {
  id: string;
  /** Names the group. In the collapsed sidebar it becomes a hairline. */
  label?: string;
  items: SidebarNavItem[];
};

export type CollapsibleShellProps = {
  /** The logo alone. */
  mark: React.ReactNode;
  /** The product's name, beside the logo. */
  name: string;
  groups: SidebarNavGroup[];
  /** Items kept at the foot of the sidebar, e.g. Settings. */
  footerItems?: SidebarNavItem[];
  /** The id of the page being shown. */
  active?: string;
  onNavigate?: (item: SidebarNavItem) => void;
  /** How the current page is marked: a soft pill, or a colored bar on the sidebar's edge. */
  indicator?: "pill" | "edge";
  /** Under the logo, e.g. a site switcher. It's told whether the sidebar is collapsed. */
  header?: (collapsed: boolean) => React.ReactNode;
  /** Above the account, e.g. a usage meter. It folds away with the sidebar, for the room. */
  footer?: React.ReactNode;
  user: SidebarUser;
  /** Control the sidebar. Left out, it starts open and the person decides. */
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  theme?: DashboardTheme;
  /** Classes for the sidebar itself, e.g. a block's own theme variables. */
  sidebarClassName?: string;
  children: React.ReactNode;
  className?: string;
};

const OPEN_WIDTH = 248;
const COLLAPSED_WIDTH = 60;
/** Names fade before the sidebar narrows, and after it widens. */
const fadeOf = (collapsed: boolean) =>
  collapsed ? "opacity-0 duration-100" : "opacity-100 delay-150 duration-200";

/**
 * One sidebar that folds down to its icons. The icons never move: only the names
 * fade, and each shows on hover while collapsed. It folds with its button or
 * Ctrl+B, fills the screen, and below 900px wide it becomes a drawer.
 */
export function DashboardCollapsibleShell({
  mark,
  name,
  groups,
  footerItems = [],
  active,
  onNavigate,
  indicator = "pill",
  header,
  footer,
  user,
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  theme = "cobalt",
  sidebarClassName,
  children,
  className,
}: CollapsibleShellProps) {
  const reduce = useReducedMotion() ?? false;
  const scope = React.useId();
  const [ownCollapsed, setOwnCollapsed] = React.useState(defaultCollapsed);
  const collapsed = collapsedProp ?? ownCollapsed;
  const [drawer, setDrawer] = React.useState(false);
  const frame = React.useRef<HTMLDivElement>(null);
  const panel = React.useRef<HTMLElement>(null);
  const opener = React.useRef<HTMLButtonElement>(null);
  const foldButton = React.useRef<HTMLButtonElement>(null);
  const refocus = React.useRef(false);
  const { tip, show, hide } = useRailTip(collapsed);

  const toggle = () => {
    hide();
    const next = !collapsed;
    if (collapsedProp === undefined) setOwnCollapsed(next);
    onCollapsedChange?.(next);
  };
  useSidebarShortcut(() => {
    if ((frame.current?.clientWidth ?? 0) < 900) setDrawer((value) => !value);
    else toggle();
  });

  // The fold button swaps with the logo, so focus follows it across.
  React.useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    foldButton.current?.focus({ preventScroll: true });
  }, [collapsed]);

  // The drawer takes focus when it opens and gives it back when it closes.
  React.useEffect(() => {
    if (!drawer) return;
    panel.current
      ?.querySelector<HTMLElement>("a, button")
      ?.focus({ preventScroll: true });
    const button = opener.current;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawer(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      button?.focus({ preventScroll: true });
    };
  }, [drawer]);

  /** The sidebar's insides: the same in the wide sidebar and in the drawer. */
  const body = (rail: boolean, inDrawer: boolean) => {
    const fade = fadeOf(rail);
    const hints = (label: string, detail?: string) =>
      rail
        ? {
            onPointerEnter: (event: React.PointerEvent<HTMLElement>) =>
              show(event.currentTarget, label, detail),
            onPointerLeave: hide,
            // Only for keyboard users: a mouse click also moves focus here, and the
            // label would stay up after the pointer leaves.
            onFocus: (event: React.FocusEvent<HTMLElement>) => {
              if (event.currentTarget.matches(":focus-visible")) show(event.currentTarget, label, detail, true);
            },
            onBlur: hide,
          }
        : {};
    const row = (item: SidebarNavItem) => {
      const on = item.id === active;
      const Icon = item.icon;
      return (
        <li key={item.id} className="relative">
          {on ? (
            <motion.span
              layoutId={`${scope}-${inDrawer ? "drawer" : "wide"}-pill`}
              layoutDependency={active}
              transition={{ type: "spring", bounce: 0, duration: reduce ? 0 : 0.3 }}
              className={
                indicator === "edge"
                  ? "absolute top-1 bottom-1 -left-2.5 w-[3px] rounded-r-full bg-(--dash-1)"
                  : "absolute inset-0 rounded-[var(--r-item,9px)] bg-foreground/[0.07] dark:bg-foreground/[0.1]"
              }
            />
          ) : null}
          <a
            href={item.href ?? "#"}
            aria-label={rail ? item.label : undefined}
            aria-current={on ? "page" : undefined}
            onClick={(event) => {
              if (onNavigate || !item.href) event.preventDefault();
              onNavigate?.(item);
              setDrawer(false);
            }}
            {...hints(item.label)}
            className={cn(
              "relative flex h-9 items-center gap-2.5 overflow-hidden rounded-[var(--r-item,9px)] pr-2.5 pl-3 text-[13.5px] whitespace-nowrap transition-colors duration-150",
              on
                ? "font-medium text-foreground"
                : "text-foreground/65 hover:bg-foreground/[0.045] hover:text-foreground dark:text-foreground/70",
              ring,
            )}
          >
            <Icon
              className={cn("size-4 shrink-0", on && "text-(--dash-1)")}
              strokeWidth={1.9}
            />
            <span className={cn("min-w-0 flex-1 truncate transition-opacity", fade)}>
              {item.label}
            </span>
            {item.badge !== undefined ? (
              <span
                className={cn(
                  "shrink-0 text-[12px] font-medium text-foreground/60 tabular-nums transition-opacity",
                  fade,
                )}
              >
                {item.badge}
              </span>
            ) : null}
          </a>
        </li>
      );
    };

    return (
      <div className="flex h-full min-w-0 flex-col">
        {/* The logo and name, and the button that folds the sidebar */}
        <div className="flex h-14 shrink-0 items-center px-2.5">
          {rail ? (
            <button
              ref={foldButton}
              type="button"
              aria-label="Expand sidebar"
              aria-expanded={false}
              onClick={() => {
                refocus.current = true;
                toggle();
              }}
              {...hints("Expand sidebar", "Ctrl B")}
              className={cn(
                "group/fold relative grid size-10 shrink-0 cursor-pointer place-items-center rounded-[var(--r-control,10px)] transition-colors duration-150 hover:bg-foreground/[0.06]",
                ring,
              )}
            >
              {/* The logo turns into the expand icon under the pointer */}
              <span className="grid place-items-center transition-opacity duration-150 group-hover/fold:opacity-0 group-focus-visible/fold:opacity-0">
                {mark}
              </span>
              <PanelLeft
                aria-hidden
                className="absolute size-[18px] text-foreground/70 opacity-0 transition-opacity duration-150 group-hover/fold:opacity-100 group-focus-visible/fold:opacity-100"
                strokeWidth={1.8}
              />
            </button>
          ) : (
            <>
              <span className="grid size-10 shrink-0 place-items-center">{mark}</span>
              <span className="min-w-0 flex-1 truncate pl-1 text-[14px] font-semibold tracking-[-0.01em] whitespace-nowrap">
                {name}
              </span>
              <button
                ref={inDrawer ? undefined : foldButton}
                type="button"
                aria-label={inDrawer ? "Close menu" : "Collapse sidebar"}
                aria-expanded={inDrawer ? undefined : true}
                title={inDrawer ? undefined : "Collapse sidebar (Ctrl B)"}
                onClick={() => {
                  if (inDrawer) setDrawer(false);
                  else {
                    refocus.current = true;
                    toggle();
                  }
                }}
                className={cn(
                  "grid size-8 shrink-0 cursor-pointer place-items-center rounded-[var(--r-item,9px)] text-foreground/55 transition-colors duration-150 hover:bg-foreground/[0.06] hover:text-foreground",
                  ring,
                )}
              >
                {inDrawer ? (
                  <X className="size-4" strokeWidth={2} />
                ) : (
                  <PanelLeft className="size-[18px]" strokeWidth={1.8} />
                )}
              </button>
            </>
          )}
        </div>

        {header ? <div className="shrink-0 px-2.5 pb-1">{header(rail)}</div> : null}

        <nav
          aria-label="Pages"
          className={cn(
            "min-h-0 flex-1 overflow-x-clip overflow-y-auto px-2.5 pt-1 pb-3 [mask-image:linear-gradient(to_bottom,transparent,black_4px,black_calc(100%-12px),transparent)]",
            // A scrollbar would take width from the rows and push the icons off center.
            rail ? "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : thinScroll,
          )}
        >
          {groups.map((group, index) => (
            <section key={group.id} aria-label={group.label}>
              {group.label || index > 0 ? (
                <div className="relative flex h-8 items-end px-3 pb-1">
                  <h3
                    className={cn(
                      "text-[12px] font-medium whitespace-nowrap text-foreground/50 transition-opacity dark:text-foreground/60",
                      fade,
                    )}
                  >
                    {group.label}
                  </h3>
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-x-2 top-1/2 h-px bg-(--dash-line-soft) transition-opacity duration-150",
                      rail ? "opacity-100" : "opacity-0",
                    )}
                  />
                </div>
              ) : null}
              <ul className="flex flex-col gap-px">{group.items.map(row)}</ul>
            </section>
          ))}
        </nav>

        {footerItems.length ? (
          <ul className="mx-2.5 flex shrink-0 flex-col gap-px border-t border-(--dash-line-soft) py-2">
            {footerItems.map(row)}
          </ul>
        ) : null}
        {footer ? (
          <div
            aria-hidden={rail || undefined}
            className={cn(
              "grid shrink-0 transition-[grid-template-rows] duration-[320ms] ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none",
              rail ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
            )}
          >
            <div className="min-h-0 overflow-clip">
              <div
                className={cn(
                  "w-[248px] border-t border-(--dash-line-soft) px-2.5 py-2.5 transition-opacity",
                  fade,
                )}
              >
                {footer}
              </div>
            </div>
          </div>
        ) : null}
        <div className="shrink-0 border-t border-(--dash-line-soft) p-2.5">
          <AccountMenu
            user={user}
            compact={rail}
            onHover={rail ? (node) => show(node, user.name, user.email) : undefined}
            onLeave={rail ? hide : undefined}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      ref={frame}
      data-sidebar-frame=""
      className={cn(
        "@container relative h-dvh min-h-[560px] w-full overflow-clip bg-background font-sans text-foreground",
        dashboardVars,
        dashboardThemes[theme],
        className,
      )}
    >
      <div className="flex h-full flex-col @[900px]:flex-row">
        {/* Wide: the sidebar */}
        <aside
          aria-label="Sidebar"
          style={{ width: collapsed ? COLLAPSED_WIDTH : OPEN_WIDTH }}
          className={cn(
            "hidden shrink-0 overflow-clip bg-(--sb-panel) shadow-[inset_-1px_0_0_var(--dash-line-soft)] transition-[width] duration-[320ms] ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none @[900px]:block",
            sidebarClassName,
          )}
        >
          <LayoutGroup id={`${scope}-wide`}>{body(collapsed, false)}</LayoutGroup>
        </aside>

        {/* Narrow: a bar with a menu button */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-(--dash-line-soft) bg-(--dash-panel) px-3 @[900px]:hidden">
          <button
            ref={opener}
            type="button"
            aria-label="Open menu"
            aria-expanded={drawer}
            onClick={() => setDrawer(true)}
            className={cn(
              "grid size-9 cursor-pointer place-items-center rounded-[var(--r-control,10px)] transition-colors duration-150 hover:bg-foreground/[0.05]",
              ring,
            )}
          >
            <MenuIcon className="size-[18px]" strokeWidth={1.9} />
          </button>
          <div className="flex min-w-0 items-center gap-2 text-[14px] font-semibold tracking-[-0.01em]">
            {mark}
            <span className="truncate">{name}</span>
          </div>
        </header>

        <div className={cn("min-h-0 min-w-0 flex-1 overflow-y-auto", thinScroll)}>
          {children}
        </div>
      </div>

      <RailTip tip={tip} left={COLLAPSED_WIDTH + 6} />

      {/* The drawer */}
      <div
        aria-hidden
        onClick={() => setDrawer(false)}
        className={cn(
          "absolute inset-0 z-40 bg-black/30 transition-opacity duration-300 @[900px]:hidden",
          drawer ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        ref={panel}
        inert={!drawer}
        aria-label="Menu"
        style={{ width: OPEN_WIDTH }}
        className={cn(
          "absolute inset-y-0 left-0 z-50 max-w-[86vw] overflow-clip bg-(--sb-panel) transition-transform duration-[350ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none @[900px]:hidden",
          popShadow,
          sidebarClassName,
          drawer ? "translate-x-0" : "-translate-x-[calc(100%+24px)]",
        )}
      >
        <LayoutGroup id={`${scope}-drawer`}>{body(false, true)}</LayoutGroup>
      </aside>
    </div>
  );
}
