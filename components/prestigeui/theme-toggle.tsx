"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

type ThemeToggleProps = {
  /** Control the theme yourself (for example from next-themes). Leave unset to let the toggle manage the `dark` class on <html>. */
  theme?: Theme;
  onThemeChange?: (theme: Theme) => void;
  /** Where the choice is saved. Pass null to not save it. */
  storageKey?: string | null;
  /** "sky" sweeps the new theme down like dusk, or up like dawn. */
  transition?: "sky" | "none";
  className?: string;
};

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const RAYS = Array.from({ length: 8 }, (_, i) => i * 45);

// The page sweep, written once into the document while a toggle is mounted.
// The mask is sized so the soft edge enters at the top edge on the first frame
// and leaves at the bottom on the last: with stops at 46% / 54% the mask must
// be 1 / 0.46 = 217.4% tall, so no part of the travel happens off screen.
const SKY_CSS = `
::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}
html[data-sky="dusk"]::view-transition-new(root),html[data-sky="dawn"]::view-transition-new(root){
  -webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:100% 217.4%;mask-size:100% 217.4%;
  animation:prestige-sky .72s cubic-bezier(.65,0,.35,1) both}
html[data-sky="dusk"]::view-transition-new(root){
  -webkit-mask-image:linear-gradient(to bottom,#000 46%,transparent 54%);mask-image:linear-gradient(to bottom,#000 46%,transparent 54%)}
html[data-sky="dawn"]::view-transition-new(root){
  -webkit-mask-image:linear-gradient(to top,#000 46%,transparent 54%);mask-image:linear-gradient(to top,#000 46%,transparent 54%)}
@keyframes prestige-sky{from{-webkit-mask-position:0 100%;mask-position:0 100%}to{-webkit-mask-position:0 0;mask-position:0 0}}
html[data-sky="dawn"]::view-transition-new(root){animation-name:prestige-sky-up}
@keyframes prestige-sky-up{from{-webkit-mask-position:0 0;mask-position:0 0}to{-webkit-mask-position:0 100%;mask-position:0 100%}}
`;

const subscribe = (notify: () => void) => {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
};
const readTheme = (): Theme => (document.documentElement.classList.contains("dark") ? "dark" : "light");

/** A sun whose rays draw in while the moon's shadow slides across it. */
function EclipseIcon({ dark, reduce }: { dark: boolean; reduce: boolean }) {
  const id = React.useId();
  const t = (delay = 0) => ({ duration: reduce ? 0 : 0.5, delay: reduce ? 0 : delay, ease: EASE_OUT });
  return (
    <motion.svg
      viewBox="0 0 24 24"
      className="size-[18px]"
      fill="none"
      aria-hidden
      initial={false}
      animate={{ rotate: dark ? 0 : 90 }}
      transition={t()}
    >
      <mask id={id}>
        <rect width="24" height="24" fill="#fff" />
        {/* The moon's shadow: off to the corner by day, over the disc at night. */}
        <motion.circle
          initial={false}
          animate={{ cx: dark ? 16.5 : 30, cy: dark ? 7.5 : -6 }}
          r={7.5}
          transition={t(dark ? 0.05 : 0)}
          fill="#000"
        />
      </mask>
      <motion.circle
        cx={12}
        cy={12}
        initial={false}
        animate={{ r: dark ? 8.5 : 4.75 }}
        transition={t(dark ? 0 : 0.06)}
        fill="currentColor"
        mask={`url(#${id})`}
      />
      {RAYS.map((angle, index) => (
        <g key={angle} transform={`rotate(${angle} 12 12)`}>
          <motion.line
          x1={12}
          y1={2.25}
          x2={12}
          y2={4.25}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          // Each ray shrinks toward the sun's centre.
          style={{ originX: 0.5, originY: 1 }}
          initial={false}
          animate={dark ? { opacity: 0, scale: 0.4 } : { opacity: 1, scale: 1 }}
          // Rays draw in one after another, and come back out the same way.
          transition={{
            duration: reduce ? 0 : 0.3,
            delay: reduce ? 0 : (dark ? index : RAYS.length - index) * 0.025,
            ease: EASE_OUT,
          }}
          />
        </g>
      ))}
    </motion.svg>
  );
}

function ThemeToggle({
  theme: controlled,
  onThemeChange,
  storageKey = "theme",
  transition = "sky",
  className,
}: ThemeToggleProps) {
  const reduce = Boolean(useReducedMotion());
  // Follows the class on <html>, so another toggle on the page keeps it in step.
  const fromDocument = React.useSyncExternalStore(subscribe, readTheme, () => "light" as Theme);
  const theme = controlled ?? fromDocument;
  const dark = theme === "dark";

  React.useEffect(() => {
    if (document.getElementById("prestige-sky")) return;
    const style = document.createElement("style");
    style.id = "prestige-sky";
    style.textContent = SKY_CSS;
    document.head.appendChild(style);
  }, []);

  const apply = (next: Theme) => {
    // CSS colour transitions would fade every element through grey as the
    // theme flips, so they are switched off for the one frame of the change.
    const freeze = document.createElement("style");
    freeze.textContent = "*,*::before,*::after{transition:none!important}";
    document.head.appendChild(freeze);
    if (controlled === undefined) {
      document.documentElement.classList.toggle("dark", next === "dark");
      document.documentElement.style.colorScheme = next;
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, next);
        } catch {
          // Storage can be blocked; the theme still changes for this visit.
        }
      }
    }
    onThemeChange?.(next);
    // Force the new styles to apply before transitions come back.
    void window.getComputedStyle(document.body).opacity;
    requestAnimationFrame(() => requestAnimationFrame(() => freeze.remove()));
  };

  const toggle = () => {
    const next: Theme = dark ? "light" : "dark";
    const root = document.documentElement;
    const canSweep =
      transition === "sky" &&
      !reduce &&
      typeof document !== "undefined" &&
      "startViewTransition" in document;
    if (!canSweep) {
      apply(next);
      return;
    }
    // Dusk sweeps the dark theme down from the top; dawn brings light up from below.
    root.dataset.sky = next === "dark" ? "dusk" : "dawn";
    const run = (document as Document & { startViewTransition: (cb: () => void) => { finished: Promise<void> } })
      .startViewTransition(() => apply(next));
    run.finished.finally(() => {
      delete root.dataset.sky;
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "group inline-grid size-9 cursor-pointer place-items-center rounded-md border border-black/[0.09] bg-background text-foreground",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.06)] dark:border-white/[0.1] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.4)]",
        "transition-[background-color,border-color,transform,scale] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-black/[0.03] active:scale-[0.96] dark:hover:bg-white/[0.05]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <EclipseIcon dark={dark} reduce={reduce} />
    </button>
  );
}

export { ThemeToggle, type ThemeToggleProps, type Theme };
