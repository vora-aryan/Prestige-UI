"use client";

import * as React from "react";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useTransform } from "motion/react";
import {
  ArrowRight,
  Blocks,
  CalendarClock,
  Check,
  ChevronDown,
  CircleAlert,
  Clock,
  CornerDownLeft,
  Download,
  FileSpreadsheet,
  KeyRound,
  ReceiptText,
  Search,
  Settings2,
  Tag,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

/* ------------------------------------------------------------------ */
/*  Card                                                               */
/* ------------------------------------------------------------------ */

type FeatureCardState = {
  /** True while the story should play: hover, keyboard focus, or in view on touch screens. */
  active: boolean;
  /** Reduced motion: show the finished state and don't animate. */
  reduce: boolean;
};

const FeatureCardContext = React.createContext<FeatureCardState>({ active: false, reduce: false });

/** Read inside your own illustration to know when to play. */
export function useFeatureCard() {
  return React.useContext(FeatureCardContext);
}

export type FeatureCardTone = "plain" | "sky" | "sand" | "sage";

export interface FeatureCardProps {
  title: string;
  /** One or two plain sentences. */
  description: string;
  /** The illustration. Use one of the built-in stories or your own; read `useFeatureCard()` inside it. */
  illustration: React.ReactNode;
  /** Makes the whole card a link. */
  href?: string;
  /** Link text under the description, shown when `href` is set. */
  linkLabel?: string;
  /** Soft color of the stage behind the illustration. */
  tone?: FeatureCardTone;
  className?: string;
}

const TONES: Record<FeatureCardTone, string> = {
  plain: "bg-[#f4f4f2] dark:bg-[#111114]",
  sky: "bg-[radial-gradient(120%_90%_at_15%_0%,#d6e4f7_0%,transparent_62%),radial-gradient(90%_80%_at_100%_100%,#e6edf7_0%,transparent_70%)] bg-[#f8f9fb] dark:bg-[radial-gradient(120%_90%_at_15%_0%,#1b2433_0%,transparent_62%)] dark:bg-[#111215]",
  sand: "bg-[radial-gradient(120%_90%_at_15%_0%,#f3e1c9_0%,transparent_62%),radial-gradient(90%_80%_at_100%_100%,#f5ebdd_0%,transparent_70%)] bg-[#fbfaf7] dark:bg-[radial-gradient(120%_90%_at_15%_0%,#2a2219_0%,transparent_62%)] dark:bg-[#131210]",
  sage: "bg-[radial-gradient(120%_90%_at_15%_0%,#d9e9e0_0%,transparent_62%),radial-gradient(90%_80%_at_100%_100%,#e5efe9_0%,transparent_70%)] bg-[#f8faf8] dark:bg-[radial-gradient(120%_90%_at_15%_0%,#18241d_0%,transparent_62%)] dark:bg-[#111312]",
};

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

function subscribeMedia(query: string) {
  return (cb: () => void) => {
    const m = window.matchMedia(query);
    m.addEventListener("change", cb);
    return () => m.removeEventListener("change", cb);
  };
}
const subscribeReduce = subscribeMedia("(prefers-reduced-motion: reduce)");
const subscribeHover = subscribeMedia("(hover: hover)");

/**
 * A feature card whose illustration plays a short story on hover, keyboard
 * focus, or when it scrolls into view on touch screens, and settles back at
 * rest. It lays itself out by its own width: stacked when narrow, text beside
 * the illustration from 576px.
 */
export function FeatureCard({
  title,
  description,
  illustration,
  href,
  linkLabel = "Learn more",
  tone = "plain",
  className,
}: FeatureCardProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  // Server snapshot of `true` keeps the first render still until the browser answers.
  const reduce = React.useSyncExternalStore(
    subscribeReduce,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
  const canHover = React.useSyncExternalStore(
    subscribeHover,
    () => window.matchMedia("(hover: hover)").matches,
    () => true,
  );
  const inView = useInView(ref, { amount: 0.6 });
  const active = hovered || focused || (!canHover && inView);
  const state = React.useMemo(() => ({ active, reduce }), [active, reduce]);

  const surface =
    "group/feature flex h-full flex-col overflow-clip rounded-lg bg-background text-left shadow-[0_0_0_1px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] transition-shadow duration-200 outline-none @xl:flex-row-reverse dark:bg-[#17171b] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.14),inset_0_1px_0_rgba(255,255,255,0.05)]";
  const linkSurface =
    "hover:shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_10px_28px_-14px_rgba(0,0,0,0.2)] focus-visible:ring-2 focus-visible:ring-foreground/25 dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]";

  const body = (
    <>
      <div
        aria-hidden
        className={cn(
          "relative isolate h-[264px] shrink-0 overflow-clip border-b border-black/[0.06] @xl:h-auto @xl:min-h-[320px] @xl:w-[58%] @xl:border-b-0 @xl:border-l dark:border-white/[0.08]",
          TONES[tone],
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.08] mix-blend-multiply dark:hidden"
          style={{ backgroundImage: GRAIN }}
        />
        <FeatureCardContext.Provider value={state}>{illustration}</FeatureCardContext.Provider>
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-5 @xl:justify-center @xl:p-8">
        <h3 className="text-[16px] leading-snug font-medium tracking-[-0.01em] text-balance text-foreground @xl:text-[20px] @xl:tracking-[-0.02em]">
          {title}
        </h3>
        <p className="mt-1.5 text-[14px] leading-relaxed text-pretty text-muted-foreground @xl:mt-2 @xl:max-w-[34ch] @xl:text-[15px]">
          {description}
        </p>
        {href && (
          <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-foreground @xl:mt-6">
            {linkLabel}
            <ArrowRight
              className="size-3.5 transition-[translate] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/feature:translate-x-0.5 group-focus-visible/feature:translate-x-0.5"
              strokeWidth={2}
            />
          </span>
        )}
      </div>
    </>
  );

  const handlers = {
    onPointerEnter: (e: React.PointerEvent) => e.pointerType !== "touch" && setHovered(true),
    onPointerLeave: () => setHovered(false),
  };

  return (
    <div ref={ref} className={cn("@container min-w-0", className)}>
      {href ? (
        <a
          href={href}
          className={cn(surface, linkSurface)}
          {...handlers}
          onFocus={(e) => e.currentTarget.matches(":focus-visible") && setFocused(true)}
          onBlur={() => setFocused(false)}
        >
          {body}
        </a>
      ) : (
        <div className={surface} {...handlers}>
          {body}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared pieces for stories                                          */
/* ------------------------------------------------------------------ */

/**
 * Steps through a story while the card is active. `times` are seconds from the
 * start; the hook returns how many have passed (0 at rest, all of them under
 * reduced motion).
 */
export function useFeatureSteps(times: readonly number[]) {
  const { active, reduce } = useFeatureCard();
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    if (reduce) return;
    const ids = active
      ? times.map((t, i) => window.setTimeout(() => setStep(i + 1), t * 1000))
      : [window.setTimeout(() => setStep(0), 0)];
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [active, reduce, times]);
  return reduce ? times.length : step;
}

/** The app window the stories sit in. It runs off the bottom of the stage. */
export function FeatureWindow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "absolute inset-x-5 top-5 -bottom-px overflow-clip rounded-t-md bg-white text-[13px] text-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.05),0_14px_32px_-18px_rgba(0,0,0,0.22)] @xl:inset-x-8 @xl:top-8 dark:bg-[#1c1c21] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12),inset_0_1px_0_rgba(255,255,255,0.06),0_14px_32px_-18px_rgba(0,0,0,0.7)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Stacks states in one cell so swapping never changes the size. */
function Swap({ show, children, className }: { show: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span
      aria-hidden={!show}
      className={cn(
        "col-start-1 row-start-1 transition-[opacity,translate] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
        show ? "translate-y-0 opacity-100 delay-75 duration-500" : "translate-y-0.5 opacity-0 duration-200",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Story: search                                                      */
/* ------------------------------------------------------------------ */

const PAGES = [
  { label: "Team members", group: "Settings", icon: Users },
  { label: "Integrations", group: "Settings", icon: Blocks },
  { label: "Invoices", group: "Billing", icon: ReceiptText },
  { label: "API keys", group: "Developers", icon: KeyRound },
  { label: "Pricing plans", group: "Billing", icon: Tag },
  { label: "Overdue invoices", group: "Billing", icon: CircleAlert },
  { label: "Invoice settings", group: "Billing", icon: Settings2 },
];
const QUERY = "invoice";
// Uneven keystrokes, like a person typing, then a beat before the pick.
const SEARCH_TIMES = [0.35, 0.47, 0.62, 0.8, 0.9, 1.03, 1.16, 1.75] as const;

function Highlight({ text, query }: { text: string; query: string }) {
  const at = query.length >= 2 ? text.toLowerCase().indexOf(query) : -1;
  if (at < 0) return <span className="transition-colors duration-300">{text}</span>;
  return (
    <span className="text-muted-foreground transition-colors duration-300">
      {text.slice(0, at)}
      <span className="text-foreground">{text.slice(at, at + query.length)}</span>
      {text.slice(at + query.length)}
    </span>
  );
}

/** Typing filters a page list down to three results; the top one is ready to open. */
export function FeatureSearch() {
  const { active, reduce } = useFeatureCard();
  const step = useFeatureSteps(SEARCH_TIMES);
  // Rows reflow while typing; going back to rest crossfades the whole list instead.
  const run = active || reduce ? "run" : "rest";
  const query = QUERY.slice(0, Math.min(step, QUERY.length));
  const picked = step > QUERY.length;
  const results = query.length >= 2 ? PAGES.filter((p) => p.label.toLowerCase().includes(query)) : PAGES;

  return (
    <FeatureWindow>
      <div className="flex h-11 items-center gap-2.5 border-b border-black/[0.06] px-3.5 dark:border-white/[0.09]">
        <Search className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
        <span className="relative flex min-w-0 flex-1 items-center">
          {query ? (
            <span className="text-foreground">{query}</span>
          ) : (
            <span className="truncate text-muted-foreground">Search pages and settings</span>
          )}
          {step > 0 && <span className="ml-px h-4 w-px bg-foreground" />}
        </span>
        <kbd className="hidden shrink-0 rounded-[4px] px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] @[300px]:inline dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]">
          ⌘K
        </kbd>
      </div>

      <div className="flex items-center justify-between px-3.5 pt-3 pb-1.5 text-[11.5px] text-muted-foreground">
        <span>{query.length >= 2 ? "Results" : "Pages"}</span>
        <span className="tabular-nums">{results.length}</span>
      </div>

      <div className="grid">
        <AnimatePresence initial={false}>
          <motion.ul
            key={run}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.35, ease: EASE } }}
            exit={{ opacity: 0, transition: { duration: 0.18 } }}
            className="col-start-1 row-start-1 px-1.5"
          >
            <AnimatePresence initial={false} mode="popLayout">
              {results.map((page, i) => {
                const Icon = page.icon;
                const top = i === 0 && query.length >= 2;
                return (
                  <motion.li
                    key={page.label}
                    layout="position"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.12 } }}
                    // Leaving rows fade first, then the rest move up into their places.
                    transition={{ opacity: { duration: 0.3, delay: 0.1 }, layout: { duration: 0.4, ease: EASE, delay: 0.1 } }}
                    className="relative flex h-8 items-center gap-2.5 rounded-[5px] px-2"
                  >
                    <span
                      className={cn(
                        "absolute inset-0 rounded-[5px] bg-foreground/[0.05] transition-opacity duration-300 dark:bg-white/[0.07]",
                        top ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <Icon className="relative size-[15px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    <span className="relative min-w-0 flex-1 truncate">
                      <Highlight text={page.label} query={query} />
                    </span>
                    <span className="relative grid shrink-0 justify-items-end text-[12px] text-muted-foreground">
                      <Swap show={!(top && picked)}>{page.group}</Swap>
                      <Swap show={top && picked} className="inline-flex items-center gap-1 text-foreground">
                        Open <CornerDownLeft className="size-3" strokeWidth={2} />
                      </Swap>
                    </span>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ul>
        </AnimatePresence>
      </div>
    </FeatureWindow>
  );
}

/* ------------------------------------------------------------------ */
/*  Story: scheduled export                                            */
/* ------------------------------------------------------------------ */

const EXPORTS = [
  { file: "Invoices, Nov 9", rows: "CSV · 1,251 rows", size: "2.3 MB" },
  { file: "Invoices, Nov 2", rows: "CSV · 1,236 rows", size: "2.2 MB" },
  { file: "Invoices, Oct 26", rows: "CSV · 1,219 rows", size: "2.2 MB" },
];
const EXPORT_RUN = 1.9;
const EXPORT_TIMES = [0.3, 0.3 + EXPORT_RUN + 0.1] as const;

function FileIcon() {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-[5px] bg-foreground/[0.05] text-muted-foreground dark:bg-white/[0.07]">
      <FileSpreadsheet className="size-4" strokeWidth={1.75} />
    </span>
  );
}

function DownloadButton() {
  return (
    <span className="grid size-7 place-items-center rounded-[5px] text-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]">
      <Download className="size-3.5" strokeWidth={2} />
    </span>
  );
}

/** This Monday's export runs: queued, a progress bar fills unevenly, then the file is ready to download. */
export function FeatureExport() {
  const step = useFeatureSteps(EXPORT_TIMES);
  const progress = useMotionValue(step === 2 ? 1 : 0);
  const percent = useTransform(progress, (v) => `${Math.round(v * 100)}%`);
  const { reduce } = useFeatureCard();

  React.useEffect(() => {
    if (step === 0) {
      progress.jump(0);
      return;
    }
    if (step === 2 || reduce) {
      progress.jump(1);
      return;
    }
    const run = animate(progress, [0, 0.16, 0.38, 0.47, 0.81, 1], {
      duration: EXPORT_RUN,
      times: [0, 0.18, 0.4, 0.58, 0.82, 1],
      ease: "linear",
    });
    return () => run.stop();
  }, [step, progress, reduce]);

  return (
    <FeatureWindow>
      <div className="flex h-11 items-center justify-between gap-3 border-b border-black/[0.06] px-3.5 dark:border-white/[0.09]">
        <span className="truncate font-medium">Scheduled exports</span>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground">
          <CalendarClock className="size-3.5" strokeWidth={1.75} />
          Mondays, 09:00
        </span>
      </div>

      <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
        <li className="relative flex h-14 items-center gap-3 px-3.5">
          <FileIcon />
          <span className="grid min-w-0 flex-1">
            <span className="truncate">Invoices, Nov 16</span>
            <span className="grid text-[12px] text-muted-foreground">
              <Swap show={step === 0} className="truncate">CSV · today, 09:00</Swap>
              <Swap show={step === 1} className="truncate">CSV · exporting 1,284 rows</Swap>
              <Swap show={step === 2} className="truncate">CSV · 1,284 rows</Swap>
            </span>
          </span>
          <span className="grid w-[92px] shrink-0 items-center justify-items-end text-[12px] whitespace-nowrap text-muted-foreground">
            <Swap show={step === 0} className="inline-flex items-center gap-1">
              <Clock className="size-3.5" strokeWidth={1.75} />
              Queued
            </Swap>
            <Swap show={step === 1} className="text-foreground tabular-nums">
              <motion.span>{percent}</motion.span>
            </Swap>
            <Swap show={step === 2} className="inline-flex items-center gap-2">
              <span className="tabular-nums">2.4 MB</span>
              <DownloadButton />
            </Swap>
          </span>
          <span
            className={cn(
              "absolute inset-x-3.5 bottom-0 h-0.5 overflow-clip rounded-[1px] bg-foreground/[0.08] transition-opacity duration-300",
              step === 1 ? "opacity-100" : "opacity-0",
            )}
          >
            <motion.span className="block h-full origin-left bg-foreground" style={{ scaleX: progress }} />
          </span>
        </li>
        {EXPORTS.map((x) => (
          <li key={x.file} className="flex h-14 items-center gap-3 px-3.5">
            <FileIcon />
            <span className="grid min-w-0 flex-1">
              <span className="truncate">{x.file}</span>
              <span className="truncate text-[12px] text-muted-foreground">{x.rows}</span>
            </span>
            <span className="inline-flex w-[92px] shrink-0 items-center justify-end gap-2 text-[12px] whitespace-nowrap text-muted-foreground">
              <span className="tabular-nums">{x.size}</span>
              <DownloadButton />
            </span>
          </li>
        ))}
      </ul>
    </FeatureWindow>
  );
}

/* ------------------------------------------------------------------ */
/*  Story: roles                                                       */
/* ------------------------------------------------------------------ */

const ROLES = ["Viewer", "Editor", "Admin"] as const;
const PERMISSIONS = [
  { label: "View projects", viewer: true, editor: true },
  { label: "Edit projects", viewer: false, editor: true },
  { label: "Invite members", viewer: false, editor: true },
  { label: "Manage billing", viewer: false, editor: false },
];
// Open the menu, move to Editor, pick it, then the permissions follow one by one.
const ROLE_TIMES = [0.35, 0.8, 1.2, 1.45, 1.6] as const;

function Switch({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors duration-300",
        on ? "bg-foreground" : "bg-foreground/[0.14] dark:bg-white/[0.16]",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 size-3 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-[translate] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] dark:bg-[#1c1c21]",
          on ? "translate-x-3" : "translate-x-0",
        )}
      />
    </span>
  );
}

/** A member goes from Viewer to Editor; the permissions that come with the role switch on after the pick. */
export function FeatureRoles() {
  const step = useFeatureSteps(ROLE_TIMES);
  const open = step === 1 || step === 2;
  const hovered = step >= 2 ? 1 : 0;
  const role = step >= 3 ? 1 : 0;

  return (
    <FeatureWindow>
      <div className="relative flex h-[60px] items-center gap-3 border-b border-black/[0.06] px-3.5 dark:border-white/[0.09]">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#efe3d1] text-[12px] font-medium text-[#6b4f30] dark:bg-[#3a2f22] dark:text-[#e9d6bb]">
          AT
        </span>
        <span className="grid min-w-0 flex-1">
          <span className="truncate font-medium">Aiko Tanaka</span>
          <span className="truncate text-[12px] text-muted-foreground">aiko@prestigeui.com</span>
        </span>
        <span
          className={cn(
            "inline-flex h-7 w-[86px] shrink-0 items-center justify-between rounded-[5px] pr-1.5 pl-2.5 text-[12.5px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] transition-[background-color,scale] duration-200 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]",
            open ? "bg-foreground/[0.04] dark:bg-white/[0.06]" : "bg-transparent",
          )}
        >
          <span className="grid">
            <Swap show={role === 0}>Viewer</Swap>
            <Swap show={role === 1}>Editor</Swap>
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" strokeWidth={2} />
        </span>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: -2 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.14 } }}
              transition={{ duration: 0.22, ease: EASE }}
              className="absolute top-[50px] right-3.5 z-10 w-[132px] origin-top-right rounded-md bg-white p-1 shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_10px_24px_-10px_rgba(0,0,0,0.25)] dark:bg-[#232329] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_10px_24px_-10px_rgba(0,0,0,0.7)]"
            >
              {ROLES.map((r, i) => (
                <span key={r} className="relative flex h-7 items-center justify-between rounded-[4px] px-2 text-[12.5px]">
                  {i === hovered && (
                    <motion.span
                      layoutId="feature-roles-hover"
                      transition={{ duration: 0.3, ease: EASE }}
                      className="absolute inset-0 rounded-[4px] bg-foreground/[0.06] dark:bg-white/[0.08]"
                    />
                  )}
                  <span className="relative">{r}</span>
                  {i === role && <Check className="relative size-3.5 text-foreground" strokeWidth={2} />}
                </span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="px-3.5 pt-3 pb-1 text-[11.5px] text-muted-foreground">Permissions</div>
      <ul className="px-3.5">
        {PERMISSIONS.map((p, i) => {
          // Granted ones switch on one by one after the pick (steps 4 and 5).
          const on = p.viewer || (p.editor && step >= 3 + i);
          return (
            <li key={p.label} className="flex h-[34px] items-center justify-between gap-3">
              <span className={cn("truncate transition-colors duration-300", on ? "text-foreground" : "text-muted-foreground")}>
                {p.label}
              </span>
              <Switch on={on} />
            </li>
          );
        })}
      </ul>
    </FeatureWindow>
  );
}
