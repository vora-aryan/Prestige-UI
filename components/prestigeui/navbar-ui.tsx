"use client";

import * as React from "react";
import { AnimatePresence, motion, useMotionValue } from "motion/react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/prestigeui/prestige-brand";

export { BrandMark };

/** Strong ease-out: responds at once, lands softly. */
export const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * One accent for meaning only (unread dots, progress, selection). Retint by
 * overriding --nav-accent on the header.
 */
export const accentVars = "[--nav-accent:#2f6bff] dark:[--nav-accent:#5b8bff]";

/** The focus ring every control in the family shares. */
export const ring =
  "outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--nav-accent)_45%,transparent)] focus-visible:ring-offset-1 focus-visible:ring-offset-background";

/** Floating surfaces: hairline border plus a soft, layered shadow. */
export const surface =
  "border border-border bg-background shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(15,23,42,0.22)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_16px_40px_-12px_rgba(0,0,0,0.7)]";

// Placeholder links ("#") stay put instead of jumping or changing the URL.
// Real hrefs passed in by you navigate as usual.
export const preventPlaceholder = (event: React.MouseEvent<HTMLAnchorElement>) => {
  if (event.currentTarget.getAttribute("href") === "#") event.preventDefault();
};

/** The brand mark plus wordmark, shared by every navbar. */
export function Logo({
  name = "Prestige UI",
  href = "#",
  className,
  hideName = false,
}: {
  name?: string;
  href?: string;
  className?: string;
  hideName?: boolean;
}) {
  return (
    <a
      href={href}
      onClick={preventPlaceholder}
      aria-label={hideName ? name : undefined}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-md text-[15px] font-semibold tracking-[-0.02em]",
        ring,
        className,
      )}
    >
      <BrandMark className="size-7" />
      {hideName ? null : name}
    </a>
  );
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-grid h-5 min-w-5 place-items-center rounded-[5px] border border-border bg-muted/60 px-1 font-sans text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

const subscribeNothing = () => () => {};

/** True on Apple platforms, so shortcuts read ⌘ there and Ctrl elsewhere. */
export function useIsMac() {
  return React.useSyncExternalStore(
    subscribeNothing,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => true,
  );
}

function scrollParent(node: HTMLElement | null): HTMLElement | Window {
  let el = node?.parentElement ?? null;
  while (el && el !== document.body) {
    if (/(auto|scroll|overlay)/.test(getComputedStyle(el).overflowY)) return el;
    el = el.parentElement;
  }
  return window;
}

/**
 * Scroll position of whatever actually scrolls this header: the window, or
 * the nearest scrolling ancestor (a preview pane, an app shell). Returns
 * a motion value so reading it never re-renders the tree.
 */
export function useScrollY(ref: React.RefObject<HTMLElement | null>) {
  const y = useMotionValue(0);

  React.useEffect(() => {
    const source = scrollParent(ref.current);
    const read = () => {
      const top = source === window ? window.scrollY : (source as HTMLElement).scrollTop;
      y.set(Math.max(0, top));
    };
    read();
    source.addEventListener("scroll", read, { passive: true });
    return () => {
      source.removeEventListener("scroll", read);
    };
  }, [ref, y]);

  return { y };
}

/**
 * Closes a popover on Escape (returning focus to its trigger) or on a
 * pointer press outside every element in `refs`.
 */
export function useDismiss(
  open: boolean,
  close: () => void,
  refs: React.RefObject<HTMLElement | null>[],
  trigger?: React.RefObject<HTMLElement | null>,
) {
  const closeRef = React.useRef(close);
  React.useEffect(() => {
    closeRef.current = close;
  });

  React.useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (refs.some((ref) => ref.current?.contains(target))) return;
      closeRef.current();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeRef.current();
      trigger?.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
    // refs are stable ref objects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

/** Arrow keys, Home and End move focus between a menu's items. */
export function onMenuKeyDown(event: React.KeyboardEvent<HTMLElement>) {
  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"],[role="menuitemradio"]'),
  );
  if (!items.length) return;
  const index = items.indexOf(document.activeElement as HTMLElement);
  let next = -1;
  if (event.key === "ArrowDown") next = (index + 1) % items.length;
  else if (event.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = items.length - 1;
  if (next < 0) return;
  event.preventDefault();
  items[next].focus();
}

/** Focuses the first item of a menu once it has mounted. */
export function focusFirstItem(menu: React.RefObject<HTMLElement | null>) {
  requestAnimationFrame(() =>
    menu.current
      ?.querySelector<HTMLElement>('[role="menuitem"],[role="menuitemradio"],input')
      ?.focus(),
  );
}

/**
 * A floating panel anchored under its trigger. It grows from the trigger's
 * side, enters with ease-out and leaves faster than it came.
 */
export function Popover({
  open,
  align = "start",
  className,
  children,
  ...rest
}: {
  open: boolean;
  align?: "start" | "end" | "center";
  className?: string;
  children: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "onAnimationStart" | "onDrag" | "onDragStart" | "onDragEnd">) {
  const origin = align === "end" ? "top right" : align === "center" ? "top center" : "top left";
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          {...rest}
          initial={{ opacity: 0, y: -4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.22, ease: EASE } }}
          exit={{ opacity: 0, y: -2, scale: 0.98, transition: { duration: 0.12, ease: "easeOut" } }}
          style={{ transformOrigin: origin }}
          className={cn(
            "absolute top-full z-50 mt-2 rounded-xl p-1",
            surface,
            align === "end" ? "right-0" : align === "center" ? "left-1/2 -translate-x-1/2" : "left-0",
            className,
          )}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Two lines that fold into an X. Pure transform, no icon swap flicker. */
export function MenuGlyph({ open }: { open: boolean }) {
  return (
    <span aria-hidden className="relative block h-3 w-4">
      <span
        className={cn(
          "absolute top-[5px] left-0 h-[1.5px] w-4 rounded-full bg-current transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "rotate-45" : "-translate-y-[3px]",
        )}
      />
      <span
        className={cn(
          "absolute top-[5px] left-0 h-[1.5px] w-4 rounded-full bg-current transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open ? "-rotate-45" : "translate-y-[3px]",
        )}
      />
    </span>
  );
}
