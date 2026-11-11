"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Ellipsis, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Shared kit for the Settings family: tokens, the page and section layout,
 * rows, inputs, a select, a segmented control, buttons and the save bar
 * that every settings page uses for unsaved changes.
 */

/** Strong ease-out: responds at once, lands softly. */
export const EASE = [0.16, 1, 0.3, 1] as const;

/** Monochrome: value (grey to ink) carries state. Red only means an error. */
export const settingsVars =
  "[--st-pop:#ffffff] dark:[--st-pop:#1f1f23] [--st-danger:#c23b33] dark:[--st-danger:#f0716a]";

export const ring =
  "outline-none focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_oklab,var(--foreground)_14%,transparent)]";

/** A raised layer: hairline, a contact shadow and a soft drop. */
export const popShadow =
  "shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.04),0_18px_40px_-14px_rgba(0,0,0,0.22)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_2px_4px_rgba(0,0,0,0.3),0_18px_40px_-14px_rgba(0,0,0,0.7)]";

/** A scrollbar that is only a thumb. */
export const thinScroll =
  "[@supports(-moz-appearance:none)]:[scrollbar-width:thin] [@supports(-moz-appearance:none)]:[scrollbar-color:color-mix(in_oklab,var(--foreground)_20%,transparent)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-foreground/20";

const noopSubscribe = () => () => {};

/** True once on the client. */
export function useIsClient() {
  return React.useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/** True on Apple devices, where the shortcut key is ⌘. */
export function useIsMac() {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => false,
  );
}

/* ------------------------------------------------------------------ */
/*  Page layout                                                        */
/* ------------------------------------------------------------------ */

export function SettingsPage({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full pb-16 font-sans text-foreground", settingsVars, className)}>
      <header>
        <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em]">{title}</h1>
        {description ? <p className="mt-1 max-w-[56ch] text-[14px] leading-[1.55] text-foreground/55">{description}</p> : null}
      </header>
      <div className="mt-8 flex flex-col gap-10">{children}</div>
    </div>
  );
}

/** A titled group of rows in one hairline card. */
export function SettingsSection({
  title,
  description,
  action,
  children,
  footer,
}: {
  title: React.ReactNode;
  description?: string;
  /** Something at the right of the title, e.g. a filter field. */
  action?: React.ReactNode;
  children: React.ReactNode;
  /** A strip under the rows, e.g. a note on who can see this. */
  footer?: React.ReactNode;
}) {
  const id = React.useId();
  return (
    <section aria-labelledby={id}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id={id} className="text-[15px] leading-6 font-semibold tracking-[-0.01em]">
            {title}
          </h2>
          {description ? <p className="mt-0.5 text-[13px] leading-5 text-foreground/55">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-3 overflow-hidden rounded-[var(--r-panel,14px)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
        <div className="divide-y divide-foreground/[0.07]">{children}</div>
        {footer ? (
          <div className="border-t border-foreground/[0.07] bg-foreground/[0.02] px-5 py-3 text-[13px] text-foreground/55">{footer}</div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * One setting: what it is on the left, the control on the right. A message
 * line under the control is always reserved when `message` is used, so a
 * hint turning into an error never moves the rows below.
 */
export function SettingsRow({
  label,
  description,
  htmlFor,
  children,
  message,
  error,
  stack = false,
}: {
  label: string;
  description?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  /** A hint or status under the control. Pass `null` to reserve the line empty. */
  message?: React.ReactNode;
  error?: React.ReactNode;
  /** Put the control under the label at every width (wide controls). */
  stack?: boolean;
}) {
  const reserve = message !== undefined || error !== undefined;
  return (
    <div className={cn("flex flex-col gap-3 px-5 py-4", !stack && "sm:flex-row sm:items-start sm:gap-8")}>
      <div className={cn("min-w-0", !stack && "sm:w-[40%] sm:shrink-0 sm:pt-2")}>
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-[14px] leading-5 font-medium">
            {label}
          </label>
        ) : (
          <p className="text-[14px] leading-5 font-medium">{label}</p>
        )}
        {description ? <p className="mt-0.5 text-[13px] leading-5 text-foreground/55">{description}</p> : null}
      </div>
      <div className="min-w-0 flex-1">
        {children}
        {reserve ? <Message id={htmlFor ? `${htmlFor}-message` : undefined} hint={message} error={error} /> : null}
      </div>
    </div>
  );
}

/** One reserved line that crossfades between a hint and an error. */
export function Message({ id, hint, error }: { id?: string; hint?: React.ReactNode; error?: React.ReactNode }) {
  return (
    <p id={id} aria-live="polite" className="mt-1.5 grid min-h-[18px] text-[12.5px] leading-[18px]">
      <AnimatePresence initial={false} mode="popLayout">
        {error ? (
          <motion.span
            key="error"
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            className="col-start-1 row-start-1 text-(--st-danger)"
          >
            {error}
          </motion.span>
        ) : hint ? (
          <motion.span
            key={typeof hint === "string" ? hint : "hint"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.22 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            className="col-start-1 row-start-1 flex min-w-0 items-center gap-1.5 text-foreground/55"
          >
            {hint}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/*  Inputs and buttons                                                 */
/* ------------------------------------------------------------------ */

export const inputClass = (invalid?: boolean) =>
  cn(
    "h-9 w-full rounded-[var(--r-control,10px)] border bg-background px-3 text-[14px] text-foreground outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-foreground/35 disabled:opacity-60 dark:bg-white/[0.02]",
    invalid
      ? "border-(--st-danger)/70 shadow-[0_0_0_3px_color-mix(in_oklab,var(--st-danger)_12%,transparent)]"
      : "border-foreground/[0.12] hover:border-foreground/25 focus:border-foreground/40 focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--foreground)_10%,transparent)]",
  );

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-3.5 animate-spin rounded-full border-[1.5px] border-current/25 border-t-current motion-reduce:animate-none", className)}
    />
  );
}

/**
 * Buttons in three weights. While busy, the label fades out and a spinner
 * fades in within the same box, so the width never changes.
 */
export function Button({
  variant = "secondary",
  busy = false,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      aria-busy={busy || undefined}
      disabled={props.disabled || busy}
      className={cn(
        "relative inline-grid h-9 shrink-0 cursor-pointer place-items-center rounded-[var(--r-control,10px)] px-3.5 text-[13.5px] font-medium whitespace-nowrap transition-[transform,background-color,box-shadow,color,opacity] duration-150 active:scale-[0.98] disabled:cursor-default disabled:active:scale-100",
        variant === "primary" && "bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40",
        variant === "secondary" &&
          "bg-background text-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)] hover:bg-foreground/[0.04] disabled:opacity-50 dark:bg-transparent dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]",
        variant === "ghost" && "text-foreground/65 hover:bg-foreground/[0.05] hover:text-foreground disabled:opacity-50",
        variant === "danger" &&
          "bg-background text-(--st-danger) shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--st-danger)_35%,transparent)] hover:bg-[color-mix(in_oklab,var(--st-danger)_6%,transparent)] disabled:opacity-50 dark:bg-transparent",
        ring,
        className,
      )}
    >
      <span className={cn("col-start-1 row-start-1 inline-flex items-center gap-2 transition-opacity duration-150", busy && "opacity-0")}>
        {children}
      </span>
      <span className={cn("col-start-1 row-start-1 transition-opacity duration-150", busy ? "opacity-100" : "pointer-events-none opacity-0")}>
        <Spinner />
      </span>
    </button>
  );
}

/** A small label on a value: Verified, Primary, Owner. */
export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-[6px] bg-foreground/[0.06] px-1.5 text-[11.5px] font-medium whitespace-nowrap text-foreground/65",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Segmented control                                                  */
/* ------------------------------------------------------------------ */

/** A small radio group with a sliding pill. Arrow keys move the choice. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const id = React.useId();
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex max-w-full rounded-[var(--r-control,10px)] bg-foreground/[0.05] p-0.5"
      onKeyDown={(event) => {
        const index = options.findIndex((option) => option.value === value);
        const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        const next = (index + step + options.length) % options.length;
        onChange(options[next].value);
        refs.current[next]?.focus();
      }}
    >
      {options.map((option, i) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[i] = node;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative h-8 min-w-0 cursor-pointer rounded-[var(--r-item,8px)] px-3 text-[13px] font-medium whitespace-nowrap tabular-nums transition-colors duration-200",
              on ? "text-foreground" : "text-foreground/55 hover:text-foreground/80",
              ring,
            )}
          >
            {on ? (
              <motion.span
                layoutId={`${id}-pill`}
                transition={{ type: "spring", stiffness: 420, damping: 38 }}
                className="absolute inset-0 rounded-[var(--r-item,8px)] bg-(--st-pop) shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.06)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
              />
            ) : null}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Anchored layers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Keeps a fixed layer under its button, or above it when there is no room
 * below, and inside the window. `width` "anchor" matches the button.
 */
export function useAnchoredLayer(
  open: boolean,
  anchor: () => HTMLElement | null,
  layer: () => HTMLElement | null,
  { minWidth = 0, align = "start", width = "anchor" }: { minWidth?: number; align?: "start" | "end"; width?: "anchor" | "auto" } = {},
  key?: unknown,
) {
  React.useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const button = anchor();
      const panel = layer();
      if (!button || !panel) return;
      const rect = button.getBoundingClientRect();
      if (width === "anchor") panel.style.width = `${Math.round(Math.max(rect.width, minWidth))}px`;
      else panel.style.minWidth = `${minWidth}px`;
      const height = panel.offsetHeight;
      const below = window.innerHeight - rect.bottom - 8;
      const top = below >= height || below >= rect.top ? rect.bottom + 6 : rect.top - 6 - height;
      const left = align === "end" ? rect.right - panel.offsetWidth : rect.left;
      panel.style.left = `${Math.round(Math.min(Math.max(8, left), window.innerWidth - panel.offsetWidth - 8))}px`;
      panel.style.top = `${Math.round(Math.max(8, top))}px`;
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchor, layer, minWidth, align, width, key]);
}

/** Closes a layer on a press outside it and its button. */
export function useDismiss(open: boolean, refs: React.RefObject<HTMLElement | null>[], onDismiss: () => void) {
  React.useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (refs.some((ref) => ref.current?.contains(target))) return;
      onDismiss();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onDismiss]);
}

/* ------------------------------------------------------------------ */
/*  Select                                                             */
/* ------------------------------------------------------------------ */

export type SelectOption = { value: string; label: string; detail?: string; disabled?: boolean };

/**
 * A button that opens a list in a layer above the page (so no scrolling box
 * clips it). Long lists get a filter field. Arrow keys, Home, End, Enter
 * and Escape work as in a native select.
 */
export function Select({
  id,
  label,
  value,
  options,
  onChange,
  searchable = false,
  hideDetail = false,
  confirmed = false,
  className,
}: {
  id?: string;
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  searchable?: boolean;
  /** Show only the label on the button; details stay in the list. */
  hideDetail?: boolean;
  /** Briefly true after a change saves: the chevron turns into a check, in the same box. */
  confirmed?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [filter, setFilter] = React.useState("");
  const [active, setActive] = React.useState(0);
  const button = React.useRef<HTMLButtonElement>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  const filterInput = React.useRef<HTMLInputElement>(null);
  const listId = React.useId();
  const isClient = useIsClient();
  const current = options.find((option) => option.value === value);

  const needle = filter.trim().toLowerCase();
  const shown = needle
    ? options.filter((option) => `${option.label} ${option.detail ?? ""}`.toLowerCase().includes(needle))
    : options;
  const chosen = Math.min(active, Math.max(0, shown.length - 1));

  const openList = () => {
    setFilter("");
    setActive(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen(true);
  };

  const close = React.useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus({ preventScroll: true });
  }, []);

  const pick = (option: SelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    close();
  };

  useAnchoredLayer(open, () => button.current, () => panel.current, { minWidth: 240 }, shown.length);
  useDismiss(open, [panel, button], () => close(false));

  React.useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => (searchable ? filterInput.current : panel.current)?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [open, searchable]);

  // Keep the active option in view; only the list scrolls.
  React.useEffect(() => {
    const box = panel.current?.querySelector<HTMLElement>("[role=listbox]");
    const row = box?.querySelector<HTMLElement>("[data-active=true]");
    if (!box || !row) return;
    if (row.offsetTop < box.scrollTop) box.scrollTo({ top: row.offsetTop - 4 });
    else if (row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight)
      box.scrollTo({ top: row.offsetTop + row.offsetHeight - box.clientHeight + 4 });
  }, [chosen, open]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((chosen + 1) % Math.max(1, shown.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((chosen - 1 + shown.length) % Math.max(1, shown.length));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(Math.max(0, shown.length - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (shown[chosen]) pick(shown[chosen]);
    } else if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") event.preventDefault();
      close(event.key === "Escape");
    }
  };

  return (
    <>
      <button
        ref={button}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current?.label ?? "None"}`}
        onClick={() => (open ? close() : openList())}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            openList();
          }
        }}
        className={cn(inputClass(), "flex cursor-pointer items-center gap-2 text-left aria-expanded:border-foreground/40", className)}
      >
        <span className="min-w-0 flex-1 truncate">{current?.label ?? "Choose…"}</span>
        {current?.detail && !hideDetail ? <span className="shrink-0 text-[13px] text-foreground/45 tabular-nums">{current.detail}</span> : null}
        <span aria-hidden className="relative size-4 shrink-0">
          <ChevronDown
            className={cn("absolute inset-0 size-4 text-foreground/45 transition-opacity duration-200", confirmed && "opacity-0")}
            strokeWidth={1.8}
          />
          <Check
            className={cn("absolute inset-0 size-4 text-foreground transition-opacity duration-200", !confirmed && "opacity-0")}
            strokeWidth={2.2}
          />
        </span>
      </button>
      {isClient
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <motion.div
                  ref={panel}
                  tabIndex={-1}
                  onKeyDown={onKeyDown}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.18, ease: EASE } }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  className={cn("fixed z-[1000] overflow-hidden rounded-[var(--r-panel,14px)] bg-(--st-pop) font-sans text-foreground outline-none", settingsVars, popShadow)}
                >
                  {searchable ? (
                    <div className="flex items-center gap-2 border-b border-foreground/[0.07] px-3">
                      <Search aria-hidden className="size-4 shrink-0 text-foreground/40" strokeWidth={1.8} />
                      <input
                        ref={filterInput}
                        value={filter}
                        aria-label={`Filter ${label.toLowerCase()}`}
                        aria-controls={listId}
                        aria-activedescendant={shown[chosen] ? `${listId}-${shown[chosen].value}` : undefined}
                        placeholder="Filter"
                        onChange={(event) => {
                          setFilter(event.target.value);
                          setActive(0);
                        }}
                        className="h-10 min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-foreground/40"
                      />
                    </div>
                  ) : null}
                  <div
                    id={listId}
                    role="listbox"
                    aria-label={label}
                    aria-activedescendant={!searchable && shown[chosen] ? `${listId}-${shown[chosen].value}` : undefined}
                    className={cn("relative max-h-[264px] overflow-y-auto p-1.5", thinScroll)}
                  >
                    {shown.length === 0 ? (
                      <p className="px-2.5 py-3 text-[13px] text-foreground/50">Nothing matches &ldquo;{filter.trim()}&rdquo;.</p>
                    ) : (
                      shown.map((option, i) => (
                        <div
                          key={option.value}
                          id={`${listId}-${option.value}`}
                          role="option"
                          aria-selected={option.value === value}
                          aria-disabled={option.disabled || undefined}
                          data-active={i === chosen}
                          onPointerMove={() => setActive(i)}
                          onPointerDown={(event) => event.preventDefault()}
                          onClick={() => pick(option)}
                          className={cn(
                            "flex h-9 cursor-pointer items-center gap-2.5 rounded-[var(--r-item,9px)] px-2.5 text-[13.5px] data-[active=true]:bg-foreground/[0.055]",
                            option.disabled && "cursor-default text-foreground/40",
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate">{option.label}</span>
                          {option.detail ? <span className="shrink-0 text-[12.5px] text-foreground/45 tabular-nums">{option.detail}</span> : null}
                          <Check
                            aria-hidden
                            className={cn("size-4 shrink-0", option.value === value ? "text-foreground/75" : "text-transparent")}
                            strokeWidth={2}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Avatar                                                             */
/* ------------------------------------------------------------------ */

export type Person = { name: string; email?: string; avatar?: string };

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** A photo, or initials on a quiet disc. An email alone shows its first letter. */
export function Avatar({ person, size = 32, className }: { person: Person; size?: number; className?: string }) {
  return person.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={person.avatar}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={cn("shrink-0 rounded-full bg-foreground/10 object-cover", className)}
      draggable={false}
    />
  ) : (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      className={cn("grid shrink-0 place-items-center rounded-full bg-foreground/[0.07] font-semibold text-foreground/65", className)}
    >
      {person.name ? initials(person.name) : (person.email?.[0] ?? "?").toUpperCase()}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Menu                                                               */
/* ------------------------------------------------------------------ */

export type MenuItem = {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  danger?: boolean;
  /** Shown instead of running, e.g. why the owner can't be removed. */
  disabledReason?: string;
  onSelect?: () => void;
};

/** A ⋯ button that opens a short list of actions. Arrow keys move between them. */
export function Menu({
  label,
  items,
  confirmed = false,
  className,
}: {
  label: string;
  items: MenuItem[];
  /** Briefly true after an action finishes: the ⋯ turns into a check, in the same box. */
  confirmed?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const button = React.useRef<HTMLButtonElement>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  const isClient = useIsClient();
  const close = React.useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus({ preventScroll: true });
  }, []);

  useAnchoredLayer(open, () => button.current, () => panel.current, { minWidth: 200, align: "end", width: "auto" });
  useDismiss(open, [panel, button], () => close(false));

  React.useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "grid size-8 shrink-0 cursor-pointer place-items-center rounded-[var(--r-item,9px)] text-foreground/50 transition-colors duration-150 hover:bg-foreground/[0.06] hover:text-foreground aria-expanded:bg-foreground/[0.06] aria-expanded:text-foreground",
          ring,
          className,
        )}
      >
        <span aria-hidden className="relative size-4">
          <Ellipsis className={cn("absolute inset-0 size-4 transition-opacity duration-200", confirmed && "opacity-0")} strokeWidth={1.9} />
          <Check
            className={cn("absolute inset-0 size-4 text-foreground transition-opacity duration-200", !confirmed && "opacity-0")}
            strokeWidth={2.2}
          />
        </span>
      </button>
      {isClient
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <motion.div
                  ref={panel}
                  role="menu"
                  aria-label={label}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.18, ease: EASE } }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  onKeyDown={(event) => {
                    const rows = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]"));
                    const index = rows.indexOf(document.activeElement as HTMLElement);
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                      event.preventDefault();
                      const step = event.key === "ArrowDown" ? 1 : -1;
                      rows[(index + step + rows.length) % rows.length]?.focus();
                    } else if (event.key === "Escape" || event.key === "Tab") {
                      if (event.key === "Escape") event.preventDefault();
                      close(event.key === "Escape");
                    }
                  }}
                  className={cn("fixed z-[1000] rounded-[var(--r-panel,14px)] bg-(--st-pop) p-1.5 font-sans text-foreground", settingsVars, popShadow)}
                >
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      aria-disabled={item.disabledReason ? true : undefined}
                      onClick={() => {
                        if (item.disabledReason) return;
                        close();
                        item.onSelect?.();
                      }}
                      className={cn(
                        "flex w-full cursor-pointer items-start gap-2.5 rounded-[var(--r-item,9px)] px-2.5 py-2 text-left text-[13.5px] outline-none hover:bg-foreground/[0.05] focus-visible:bg-foreground/[0.05]",
                        item.danger && !item.disabledReason ? "text-(--st-danger)" : "text-foreground",
                        item.disabledReason && "cursor-default",
                      )}
                    >
                      {item.icon ? <item.icon className={cn("mt-0.5 size-4 shrink-0", item.disabledReason ? "opacity-40" : "opacity-70")} strokeWidth={1.8} /> : null}
                      <span className="min-w-0">
                        <span className={cn("block", item.disabledReason && "text-foreground/40")}>{item.label}</span>
                        {item.disabledReason ? <span className="mt-0.5 block max-w-[220px] text-[12px] leading-4 text-foreground/50">{item.disabledReason}</span> : null}
                      </span>
                    </button>
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Checkbox and switch                                                */
/* ------------------------------------------------------------------ */

/**
 * A square checkbox. A locked one stays checked and says why on hover,
 * for things that can't be turned off.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  locked,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Read by screen readers, e.g. "Mentions by email". */
  label: string;
  /** Why it can't be changed. */
  locked?: string;
  disabled?: boolean;
}) {
  const off = Boolean(locked) || disabled;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      aria-disabled={off || undefined}
      title={locked}
      onClick={() => {
        if (!off) onChange(!checked);
      }}
      className={cn(
        "relative grid size-[18px] shrink-0 place-items-center rounded-[5px] transition-[background-color,box-shadow,opacity] duration-150",
        checked
          ? locked
            ? "bg-foreground/30"
            : "bg-foreground"
          : "shadow-[inset_0_0_0_1.5px_color-mix(in_oklab,var(--foreground)_28%,transparent)] hover:shadow-[inset_0_0_0_1.5px_color-mix(in_oklab,var(--foreground)_50%,transparent)]",
        off ? "cursor-default" : "cursor-pointer",
        disabled && "opacity-40",
        ring,
      )}
    >
      <Check
        aria-hidden
        className={cn("size-3 text-background transition-[opacity,scale] duration-150", checked ? "scale-100 opacity-100" : "scale-75 opacity-0")}
        strokeWidth={3}
      />
    </button>
  );
}

/** An on/off switch. The thumb travels; nothing else moves. */
export function Switch({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-[34px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200",
        checked ? "bg-foreground" : "bg-foreground/[0.16]",
        ring,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-0.5 size-4 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-[translate,background-color] duration-200 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none",
          // The thumb always contrasts with its track, in both themes.
          checked ? "translate-x-[14px] bg-background" : "translate-x-0 bg-white dark:bg-foreground/75",
        )}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Save bar                                                           */
/* ------------------------------------------------------------------ */

export type SaveState = "idle" | "dirty" | "saving" | "saved";

/**
 * The bar for unsaved changes. It rises when something changes, offers
 * Discard and Save (⌘S / Ctrl+S saves too), says so when a field needs
 * fixing first, and confirms "Saved" before it leaves.
 */
export function SaveBar({
  state,
  invalid = 0,
  waiting,
  message,
  noun = "field",
  onSave,
  onDiscard,
  className,
}: {
  state: SaveState;
  /** How many fields block saving. */
  invalid?: number;
  /** Says what changed instead of "You have unsaved changes", e.g. "3 unsaved changes". */
  message?: string;
  /** What the invalid things are called, e.g. "cell". */
  noun?: string;
  /** Something to finish before saving, e.g. "Checking the username". Holds Save until it clears. */
  waiting?: string | null;
  onSave: () => void;
  onDiscard: () => void;
  className?: string;
}) {
  const mac = useIsMac();
  const show = state !== "idle";
  const blocked = invalid > 0 || Boolean(waiting);

  // ⌘S / Ctrl+S saves while there is something to save.
  React.useEffect(() => {
    if (state !== "dirty") return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      if (!blocked) onSave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, blocked, onSave]);

  const text =
    state === "saved"
      ? "Changes saved"
      : state === "saving"
        ? "Saving changes"
        : invalid > 0
          ? `Fix ${invalid === 1 ? `1 ${noun}` : `${invalid} ${noun}s`} to save`
          : waiting
            ? waiting
            : (message ?? "You have unsaved changes");

  return (
    <div className={cn("pointer-events-none sticky bottom-0 z-20 flex justify-center pt-6 pb-5", settingsVars, className)}>
      <AnimatePresence>
        {show ? (
          <motion.div
            key="bar"
            role="region"
            aria-label="Unsaved changes"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE } }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.18, ease: EASE } }}
            className={cn(
              "pointer-events-auto flex h-12 w-full max-w-[520px] items-center gap-3 rounded-[var(--r-panel,14px)] bg-(--st-pop) pr-2 pl-4",
              popShadow,
            )}
          >
            <span className="relative grid min-w-0 flex-1 text-[13.5px]">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={text}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.26, ease: EASE } }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  aria-live="polite"
                  className={cn(
                    "col-start-1 row-start-1 flex items-center gap-1.5 truncate",
                    invalid > 0 && state === "dirty" ? "text-(--st-danger)" : "text-foreground/75",
                  )}
                >
                  {state === "saved" ? <Check aria-hidden className="size-4 shrink-0" strokeWidth={2.2} /> : null}
                  {text}
                </motion.span>
              </AnimatePresence>
            </span>
            <div className={cn("flex items-center gap-1.5 transition-opacity duration-200", state === "saved" && "pointer-events-none opacity-0")}>
              <Button variant="ghost" onClick={onDiscard} disabled={state === "saving"}>
                Discard
              </Button>
              <Button variant="primary" onClick={onSave} busy={state === "saving"} disabled={blocked}>
                Save
                <span className="hidden text-background/55 sm:inline">{mac ? "⌘S" : "Ctrl+S"}</span>
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * Tracks a form against its last saved copy: dirty when they differ,
 * then saving, then a short "saved" before the bar leaves.
 */
export function useSaveState<T>(saved: T, draft: T, save: (draft: T) => Promise<void>, commit: (draft: T) => void) {
  const [phase, setPhase] = React.useState<"idle" | "saving" | "saved">("idle");
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);
  const state: SaveState = phase === "saving" ? "saving" : phase === "saved" ? "saved" : dirty ? "dirty" : "idle";

  React.useEffect(() => {
    if (phase !== "saved") return;
    const timer = window.setTimeout(() => setPhase("idle"), 1400);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const run = React.useCallback(async () => {
    setPhase("saving");
    try {
      await save(draft);
      commit(draft);
      setPhase("saved");
    } catch {
      setPhase("idle");
    }
  }, [save, commit, draft]);

  return { state, dirty, save: run };
}
