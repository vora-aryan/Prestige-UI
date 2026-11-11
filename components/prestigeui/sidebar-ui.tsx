"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronsUpDown, CircleHelp, CreditCard, LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Shared kit for the Sidebar family: tokens, the account menu, a floating
 * popover, rail tooltips, and the small hooks every sidebar needs (screen
 * width, platform shortcut labels, the sidebar shortcut).
 */

/** Strong ease-out: responds at once, lands softly. */
export const EASE = [0.16, 1, 0.3, 1] as const;
/** Travel (a column opening or closing): even start, soft landing. */
export const TRAVEL = "cubic-bezier(.65,0,.35,1)";

/**
 * Monochrome: value (grey to ink) carries state. The panel is the page
 * color with a trace of ink, so it reads as part of the app, not a card.
 */
export const sidebarVars =
  "[--sb-panel:color-mix(in_oklab,var(--foreground)_2.5%,var(--background))] [--sb-pop:#ffffff] dark:[--sb-pop:#1f1f23]";

export const ring =
  "outline-none focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_oklab,var(--foreground)_14%,transparent)]";

/** A raised layer: hairline, a contact shadow and a soft drop. */
export const popShadow =
  "shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.04),0_18px_40px_-14px_rgba(0,0,0,0.22)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_2px_4px_rgba(0,0,0,0.3),0_18px_40px_-14px_rgba(0,0,0,0.7)]";

/** A scrollbar that is only a thumb. */
export const thinScroll =
  "[@supports(-moz-appearance:none)]:[scrollbar-width:thin] [@supports(-moz-appearance:none)]:[scrollbar-color:color-mix(in_oklab,var(--foreground)_20%,transparent)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-track]:my-3 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-foreground/20";

export const iconButton = cn(
  "grid size-8 shrink-0 cursor-pointer place-items-center rounded-[var(--r-control,10px)] text-foreground/55 transition-[background-color,color,scale] duration-150 hover:bg-foreground/[0.06] hover:text-foreground active:scale-[0.94] aria-expanded:bg-foreground/[0.06] aria-expanded:text-foreground",
  ring,
);

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Any icon component: a lucide icon, or your own mark. */
export type SidebarIcon = React.ComponentType<{ className?: string; strokeWidth?: number }>;

export type SidebarItem = {
  id: string;
  label: string;
  icon?: SidebarIcon;
  /** A count or short tag at the right, e.g. unread items. */
  badge?: number | string;
  /** Something new waits here: a dot marks the icon when the sidebar is a rail. */
  unread?: boolean;
  href?: string;
};

export type SidebarGroup = {
  id: string;
  /** Shown above the group. Leave out for the top group. */
  label?: string;
  items: SidebarItem[];
  /** The label folds the group open and closed. */
  collapsible?: boolean;
};

export type SidebarUser = {
  name: string;
  email?: string;
  avatar?: string;
};

export type SidebarMenuItem = {
  id: string;
  label: string;
  icon?: SidebarIcon;
  href?: string;
  onSelect?: () => void;
};

export const defaultAccountMenu: SidebarMenuItem[] = [
  { id: "settings", label: "Settings", icon: Settings },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "help", label: "Help and docs", icon: CircleHelp },
  { id: "sign-out", label: "Sign out", icon: LogOut },
];

/* ------------------------------------------------------------------ */
/*  Hooks                                                              */
/* ------------------------------------------------------------------ */

const noopSubscribe = () => () => {};

/** True once on the client. */
export function useIsClient() {
  return React.useSyncExternalStore(noopSubscribe, () => true, () => false);
}

function subscribeWide(callback: () => void) {
  const query = window.matchMedia("(min-width: 768px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/** True at tablet width and up. The server renders the desktop layout. */
export function useWide() {
  return React.useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia("(min-width: 768px)").matches,
    () => true,
  );
}

/** "⌘B" on Apple devices, "Ctrl+B" elsewhere. */
export function useShortcutLabel(key: string) {
  const mac = React.useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => false,
  );
  return mac ? `⌘${key}` : `Ctrl+${key}`;
}

/** ⌘B / Ctrl+B, the shortcut every app uses for its sidebar. */
export function useSidebarShortcut(onToggle: () => void) {
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return;
      if (event.key.toLowerCase() !== "b") return;
      // Rich-text editors use ⌘B for bold.
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      event.preventDefault();
      onToggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onToggle]);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Placeholder links ("#") stay put; real hrefs navigate as usual. */
export const preventPlaceholder = (event: React.MouseEvent<HTMLAnchorElement>) => {
  if (event.currentTarget.getAttribute("href") === "#") event.preventDefault();
};

/* ------------------------------------------------------------------ */
/*  Popover                                                            */
/* ------------------------------------------------------------------ */

const GAP = 8;
const EDGE = 8;

/** "center" opens over the middle of the anchor, near its top: a menu over a whole app. */
export type PopoverSide = "top" | "right" | "bottom" | "center";

function place(panel: HTMLElement, anchor: HTMLElement, side: PopoverSide) {
  const rect = anchor.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const width = panel.offsetWidth;
  const height = panel.offsetHeight;
  if (side === "center") {
    const left = rect.left + (rect.width - width) / 2;
    const top = rect.top + Math.max(56, Math.min(rect.height * 0.16, 140));
    panel.style.left = `${Math.round(Math.min(Math.max(EDGE, left), vw - width - EDGE))}px`;
    panel.style.top = `${Math.round(Math.min(Math.max(EDGE, top), vh - height - EDGE))}px`;
    panel.style.transformOrigin = "center top";
  } else if (side === "bottom") {
    panel.style.left = `${Math.round(Math.min(Math.max(EDGE, rect.left), vw - width - EDGE))}px`;
    panel.style.top = `${Math.round(Math.min(rect.bottom + GAP, vh - height - EDGE))}px`;
    panel.style.transformOrigin = "left top";
  } else if (side === "right") {
    panel.style.left = `${Math.round(Math.min(rect.right + GAP, vw - width - EDGE))}px`;
    panel.style.top = `${Math.round(Math.min(Math.max(EDGE, rect.bottom - height), vh - height - EDGE))}px`;
    panel.style.transformOrigin = "left bottom";
  } else {
    panel.style.left = `${Math.round(Math.min(Math.max(EDGE, rect.left), vw - width - EDGE))}px`;
    panel.style.top = `${Math.round(Math.max(EDGE, rect.top - GAP - height))}px`;
    panel.style.transformOrigin = "left bottom";
  }
}

/**
 * A floating panel rendered into the page body, so no clipping box (a
 * preview frame, a collapsed sidebar) can cut it off. It opens above its
 * anchor, below it (a menu under a header), or to its right when the
 * sidebar is a narrow rail.
 */
export function Popover({
  open,
  onClose,
  anchor,
  side = "top",
  children,
  className,
  label,
}: {
  open: boolean;
  onClose: () => void;
  anchor: React.RefObject<HTMLElement | null>;
  side?: PopoverSide;
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  const panel = React.useRef<HTMLDivElement>(null);
  const isClient = useIsClient();

  React.useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panel.current?.contains(target) || anchor.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, onClose, anchor]);

  React.useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      if (panel.current && anchor.current) place(panel.current, anchor.current, side);
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchor, side]);

  if (!isClient) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={panel}
          role="presentation"
          aria-label={label}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1, transition: { duration: 0.2, ease: EASE } }}
          exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12, ease: EASE } }}
          className={cn(
            "fixed z-[1000] w-[240px] overflow-hidden rounded-[var(--r-control,var(--radius-2xl))] bg-(--sb-pop) p-1.5 font-sans text-foreground",
            sidebarVars,
            popShadow,
            className,
          )}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

/** Arrow keys, Home and End move between a menu's items. */
export function onMenuKeyDown(event: React.KeyboardEvent<HTMLElement>) {
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-menu-item]:not([disabled])"));
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

const menuItem =
  "flex w-full cursor-pointer items-center gap-3 rounded-[var(--r-control,10px)] px-2.5 py-2 text-left text-[13.5px] font-medium text-foreground outline-none transition-colors duration-150 hover:bg-foreground/[0.05] focus-visible:bg-foreground/[0.05]";

/* ------------------------------------------------------------------ */
/*  Rail tooltip                                                       */
/* ------------------------------------------------------------------ */

export type RailTipState = { label: string; detail?: string; top: number } | null;

/**
 * One tooltip for the whole rail, placed beside the row under the pointer.
 * The first one waits a moment so it never flickers while the pointer
 * passes; moving between rows then shows the next one at once.
 */
export function useRailTip(enabled: boolean) {
  const [tip, setTip] = React.useState<RailTipState>(null);
  const timer = React.useRef(0);
  const warm = React.useRef(false);
  const cool = React.useRef(0);

  const show = React.useCallback(
    (row: HTMLElement, label: string, detail?: string, immediate = false) => {
      if (!enabled) return;
      const frame = row.closest("[data-sidebar-frame]");
      if (!frame) return;
      const top = row.getBoundingClientRect().top - frame.getBoundingClientRect().top + row.offsetHeight / 2;
      window.clearTimeout(timer.current);
      window.clearTimeout(cool.current);
      if (warm.current || immediate) {
        warm.current = true;
        setTip({ label, detail, top });
      } else {
        timer.current = window.setTimeout(() => {
          warm.current = true;
          setTip({ label, detail, top });
        }, 350);
      }
    },
    [enabled],
  );

  const hide = React.useCallback(() => {
    window.clearTimeout(timer.current);
    setTip(null);
    cool.current = window.setTimeout(() => {
      warm.current = false;
    }, 300);
  }, []);

  React.useEffect(() => () => {
    window.clearTimeout(timer.current);
    window.clearTimeout(cool.current);
  }, []);

  return { tip: enabled ? tip : null, show, hide };
}

export function RailTip({ tip, left }: { tip: RailTipState; left: number }) {
  return (
    <AnimatePresence>
      {tip ? (
        <motion.div
          key="tip"
          role="presentation"
          initial={{ opacity: 0, x: -3 }}
          animate={{ opacity: 1, x: 0, transition: { duration: 0.16, ease: EASE } }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          className="pointer-events-none absolute z-50 flex -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-lg bg-foreground px-2 py-1 text-[12px] font-medium text-background transition-[top] duration-150 ease-out"
          style={{ top: tip.top, left }}
        >
          {tip.label}
          {tip.detail ? <span className="text-background/55 tabular-nums">{tip.detail}</span> : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  Account                                                            */
/* ------------------------------------------------------------------ */

export function Avatar({ user, size = 28 }: { user: SidebarUser; size?: number }) {
  return user.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={user.avatar}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full bg-foreground/10 object-cover"
      draggable={false}
    />
  ) : (
    <span
      style={{ width: size, height: size }}
      className="grid shrink-0 place-items-center rounded-full bg-foreground/[0.08] text-[11px] font-semibold text-foreground/75"
    >
      {initials(user.name)}
    </span>
  );
}

/**
 * The person at the foot of the sidebar and their menu. In a narrow rail
 * only the avatar shows, and the menu opens to its right.
 */
export function AccountMenu({
  user,
  items = defaultAccountMenu,
  compact = false,
  onHover,
  onLeave,
}: {
  user: SidebarUser;
  items?: SidebarMenuItem[];
  /** The sidebar is a narrow rail. */
  compact?: boolean;
  onHover?: (row: HTMLElement) => void;
  onLeave?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const button = React.useRef<HTMLButtonElement>(null);
  const list = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => setOpen(false), []);

  React.useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>("[data-menu-item]")?.focus({ preventScroll: true });
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={compact ? `${user.name}, account` : undefined}
        onClick={() => setOpen((value) => !value)}
        onPointerEnter={(event) => onHover?.(event.currentTarget)}
        onPointerLeave={onLeave}
        onFocus={(event) => onHover?.(event.currentTarget)}
        onBlur={onLeave}
        className={cn(
          "flex h-11 w-full cursor-pointer items-center gap-2.5 overflow-hidden rounded-[var(--r-control,10px)] pr-2 pl-1.5 text-left transition-colors duration-150 hover:bg-foreground/[0.045] aria-expanded:bg-foreground/[0.06]",
          ring,
        )}
      >
        <Avatar user={user} />
        <span
          className={cn(
            "min-w-0 flex-1 transition-opacity",
            compact ? "opacity-0 duration-100" : "opacity-100 delay-150 duration-200",
          )}
        >
          <span className="block truncate text-[13px] leading-[18px] font-medium whitespace-nowrap text-foreground">
            {user.name}
          </span>
          {user.email ? (
            <span className="block truncate text-[12px] leading-4 whitespace-nowrap text-foreground/50">{user.email}</span>
          ) : null}
        </span>
        <ChevronsUpDown
          className={cn("size-4 shrink-0 text-foreground/40 transition-opacity", compact ? "opacity-0" : "opacity-100 delay-150")}
          strokeWidth={1.9}
        />
      </button>
      <Popover open={open} onClose={close} anchor={button} side={compact ? "right" : "top"} label="Account">
        <div
          ref={list}
          role="menu"
          aria-label="Account"
          onKeyDown={(event) => {
            if (event.key === "Escape" || event.key === "Tab") {
              if (event.key === "Escape") event.preventDefault();
              setOpen(false);
              button.current?.focus();
              return;
            }
            onMenuKeyDown(event);
          }}
        >
          <div className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-2">
            <Avatar user={user} size={32} />
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-medium">{user.name}</span>
              {user.email ? <span className="block truncate text-[12.5px] text-foreground/50">{user.email}</span> : null}
            </span>
          </div>
          <div role="separator" className="mx-2.5 my-1 h-px bg-foreground/[0.07]" />
          {items.map((item) =>
            item.href ? (
              <a
                key={item.id}
                href={item.href}
                role="menuitem"
                data-menu-item=""
                onClick={(event) => {
                  preventPlaceholder(event);
                  setOpen(false);
                }}
                className={menuItem}
              >
                {item.icon ? <item.icon className="size-4 shrink-0 text-foreground/60" strokeWidth={1.75} /> : null}
                {item.label}
              </a>
            ) : (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                data-menu-item=""
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
                className={menuItem}
              >
                {item.icon ? <item.icon className="size-4 shrink-0 text-foreground/60" strokeWidth={1.75} /> : null}
                {item.label}
              </button>
            ),
          )}
        </div>
      </Popover>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Page placeholder                                                   */
/* ------------------------------------------------------------------ */

/**
 * The page beside a sidebar, left as an empty state on purpose: the
 * sidebar is the piece you install, and your own page goes here.
 */
export function PagePlaceholder() {
  return (
    <div aria-hidden className="flex h-full min-h-0 flex-col gap-4 p-4 sm:p-6">
      <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn("h-28 rounded-xl bg-foreground/[0.035]", i > 0 && "hidden sm:block")} />
        ))}
      </div>
      <div className="min-h-[160px] flex-1 rounded-xl bg-foreground/[0.035]" />
    </div>
  );
}
