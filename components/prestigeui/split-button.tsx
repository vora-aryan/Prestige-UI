"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown, GitBranch, Loader2, RotateCcw, Rocket, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type SplitOption = {
  value: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
};

type SplitButtonProps = {
  options?: SplitOption[];
  /** The chosen option (controlled). */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Runs the chosen option. While the promise is pending the icon becomes a spinner. */
  onAction?: (value: string) => void | Promise<void>;
  /** Screen reader name for the menu button. */
  menuLabel?: string;
  disabled?: boolean;
  className?: string;
};

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const DEFAULT_OPTIONS: SplitOption[] = [
  { value: "production", label: "Deploy", description: "Build and release to production", icon: Rocket },
  { value: "preview", label: "Deploy to preview", description: "A private URL for this branch", icon: GitBranch },
  { value: "redeploy", label: "Redeploy", description: "Rebuild the live commit", icon: RotateCcw },
];

function SplitButton({
  options = DEFAULT_OPTIONS,
  value: controlled,
  defaultValue,
  onValueChange,
  onAction,
  menuLabel = "More deploy options",
  disabled,
  className,
}: SplitButtonProps) {
  const reduce = Boolean(useReducedMotion());
  const [own, setOwn] = React.useState(defaultValue ?? options[0]?.value);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<"idle" | "running" | "done">("idle");
  const [active, setActive] = React.useState(0);
  const root = React.useRef<HTMLDivElement>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const items = React.useRef<(HTMLButtonElement | null)[]>([]);
  const timer = React.useRef<number | undefined>(undefined);
  const mounted = React.useRef(true);
  const menuId = React.useId();

  const value = controlled ?? own;
  const current = options.find((o) => o.value === value) ?? options[0];
  const Icon = current?.icon;

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(timer.current);
    };
  }, []);

  // Close on a press outside, like any menu.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Focus follows the highlighted item while the menu is open.
  React.useEffect(() => {
    if (open) items.current[active]?.focus({ preventScroll: true });
  }, [open, active]);

  const openMenu = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus({ preventScroll: true });
  };

  const choose = (next: string) => {
    if (controlled === undefined) setOwn(next);
    onValueChange?.(next);
    close();
  };

  const run = async () => {
    if (!current || busy === "running") return;
    setBusy("running");
    try {
      await onAction?.(current.value);
      if (!mounted.current) return;
      setBusy("done");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => mounted.current && setBusy("idle"), 1400);
    } catch {
      if (mounted.current) setBusy("idle");
    }
  };

  const onMenuKey = (event: React.KeyboardEvent) => {
    const last = options.length - 1;
    if (event.key === "ArrowDown") setActive((i) => (i >= last ? 0 : i + 1));
    else if (event.key === "ArrowUp") setActive((i) => (i <= 0 ? last : i - 1));
    else if (event.key === "Home") setActive(0);
    else if (event.key === "End") setActive(last);
    else if (event.key === "Escape") close();
    else if (event.key === "Tab") close(false);
    else return;
    event.preventDefault();
  };

  const ink =
    "bg-primary text-primary-foreground bg-[linear-gradient(to_bottom,rgba(255,255,255,0.10),rgba(255,255,255,0)_55%)] dark:bg-[linear-gradient(to_bottom,rgba(255,255,255,0),rgba(0,0,0,0.06))]";
  const press =
    "transition-[background-color,transform,scale] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-foreground/45 disabled:pointer-events-none";
  const glide = { layout: { duration: 0.32, ease: EASE_OUT } };

  return (
    <div
      ref={root}
      className={cn(
        "relative inline-flex h-9 rounded-md text-[13px] font-medium",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-1px_0_rgba(0,0,0,0.3),0_1px_2px_rgba(0,0,0,0.14),0_4px_10px_-4px_rgba(0,0,0,0.2)] dark:shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)]",
        disabled && "opacity-50",
        className,
      )}
    >
      <button
        type="button"
        disabled={disabled}
        aria-busy={busy === "running"}
        onClick={run}
        className={cn("relative inline-grid place-items-center rounded-l-md pr-3 pl-3.5", ink, press)}
      >
        {/* Invisible copies of every option reserve the widest label. */}
        {options.map((o) => (
          <span key={o.value} aria-hidden className="invisible col-start-1 row-start-1 flex items-center gap-2 whitespace-nowrap">
            <span className="size-4" />
            {o.label}
          </span>
        ))}
        <span className="absolute inset-0 flex items-center justify-center">
          {/* Position only, so the content glides without stretching. */}
          <motion.span layout={reduce ? false : "position"} transition={glide} className="flex items-center gap-2">
            <span className="grid size-4 place-items-center">
              <AnimatePresence initial={false}>
                <motion.span
                  key={busy === "running" ? "spin" : busy === "done" ? "done" : current?.value}
                  initial={{ opacity: 0, scale: reduce ? 1 : 0.6 }}
                  animate={{ opacity: 1, scale: 1, transition: { duration: 0.2, ease: EASE_OUT } }}
                  exit={{ opacity: 0, scale: reduce ? 1 : 0.6, transition: { duration: 0.12 } }}
                  className="col-start-1 row-start-1 grid place-items-center"
                >
                  {busy === "running" ? (
                    <Loader2 className="size-4 animate-spin [animation-duration:700ms]" />
                  ) : busy === "done" ? (
                    <Check className="size-4" strokeWidth={2.5} />
                  ) : Icon ? (
                    <Icon className="size-4" />
                  ) : null}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className="relative grid whitespace-nowrap">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={current?.value}
                  initial={{ opacity: 0, y: reduce ? 0 : 3 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.22, delay: reduce ? 0 : 0.06, ease: EASE_OUT } }}
                  exit={{ opacity: 0, y: reduce ? 0 : -3, transition: { duration: 0.12, ease: EASE_OUT } }}
                  className="col-start-1 row-start-1"
                >
                  {current?.label}
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.span>
        </span>
      </button>

      <span aria-hidden className="w-px bg-white/[0.16] dark:bg-black/[0.14]" />

      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-label={menuLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            openMenu();
          }
        }}
        className={cn("grid w-9 place-items-center rounded-r-md", ink, press)}
      >
        <motion.span
          initial={false}
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: reduce ? 0 : 0.24, ease: EASE_OUT }}
          className="grid"
        >
          <ChevronDown className="size-4" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            role="menu"
            aria-label={menuLabel}
            onKeyDown={onMenuKey}
            initial={{ opacity: 0, scale: reduce ? 1 : 0.96, y: reduce ? 0 : -4 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.18, ease: EASE_OUT } }}
            exit={{ opacity: 0, scale: reduce ? 1 : 0.97, transition: { duration: 0.12, ease: EASE_OUT } }}
            // Grows out of the chevron's corner.
            style={{ transformOrigin: "top right" }}
            className="absolute top-full right-0 z-50 mt-1.5 w-[280px] rounded-lg border border-black/[0.08] bg-background p-1 text-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_2px_4px_rgba(0,0,0,0.04),0_12px_28px_-12px_rgba(0,0,0,0.22)] dark:border-white/[0.1] dark:bg-zinc-900 dark:shadow-[0_12px_28px_-12px_rgba(0,0,0,0.7)]"
          >
            {options.map((o, i) => {
              const ItemIcon = o.icon;
              const selected = o.value === value;
              return (
                <button
                  key={o.value}
                  ref={(el) => {
                    items.current[i] = el;
                  }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  tabIndex={i === active ? 0 : -1}
                  onClick={() => choose(o.value)}
                  onPointerMove={() => setActive(i)}
                  className={cn(
                    "flex w-full cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 text-left outline-none transition-colors duration-100",
                    i === active ? "bg-black/[0.045] dark:bg-white/[0.06]" : "bg-transparent",
                  )}
                >
                  <span className="mt-px grid size-4 shrink-0 place-items-center text-muted-foreground">
                    {ItemIcon ? <ItemIcon className="size-4" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] leading-5 font-medium">{o.label}</span>
                    {o.description && (
                      <span className="block text-[12px] leading-4 text-muted-foreground">{o.description}</span>
                    )}
                  </span>
                  <span className="mt-0.5 grid size-4 shrink-0 place-items-center">
                    {selected && <Check className="size-4" strokeWidth={2.25} />}
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <span className="sr-only" aria-live="polite">
        {busy === "running" ? `${current?.label}…` : busy === "done" ? "Done" : ""}
      </span>
    </div>
  );
}

export { SplitButton, type SplitButtonProps, type SplitOption };
