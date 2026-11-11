"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Shared kit for the Command palette family: tokens, the dialog that holds a
 * palette, ⌘K handling, keyboard hints, and the matching that ranks and marks
 * results as you type.
 */

/** Strong ease-out: responds at once, lands softly. */
export const EASE = [0.16, 1, 0.3, 1] as const;

/** Monochrome: value (grey to ink) carries state. */
export const commandVars = "[--cp-pop:#ffffff] dark:[--cp-pop:#1c1c20]";

export const ring =
  "outline-none focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_oklab,var(--foreground)_14%,transparent)]";

/** A raised layer: hairline, a contact shadow and a soft drop. */
export const popShadow =
  "shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.04),0_24px_56px_-18px_rgba(0,0,0,0.28)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_2px_4px_rgba(0,0,0,0.3),0_24px_56px_-18px_rgba(0,0,0,0.75)]";

/** A scrollbar that is only a thumb. */
export const thinScroll =
  "[@supports(-moz-appearance:none)]:[scrollbar-width:thin] [@supports(-moz-appearance:none)]:[scrollbar-color:color-mix(in_oklab,var(--foreground)_20%,transparent)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-track]:my-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-foreground/20";

/** A row in a result list. `data-active` marks the one Enter will open. */
export const optionRow =
  "flex h-9 w-full cursor-pointer items-center gap-3 rounded-[10px] px-2.5 text-left text-[13.5px] text-foreground select-none data-[active=true]:bg-foreground/[0.055]";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Any icon component: a lucide icon, or your own mark. */
export type CommandIcon = React.ComponentType<{ className?: string; strokeWidth?: number }>;

/* ------------------------------------------------------------------ */
/*  Platform and keys                                                  */
/* ------------------------------------------------------------------ */

const noopSubscribe = () => () => {};

/** True on Apple devices, where the shortcut key is ⌘. The server says no. */
export function useIsMac() {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => false,
  );
}

/** True once on the client. */
export function useIsClient() {
  return React.useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/** Writes "mod" as ⌘ on Apple devices and Ctrl elsewhere. */
export function keyLabel(key: string, mac: boolean) {
  if (key === "mod") return mac ? "⌘" : "Ctrl";
  if (key === "shift") return mac ? "⇧" : "Shift";
  if (key === "alt") return mac ? "⌥" : "Alt";
  return key;
}

/** One key, or a short run of them ("G" then "I"). Hidden on touch screens. */
export function Keys({ keys, className }: { keys: string[]; className?: string }) {
  const mac = useIsMac();
  return (
    <span className={cn("flex shrink-0 items-center gap-1 [@media(hover:none)]:hidden", className)}>
      {keys.map((key, i) => (
        <kbd
          key={i}
          className="grid h-5 min-w-5 place-items-center rounded-[5px] px-1 font-sans text-[11px] font-normal text-foreground/50 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
        >
          {keyLabel(key, mac)}
        </kbd>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Matching                                                           */
/* ------------------------------------------------------------------ */

export type Match = { score: number; marks: number[] };

const isWordStart = (text: string, i: number) => i === 0 || /[\s\-_/.]/.test(text[i - 1]);

/**
 * How well `query` matches `text`, and which letters to mark. A run at the
 * start of the text wins, then one at the start of a word, then anywhere;
 * last come letters in order with gaps ("nwp" for "New project"). Null when
 * the letters are not all there.
 */
export function matchText(text: string, query: string): Match | null {
  const needle = query.trim().toLowerCase();
  if (!needle) return { score: 0, marks: [] };
  const haystack = text.toLowerCase();
  const at = haystack.indexOf(needle);
  if (at >= 0) {
    let start = at;
    // Prefer the same run at the start of a later word.
    for (let i = at; i >= 0; i = haystack.indexOf(needle, i + 1)) {
      if (isWordStart(haystack, i)) {
        start = i;
        break;
      }
    }
    const marks = Array.from({ length: needle.length }, (_, i) => start + i);
    const score = start === 0 ? 100 : isWordStart(haystack, start) ? 80 : 60;
    return { score: score - text.length * 0.05, marks };
  }
  const compact = needle.replace(/\s+/g, "");
  const marks: number[] = [];
  let from = 0;
  let starts = 0;
  for (const letter of compact) {
    const i = haystack.indexOf(letter, from);
    if (i < 0) return null;
    if (isWordStart(haystack, i)) starts += 1;
    marks.push(i);
    from = i + 1;
  }
  const spread = marks[marks.length - 1] - marks[0];
  return { score: 30 + starts * 4 - spread * 0.5, marks };
}

/** The best match across a label and its extra search words. Marks only land on the label. */
export function matchItem(label: string, keywords: string[] | undefined, query: string): Match | null {
  const own = matchText(label, query);
  let best = own;
  for (const word of keywords ?? []) {
    const other = matchText(word, query);
    if (other && (!best || other.score - 5 > best.score)) best = { score: other.score - 5, marks: own?.marks ?? [] };
  }
  return best;
}

/**
 * The label with matched letters in full ink and the rest a step lighter.
 * Only the color changes, so the width never moves as you type.
 */
export function Highlight({ text, marks, searching }: { text: string; marks: number[]; searching: boolean }) {
  if (!searching) return <>{text}</>;
  const marked = new Set(marks);
  const parts: { text: string; on: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const on = marked.has(i);
    const last = parts[parts.length - 1];
    if (last && last.on === on) last.text += text[i];
    else parts.push({ text: text[i], on });
  }
  return (
    <>
      {parts.map((part, i) => (
        <span key={i} className={part.on ? "text-foreground" : "text-foreground/55"}>
          {part.text}
        </span>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Visibility                                                         */
/* ------------------------------------------------------------------ */

/** True when the element is on screen and not covered by something else. */
export function isShowing(element: Element | null) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const left = Math.max(rect.left, 0);
  const right = Math.min(rect.right, window.innerWidth);
  const top = Math.max(rect.top, 0);
  const bottom = Math.min(rect.bottom, window.innerHeight);
  if (right - left < 2 || bottom - top < 2) return false;
  return element.contains(document.elementFromPoint((left + right) / 2, (top + bottom) / 2));
}

/**
 * ⌘K / Ctrl+K toggles the palette. It listens first (capture) and stops the
 * key, so a second ⌘K menu on the page does not open underneath. With a
 * container, only a container that is on screen answers.
 */
export function useCommandShortcut(
  enabled: boolean,
  onToggle: () => void,
  container?: HTMLElement | null,
) {
  React.useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return;
      if (event.key.toLowerCase() !== "k") return;
      if (container !== undefined && !isShowing(container)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onToggle();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled, onToggle, container]);
}

/**
 * Focuses the search field when the palette opens. A palette inside a
 * container only takes focus while that container is on screen, so a copy
 * further down the page never pulls typing away from the one in view.
 */
export function useFocusOnOpen(
  open: boolean,
  input: React.RefObject<HTMLInputElement | null>,
  container?: HTMLElement | null,
) {
  React.useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      if (container !== undefined && !isShowing(container)) return;
      input.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, input, container]);
}

/* ------------------------------------------------------------------ */
/*  Dialog                                                             */
/* ------------------------------------------------------------------ */

/**
 * The layer a palette sits in: a dimmed backdrop and a panel near the top,
 * over the whole window, or over `container` when one is given (a preview,
 * a split view). Clicking the backdrop closes it, and Tab stays inside.
 */
export function CommandDialog({
  open,
  onClose,
  container,
  label,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  /** Open over this element instead of the window. Null while it mounts. */
  container?: HTMLElement | null;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const isClient = useIsClient();
  const scoped = container !== undefined;

  // A palette over the whole window stops the page behind it from scrolling.
  React.useEffect(() => {
    if (!open || scoped) return;
    const root = document.documentElement;
    const gap = window.innerWidth - root.clientWidth;
    const previous = { overflow: root.style.overflow, paddingRight: root.style.paddingRight };
    root.style.overflow = "hidden";
    if (gap > 0) root.style.paddingRight = `${gap}px`;
    return () => {
      root.style.overflow = previous.overflow;
      root.style.paddingRight = previous.paddingRight;
    };
  }, [open, scoped]);

  if (!isClient) return null;
  const host = scoped ? container : document.body;
  if (!host) return null;

  return createPortal(
    // Reduced motion: the palette fades in place, with no scale or rise.
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open ? (
          <motion.div
            key="command-dialog"
            className={cn(
              "z-[1000] flex flex-col items-center px-4 pt-[clamp(16px,13vh,128px)] pb-4 font-sans",
              scoped ? "absolute inset-0" : "fixed inset-0",
              commandVars,
            )}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.18, ease: EASE } }}
            exit={{ opacity: 0, transition: { duration: 0.14, ease: EASE } }}
          >
            <div
              aria-hidden
              onPointerDown={onClose}
              className="absolute inset-0 bg-[rgba(12,12,14,0.16)] dark:bg-[rgba(0,0,0,0.5)]"
            />
            <motion.div
              role="dialog"
              aria-modal={scoped ? undefined : true}
              aria-label={label}
              onKeyDown={(event) => {
                // Focus stays on the search field; Tab has nowhere else to go.
                if (event.key === "Tab") event.preventDefault();
              }}
              initial={{ opacity: 0, scale: 0.98, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.22, ease: EASE } }}
              exit={{ opacity: 0, scale: 0.99, y: -2, transition: { duration: 0.13, ease: EASE } }}
              className={cn(
                "relative flex max-h-full min-h-0 w-full max-w-[600px] origin-top flex-col overflow-hidden rounded-2xl bg-(--cp-pop) text-foreground",
                popShadow,
                className,
              )}
            >
              {children}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </MotionConfig>,
    host,
  );
}

/** The strip at the foot of a palette: what the keys do. */
export function KeyHints({ hints, children }: { hints: { keys: string[]; label: string }[]; children?: React.ReactNode }) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-4 border-t border-foreground/[0.07] px-3.5 text-[12px] whitespace-nowrap text-foreground/50 [@media(hover:none)]:hidden">
      {hints.map((hint, i) => (
        // Narrow windows keep the first two hints on one line.
        <span key={hint.label} className={cn("flex items-center gap-1.5", i > 1 && "max-sm:hidden")}>
          <Keys keys={hint.keys} />
          {hint.label}
        </span>
      ))}
      {children ? <span className="ml-auto flex items-center gap-1.5">{children}</span> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Result list                                                        */
/* ------------------------------------------------------------------ */

export type ResultRow = {
  key: string;
  label: string;
  /** An icon, an avatar or a status mark, in a 16px box. */
  icon?: React.ReactNode;
  /** A muted note after the label. */
  hint?: string;
  /** Letters of the label to mark while searching. */
  marks: number[];
  shortcut?: string[];
  /** Something at the far right instead of the shortcut: a check, a chevron. */
  trailing?: React.ReactNode;
};

/** A group of rows. An empty label draws no heading (a page with one list). */
export type ResultSection = { id: string; label: string; rows: ResultRow[] };

/** The flat index of each section's first row. */
export function sectionStarts(sections: ResultSection[]) {
  const starts: number[] = [];
  let total = 0;
  for (const section of sections) {
    starts.push(total);
    total += section.rows.length;
  }
  return starts;
}

/**
 * Keeps the chosen row in view as the arrows move past the edge. Only the
 * list scrolls; the page around the palette stays where it is. `view` names
 * what the list shows (the query, the page), so a new list is checked too.
 */
export function useKeepInView(list: React.RefObject<HTMLElement | null>, chosen: number, view: string) {
  React.useEffect(() => {
    const box = list.current;
    const row = box?.querySelector<HTMLElement>("[data-active=true]");
    if (!box || !row) return;
    const top = row.offsetTop - 8;
    const bottom = row.offsetTop + row.offsetHeight + 8;
    if (top < box.scrollTop) box.scrollTo({ top: chosen === 0 ? 0 : top });
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTo({ top: bottom - box.clientHeight });
  }, [list, chosen, view]);
}

/** Grouped rows for a listbox driven by the search field (aria-activedescendant). */
export function ResultSections({
  sections,
  chosen,
  onChoose,
  onRun,
  searching,
  listId,
}: {
  sections: ResultSection[];
  chosen: number;
  onChoose: (index: number) => void;
  onRun: (index: number) => void;
  searching: boolean;
  listId: string;
}) {
  const starts = sectionStarts(sections);
  return (
    <>
      {sections.map((section, sectionIndex) => (
        <div
          key={section.id}
          role="group"
          aria-labelledby={section.label ? `${listId}-${section.id}` : undefined}
          className="not-first:mt-2"
        >
          {section.label ? (
            <div id={`${listId}-${section.id}`} className="px-2.5 pt-1.5 pb-1 text-[12px] font-medium text-foreground/45">
              {section.label}
            </div>
          ) : null}
          {section.rows.map((row, offset) => {
            const i = starts[sectionIndex] + offset;
            const active = i === chosen;
            return (
              <div
                key={row.key}
                id={`${listId}-${row.key}`}
                role="option"
                aria-selected={active}
                data-active={active}
                onPointerMove={() => {
                  if (!active) onChoose(i);
                }}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => onRun(i)}
                className={optionRow}
              >
                {row.icon ? (
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-4 shrink-0 place-items-center",
                      active ? "text-foreground/75" : "text-foreground/50",
                    )}
                  >
                    {row.icon}
                  </span>
                ) : null}
                <span className="min-w-0 truncate">
                  <Highlight text={row.label} marks={row.marks} searching={searching} />
                </span>
                {/* The hint gives way before the label does. */}
                {row.hint ? <span className="min-w-[3ch] shrink-[100] truncate text-[13px] text-foreground/45">{row.hint}</span> : null}
                <span className="ml-auto flex shrink-0 items-center pl-2">
                  {row.trailing ?? (row.shortcut ? <Keys keys={row.shortcut} /> : null)}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Trigger and header parts                                           */
/* ------------------------------------------------------------------ */

/** The search button that opens a palette, with its shortcut. */
export const CommandTrigger = React.forwardRef<
  HTMLButtonElement,
  { open: boolean; onOpen: () => void; shortcut: boolean; className?: string }
>(function CommandTrigger({ open, onOpen, shortcut, className }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onOpen}
      className={cn(
        "flex h-8 w-full max-w-[280px] cursor-pointer items-center gap-2 rounded-[10px] pr-1.5 pl-2.5 text-left text-[13.5px] text-foreground/50 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.09)] transition-[background-color,color] duration-150 hover:bg-foreground/[0.03] hover:text-foreground/70 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]",
        ring,
        className,
      )}
    >
      <Search className="size-4 shrink-0 text-foreground/45" strokeWidth={1.8} />
      <span className="min-w-0 flex-1 truncate">
        Search<span className="max-sm:hidden"> or jump to</span>
      </span>
      {shortcut ? <Keys keys={["mod", "K"]} /> : null}
    </button>
  );
});

/** The row that holds the search field. */
export const searchBar = "flex h-[52px] shrink-0 items-center gap-2.5 border-b border-foreground/[0.07] px-4";

export const searchInput =
  "h-full min-w-0 flex-1 bg-transparent text-[15px] text-ellipsis outline-none placeholder:text-foreground/40";

/** The scrolling list under the search field. */
export const resultList = cn(
  "relative max-h-[min(380px,calc(100dvh-220px))] min-h-0 overflow-y-auto p-2",
  thinScroll,
);

/** Closes the palette: a key chip people can also click or tap. */
export function EscButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close"
      onClick={onClick}
      className={cn(
        "grid h-6 shrink-0 cursor-pointer place-items-center rounded-[6px] px-1.5 text-[11px] text-foreground/50 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] transition-colors duration-150 hover:text-foreground dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]",
        ring,
      )}
    >
      Esc
    </button>
  );
}

/** What the list says when nothing matches. */
export function NoResults({ query, tip }: { query: string; tip: string }) {
  return (
    <div className="px-2.5 py-10 text-center">
      <p className="text-[13.5px] text-foreground">No results for &ldquo;{query.trim()}&rdquo;</p>
      <p className="mt-1 text-[13px] text-foreground/50">{tip}</p>
    </div>
  );
}

/** The count at the right of the key hints while searching. */
export function ResultCount({ count, searching }: { count: number; searching: boolean }) {
  return <span className="tabular-nums">{searching ? `${count} ${count === 1 ? "result" : "results"}` : null}</span>;
}
