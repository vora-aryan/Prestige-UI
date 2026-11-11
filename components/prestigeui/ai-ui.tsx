"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Strong ease-out: responds at once, lands softly. */
export const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The AI kit is monochrome: value (grey to ink) carries state. Red is the
 * only color, and it only ever means "this needs your attention".
 */
export const aiVars =
  "[--ai-surface:#ffffff] [--ai-pop:#ffffff] [--ai-danger:#d4463e] dark:[--ai-surface:#18181b] dark:[--ai-pop:#1f1f23] dark:[--ai-danger:#f0706a]";

export const ring =
  "outline-none focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_oklab,var(--foreground)_14%,transparent)]";

/** The round icon button under answers: copy, rate, try again. */
export const actionButton =
  "relative grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-foreground/50 transition-[background-color,color,scale] duration-150 hover:bg-foreground/[0.06] hover:text-foreground active:scale-[0.94] aria-expanded:bg-foreground/[0.06] aria-expanded:text-foreground disabled:pointer-events-none disabled:opacity-40 " +
  ring;

/** A raised layer: hairline, a contact shadow and a soft drop. */
export const popShadow =
  "shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.04),0_18px_40px_-14px_rgba(0,0,0,0.22)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_2px_4px_rgba(0,0,0,0.3),0_18px_40px_-14px_rgba(0,0,0,0.7)]";

/**
 * A scrollbar that is only a thumb: no track, no arrows. Chrome and Safari
 * get styled WebKit parts (the standard properties would bring Chrome's
 * arrow buttons back on Windows); Firefox gets the standard properties.
 */
export const thinScroll =
  "[@supports(-moz-appearance:none)]:[scrollbar-width:thin] [@supports(-moz-appearance:none)]:[scrollbar-color:color-mix(in_oklab,var(--foreground)_20%,transparent)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-button]:hidden [&::-webkit-scrollbar-track]:my-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-foreground/20 hover:[&::-webkit-scrollbar-thumb]:bg-foreground/30";

/* ------------------------------------------------------------------ */
/*  Model marks                                                        */
/* ------------------------------------------------------------------ */

type MarkProps = { className?: string; strokeWidth?: number };

function Mark({ className, d, label }: { className?: string; d: string; label: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <title>{label}</title>
      <path d={d} fillRule="evenodd" />
    </svg>
  );
}

/** The Anthropic Claude mark. */
export function ClaudeMark({ className }: MarkProps) {
  return (
    <Mark
      className={className}
      label="Claude"
      d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"
    />
  );
}

/** The OpenAI mark. */
export function OpenAIMark({ className }: MarkProps) {
  return (
    <Mark
      className={className}
      label="OpenAI"
      d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"
    />
  );
}

/** The Google Gemini mark. */
export function GeminiMark({ className }: MarkProps) {
  return (
    <Mark
      className={className}
      label="Gemini"
      d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"
    />
  );
}

/** The xAI Grok mark. */
export function GrokMark({ className }: MarkProps) {
  return (
    <Mark
      className={className}
      label="Grok"
      d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815"
    />
  );
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

export function extensionOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const noopSubscribe = () => () => {};

/** True once on the client. Safe to branch markup on after hydration. */
export function useIsClient() {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/* ------------------------------------------------------------------ */
/*  Tooltip                                                            */
/* ------------------------------------------------------------------ */

/**
 * A label for icon buttons. It waits half a second on hover so it never
 * flickers while the pointer passes, and shows at once on keyboard focus.
 */
export function Tip({
  label,
  shortcut,
  side = "top",
  children,
  className,
}: {
  label: string;
  shortcut?: string;
  side?: "top" | "bottom";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("group/tip relative inline-flex", className)}>
      {children}
      <span
        role="presentation"
        className={cn(
          "pointer-events-none absolute left-1/2 z-50 hidden -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-lg bg-foreground px-2 py-1 text-[12px] font-medium text-background opacity-0 transition-opacity duration-150 [@media(hover:hover)]:flex",
          "group-hover/tip:opacity-100 group-hover/tip:delay-500 group-has-[:focus-visible]/tip:opacity-100 group-has-[:focus-visible]/tip:delay-0 group-has-[[aria-expanded=true]]/tip:!opacity-0",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2",
        )}
      >
        {label}
        {shortcut ? (
          <span className="text-background/55">{shortcut}</span>
        ) : null}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Popover                                                            */
/* ------------------------------------------------------------------ */

const GAP = 8;
const EDGE = 8;

/**
 * Place a fixed panel against its anchor, in the window's coordinates:
 * below when it fits (or when there is more room below), otherwise above,
 * kept inside the window and never taller than the room it has. Inner
 * scroll areas read the room left as `--pop-max`.
 */
function place(
  panel: HTMLElement,
  anchor: HTMLElement,
  align: "start" | "center" | "end",
  maxWidth?: number,
  prefer: "top" | "bottom" = "bottom",
) {
  const rect = anchor.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;

  if (maxWidth) panel.style.width = `${Math.min(rect.width, maxWidth, vw - EDGE * 2)}px`;
  panel.style.maxHeight = "none";
  panel.style.setProperty("--pop-max", "9999px");
  const natural = panel.scrollHeight;
  const width = panel.offsetWidth;

  const below = vh - rect.bottom - GAP - EDGE;
  const above = rect.top - GAP - EDGE;
  const side =
    prefer === "top"
      ? natural <= above || above >= below
        ? "top"
        : "bottom"
      : natural <= below || below >= above
        ? "bottom"
        : "top";
  const room = Math.max(120, side === "bottom" ? below : above);

  const left = align === "start" ? rect.left : align === "end" ? rect.right - width : rect.left + (rect.width - width) / 2;
  panel.style.left = `${Math.round(Math.min(Math.max(EDGE, left), vw - width - EDGE))}px`;
  if (side === "bottom") {
    panel.style.top = `${Math.round(rect.bottom + GAP)}px`;
    panel.style.bottom = "auto";
  } else {
    panel.style.top = "auto";
    panel.style.bottom = `${Math.round(vh - rect.top + GAP)}px`;
  }
  panel.style.maxHeight = `${Math.round(room)}px`;
  // The panel's own padding (p-1.5 on both sides) comes off the room inside.
  panel.style.setProperty("--pop-max", `${Math.round(room - 12)}px`);
  panel.style.transformOrigin = `${side === "bottom" ? "top" : "bottom"} ${align === "start" ? "left" : align === "end" ? "right" : "center"}`;
  panel.dataset.side = side;
}

/**
 * A floating panel rendered into the page body, so no clipping box (a
 * preview frame, a scrolling sidebar, a dialog) can cut it off. Its z-index
 * clears full-screen overlays and modals, so it never opens behind them. It follows
 * its anchor through scrolls and resizes. Closes on an outside press;
 * `ignore` lists elements that count as inside (its trigger), so pressing
 * the trigger toggles instead of closing and reopening.
 */
export function Popover({
  open,
  onClose,
  anchor,
  align = "start",
  maxWidth,
  ignore,
  children,
  className,
  id,
  label,
  role = "dialog",
  side = "bottom",
  track,
}: {
  open: boolean;
  onClose: () => void;
  /** The element the panel sits against. */
  anchor: React.RefObject<HTMLElement | null>;
  align?: "start" | "center" | "end";
  /** Match the anchor's width, up to this many pixels. */
  maxWidth?: number;
  ignore?: React.RefObject<HTMLElement | null>[];
  children: React.ReactNode;
  className?: string;
  id?: string;
  label?: string;
  role?: string;
  /** Where to open when there is room on both sides. */
  side?: "top" | "bottom";
  /** Place the panel again whenever this changes: an anchor that moves without a scroll or resize. */
  track?: unknown;
}) {
  const panel = React.useRef<HTMLDivElement>(null);
  const isClient = useIsClient();

  React.useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panel.current?.contains(target)) return;
      if (anchor.current?.contains(target)) return;
      if (ignore?.some((ref) => ref.current?.contains(target))) return;
      onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, onClose, ignore, anchor]);

  React.useLayoutEffect(() => {
    if (!open) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (panel.current && anchor.current) place(panel.current, anchor.current, align, maxWidth, side);
      });
    };
    if (panel.current && anchor.current) place(panel.current, anchor.current, align, maxWidth, side);
    // Capture catches scrolling in any ancestor, not only the window.
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    if (panel.current) observer.observe(panel.current);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, [open, anchor, align, maxWidth, side, track]);

  if (!isClient) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={panel}
          id={id}
          role={role}
          aria-label={label}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1, transition: { duration: 0.2, ease: EASE } }}
          exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12, ease: EASE } }}
          className={cn(
            "fixed z-[1000] flex flex-col overflow-hidden rounded-2xl bg-[var(--ai-pop)] p-1.5 font-sans text-foreground",
            aiVars,
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

/* ------------------------------------------------------------------ */
/*  Menus                                                              */
/* ------------------------------------------------------------------ */

/**
 * Arrow keys, Home and End move between a menu's items; the browser's own
 * focus does the highlighting, so mouse and keyboard never disagree.
 */
export function onMenuKeyDown(event: React.KeyboardEvent<HTMLElement>) {
  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>("[data-menu-item]:not([disabled])"),
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

export function focusFirstItem(container: HTMLElement | null) {
  container
    ?.querySelector<HTMLElement>("[data-menu-item][aria-checked=true], [data-menu-item]")
    ?.focus({ preventScroll: true });
}

/** Icon, title and one muted line: the row every AI menu is made of. */
export function MenuRow({
  icon: Icon,
  title,
  description,
  trailing,
  active,
  className,
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "title"> & {
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: React.ReactNode;
  description?: React.ReactNode;
  trailing?: React.ReactNode;
  /** Highlighted by the keyboard while focus stays in the text field. */
  active?: boolean;
}) {
  return (
    <button
      type="button"
      data-menu-item=""
      {...props}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-[10px] px-2.5 py-2 text-left outline-none transition-colors duration-150 hover:bg-foreground/[0.05] focus-visible:bg-foreground/[0.05]",
        active && "bg-foreground/[0.05]",
        className,
      )}
    >
      {Icon ? (
        <Icon className="size-4 shrink-0 text-foreground/60" strokeWidth={1.75} />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium leading-5 text-foreground">
          {title}
        </span>
        {description ? (
          <span className="block truncate text-[12.5px] leading-[18px] text-foreground/50">
            {description}
          </span>
        ) : null}
      </span>
      {trailing}
    </button>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pt-2 pb-1 text-[12px] font-medium text-foreground/45">
      {children}
    </div>
  );
}

export function MenuDivider() {
  return <div role="separator" className="mx-2.5 my-1 h-px bg-foreground/[0.07]" />;
}

/* ------------------------------------------------------------------ */
/*  Progress ring                                                      */
/* ------------------------------------------------------------------ */

/** Determinate progress, 0 to 1. Only ever shows real progress. */
export function ProgressRing({
  value,
  size = 20,
  stroke = 2,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("-rotate-90", className)}
      aria-hidden
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c.toFixed(3)}
        strokeDashoffset={(c * (1 - Math.min(1, Math.max(0, value)))).toFixed(3)}
        className="transition-[stroke-dashoffset] duration-200 ease-linear"
      />
    </svg>
  );
}
