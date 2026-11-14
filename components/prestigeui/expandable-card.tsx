"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "motion/react";
import { ArrowUpRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ExpandableCardSection {
  title: string;
  /** A paragraph. */
  body?: string;
  /** A list of short points. */
  items?: string[];
}

export interface ExpandableCardProps {
  /** Small label above the title, e.g. a team or a category. */
  eyebrow?: string;
  title: string;
  /** Short facts shown under the title, e.g. ["Berlin or remote", "Full time"]. */
  meta?: string[];
  /** One or two lines on the closed card. */
  summary?: string;
  /** The detail, as titled sections. */
  sections?: ExpandableCardSection[];
  /** Extra detail after the sections. */
  children?: React.ReactNode;
  /** A key fact in the open card's footer, e.g. a salary range or a date. */
  footnote?: string;
  /** The main action in the open card's footer. */
  action?: { label: string; href?: string; onClick?: () => void };
  /** Label of the cue on the closed card. Default "View details". */
  cue?: string;
  className?: string;
}

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
// The open and close are travel, so they use an even spring with no bounce.
const MORPH = { type: "spring", stiffness: 380, damping: 38, mass: 0.9 } as const;
const PHONE = "(max-width: 639px)";

function subscribe(query: string) {
  return (callback: () => void) => {
    const list = window.matchMedia(query);
    list.addEventListener("change", callback);
    return () => list.removeEventListener("change", callback);
  };
}
function useMedia(query: string) {
  return React.useSyncExternalStore(
    subscribe(query),
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Keeps Tab inside the open card, and remembers what to focus on close. */
function useFocusTrap(open: boolean, root: React.RefObject<HTMLElement | null>, initial: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => initial.current?.focus({ preventScroll: true }));
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !root.current) return;
      const items = root.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, root, initial]);
}

/** Locks page scroll while open, keeping the scrollbar's width so nothing shifts. */
function useScrollLock(open: boolean) {
  React.useEffect(() => {
    if (!open) return;
    const { body, documentElement } = document;
    const gap = window.innerWidth - documentElement.clientWidth;
    const prev = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = prev.overflow;
      body.style.paddingRight = prev.paddingRight;
    };
  }, [open]);
}

export function ExpandableCard({
  eyebrow,
  title,
  meta = [],
  summary,
  sections = [],
  children,
  footnote,
  action,
  cue = "View details",
  className,
}: ExpandableCardProps) {
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const phone = useMedia(PHONE);
  const reduce = useMedia("(prefers-reduced-motion: reduce)");
  const trigger = React.useRef<HTMLButtonElement>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  const closeButton = React.useRef<HTMLButtonElement>(null);
  const drag = useDragControls();

  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useFocusTrap(open, panel, closeButton);
  useScrollLock(open);

  const close = React.useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  const morph = reduce ? { duration: 0 } : MORPH;
  const layout = (part: string) => `${id}-${part}`;

  const head = (variant: "card" | "open") => (
    <>
      {eyebrow && (
        <motion.p layoutId={layout("eyebrow")}
          layoutCrossfade={false} layout="position" transition={morph} className="text-[12px] text-muted-foreground">
          {eyebrow}
        </motion.p>
      )}
      <motion.h3
        layoutId={layout("title")}
          layoutCrossfade={false}
        layout="position"
        transition={morph}
        id={variant === "open" ? layout("label") : undefined}
        className="mt-1.5 text-[17px] leading-snug font-medium tracking-[-0.01em] text-foreground"
      >
        {title}
      </motion.h3>
      {meta.length > 0 && (
        <motion.p
          layoutId={layout("meta")}
          layoutCrossfade={false}
          layout="position"
          transition={morph}
          className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground"
        >
          {meta.map((m, i) => (
            <React.Fragment key={m}>
              {i > 0 && <span aria-hidden className="size-[3px] rounded-full bg-current opacity-50" />}
              <span>{m}</span>
            </React.Fragment>
          ))}
        </motion.p>
      )}
    </>
  );

  return (
    <>
      <motion.div
        layoutId={layout("panel")}
        layoutCrossfade={false}
        transition={morph}
        className={cn(
          "group relative min-w-0 bg-background shadow-[0_0_0_1px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] transition-shadow duration-200 hover:shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_8px_24px_-12px_rgba(0,0,0,0.18)] dark:bg-[#17171b] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.14),inset_0_1px_0_rgba(255,255,255,0.05)] dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]",
          open && "invisible",
          className,
        )}
        style={{ borderRadius: 8 }}
      >
        <button
          ref={trigger}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="flex h-full w-full flex-col p-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
          style={{ borderRadius: 8 }}
        >
          {head("card")}
          {summary && <p className="mt-3 line-clamp-3 text-[14px] leading-relaxed text-muted-foreground">{summary}</p>}
          <span className="mt-auto flex items-center gap-1 pt-5 text-[13px] font-medium text-foreground">
            {cue}
            <ArrowUpRight
              className="size-3.5 transition-[translate] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              strokeWidth={2}
            />
          </span>
        </button>
      </motion.div>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <div className="fixed inset-0 z-[1000] flex items-end justify-center font-sans sm:items-center sm:p-6">
                <motion.div
                  aria-hidden
                  className="absolute inset-0 bg-black/30 dark:bg-black/55"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.3, ease: EASE_OUT } }}
                  exit={{ opacity: 0, transition: { duration: 0.2 } }}
                  onClick={close}
                />
                <motion.div
                  ref={panel}
                  layoutId={layout("panel")}
        layoutCrossfade={false}
                  transition={morph}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={layout("label")}
                  className="relative flex max-h-[88dvh] w-full flex-col overflow-hidden bg-background text-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_24px_64px_-24px_rgba(0,0,0,0.4)] sm:max-h-[min(720px,85dvh)] sm:max-w-[620px] dark:bg-[#17171b] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.14),inset_0_1px_0_rgba(255,255,255,0.05),0_24px_64px_-24px_rgba(0,0,0,0.8)]"
                  style={{ borderRadius: phone ? "8px 8px 0 0" : 8 }}
                  drag={phone && !reduce ? "y" : false}
                  dragControls={drag}
                  dragListener={false}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0, bottom: 0.6 }}
                  onDragEnd={(_, info: PanInfo) => {
                    if (info.offset.y > 120 || info.velocity.y > 600) close();
                  }}
                >
                  {/* Header: also the drag handle on phones. */}
                  {/* Each part opts into layout correction, so the panel's growth
                      moves it without squashing its text. */}
                  <motion.div
                    layout="position"
                    transition={morph}
                    className={cn("relative shrink-0 px-6 pt-6 pb-5 sm:px-7 sm:pt-7", phone && "touch-none")}
                    onPointerDown={(event) => phone && drag.start(event)}
                  >
                    {phone && <span aria-hidden className="absolute top-2 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-foreground/15" />}
                    <div className="pr-10">{head("open")}</div>
                    <button
                      ref={closeButton}
                      type="button"
                      onClick={close}
                      aria-label="Close"
                      className="absolute top-5 right-5 grid size-8 place-items-center rounded-md text-muted-foreground transition-colors duration-150 outline-none hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground/20"
                    >
                      <X className="size-4" strokeWidth={2} />
                    </button>
                  </motion.div>

                  {/* Body: arrives once the panel has settled. */}
                  <motion.div
                    layout="position"
                    transition={morph}
                    className="min-h-0 flex-1 overflow-y-auto border-t border-foreground/[0.07] dark:border-white/[0.1] px-6 py-6 sm:px-7"
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT, delay: reduce ? 0 : 0.12 } }}
                    exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  >
                    <div className="space-y-6">
                      {sections.map((section) => (
                        <section key={section.title}>
                          <h4 className="text-[13px] font-medium text-foreground">{section.title}</h4>
                          {section.body && (
                            <p className="mt-2 text-[14px] leading-relaxed text-pretty text-muted-foreground">{section.body}</p>
                          )}
                          {section.items && (
                            <ul className="mt-2.5 space-y-2">
                              {section.items.map((item) => (
                                <li key={item} className="flex gap-2.5 text-[14px] leading-relaxed text-muted-foreground">
                                  <span aria-hidden className="mt-[0.6em] h-px w-2.5 shrink-0 bg-foreground/30" />
                                  <span className="text-pretty">{item}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </section>
                      ))}
                      {children}
                    </div>
                  </motion.div>

                  {(footnote || action) && (
                    <motion.div
                      layout="position"
                      transition={morph}
                      className="flex shrink-0 items-center justify-between gap-4 border-t border-foreground/[0.07] dark:border-white/[0.1] px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7"
                      initial={reduce ? false : { opacity: 0 }}
                      animate={{ opacity: 1, transition: { duration: 0.35, delay: reduce ? 0 : 0.18 } }}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                    >
                      <span className="text-[13px] text-muted-foreground tabular-nums">{footnote}</span>
                      {action &&
                        (action.href ? (
                          <a
                            href={action.href}
                            onClick={action.onClick}
                            className="inline-flex h-9 items-center rounded-md bg-foreground px-3.5 text-[13px] font-medium text-background transition-opacity duration-150 outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          >
                            {action.label}
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={action.onClick}
                            className="inline-flex h-9 items-center rounded-md bg-foreground px-3.5 text-[13px] font-medium text-background transition-opacity duration-150 outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          >
                            {action.label}
                          </button>
                        ))}
                    </motion.div>
                  )}
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
