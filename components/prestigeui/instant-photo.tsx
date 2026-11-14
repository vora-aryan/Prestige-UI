"use client";

import * as React from "react";
import { motion, useInView } from "motion/react";
import { cn } from "@/lib/utils";

export interface InstantPhotoProps {
  src: string;
  alt: string;
  /** Short line written on the print's wide bottom edge. */
  caption?: string;
  /** Shown beside the caption, e.g. "Jun 2026". */
  date?: string;
  /** Resting angle in degrees. A few prints at -3, 2 and -1.5 look scattered. */
  tilt?: number;
  /** Slide out of a slot before developing. */
  eject?: boolean;
  /** How long the photo takes to develop, in ms. */
  developMs?: number;
  /** Wait before starting, in ms, to stagger several prints. */
  delay?: number;
  className?: string;
}

type Phase = "waiting" | "ejecting" | "developing" | "done";

const EJECT = { duration: 1.25, ease: [0.45, 0, 0.2, 1] as const };
const SETTLE = { type: "spring" as const, stiffness: 140, damping: 18 };

// Reduced motion is read on the client only; the server always renders the
// print waiting, so hydration never shows a finished photo that then vanishes.
function subscribe(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const useReducedMotion = () =>
  React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

// Fine paper grain for the print's border.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.5 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function InstantPhoto({
  src,
  alt,
  caption,
  date,
  tilt = 0,
  eject = true,
  developMs = 4000,
  delay = 0,
  className,
}: InstantPhotoProps) {
  const ref = React.useRef<HTMLElement>(null);
  const img = React.useRef<HTMLImageElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const [loaded, setLoaded] = React.useState(false);
  const [started, setStarted] = React.useState<Phase>("waiting");
  const phase: Phase = reduce ? "done" : started;

  // A cached photo can finish loading before React attaches onLoad.
  React.useEffect(() => {
    if (img.current?.complete) {
      const id = requestAnimationFrame(() => setLoaded(true));
      return () => cancelAnimationFrame(id);
    }
  }, []);

  // Start once the print is in view and its photo has arrived.
  React.useEffect(() => {
    if (reduce || !inView || !loaded || started !== "waiting") return;
    const id = setTimeout(() => setStarted(eject ? "ejecting" : "developing"), delay);
    return () => clearTimeout(id);
  }, [reduce, inView, loaded, started, eject, delay]);

  React.useEffect(() => {
    if (started !== "developing") return;
    const id = setTimeout(() => setStarted("done"), developMs);
    return () => clearTimeout(id);
  }, [started, developMs]);

  const out = !eject || phase !== "waiting";
  const developed = phase === "developing" || phase === "done";
  // The print only takes its angle once it is out of the slot.
  const free = !eject || developed;
  const settled = phase === "done";

  // Each layer of the "film" fades on its own part of the develop time.
  const layer = (from: number, to: number): React.CSSProperties => ({
    transitionProperty: "opacity",
    transitionDuration: developed && !reduce ? `${(to - from) * developMs}ms` : "0ms",
    transitionDelay: developed && !reduce ? `${from * developMs}ms` : "0ms",
    transitionTimingFunction: "cubic-bezier(0.4, 0, 0.3, 1)",
  });

  return (
    <figure ref={ref} className={cn("relative w-full min-w-0", className)}>
      {/* The slot the print comes out of; it steps away once the print is out. */}
      {eject && !reduce && (
        <motion.div
          aria-hidden
          initial={false}
          animate={phase === "waiting" || phase === "ejecting" ? { opacity: 1, y: "-50%" } : { opacity: 0, y: "-90%" }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="absolute -inset-x-[5%] top-0 z-10 h-3.5 rounded-[5px] bg-[linear-gradient(#3a3a3e,#232326)] shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_6px_14px_-8px_rgba(0,0,0,0.5)] dark:bg-[linear-gradient(#2c2c30,#18181b)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_6px_14px_-8px_rgba(0,0,0,0.8)]"
        >
          <span className="absolute inset-x-[4%] top-1/2 h-[3px] -translate-y-1/2 rounded-[2px] bg-black" />
        </motion.div>
      )}

      <motion.div
        initial={false}
        animate={{ rotate: free ? tilt : 0, y: 0 }}
        whileHover={settled ? { rotate: 0, y: -4 } : undefined}
        transition={SETTLE}
        className="group/print"
      >
        <motion.div
          initial={false}
          // The clip keeps the print hidden above the slot line while it
          // travels; once it is out, the clip opens so the shadow shows all round.
          animate={
            out
              ? phase === "ejecting"
                ? { y: "0%", clipPath: "inset(0% -30% -30% -30%)" }
                : { y: "0%", clipPath: "inset(-30% -30% -30% -30%)", transition: { duration: 0 } }
              : { y: "-100%", clipPath: "inset(100% -30% -30% -30%)" }
          }
          transition={EJECT}
          onAnimationComplete={() => {
            if (phase === "ejecting") setStarted("developing");
          }}
        >
          <div
            className="relative rounded-md bg-[#fdfcfa] px-[6%] pt-[6%] pb-[24%] shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.08),0_14px_30px_-14px_rgba(0,0,0,0.35)] transition-shadow duration-300 group-hover/print:shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.08),0_24px_40px_-18px_rgba(0,0,0,0.4)] dark:bg-[#e9e7e1] dark:shadow-[0_1px_2px_rgba(0,0,0,0.5),0_16px_34px_-14px_rgba(0,0,0,0.9)]"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.14] mix-blend-multiply"
              style={{ backgroundImage: GRAIN }}
            />

            {/* The film: milky at first, the shadows come up, then the colour. */}
            <div className="relative isolate aspect-square overflow-clip bg-[#dcd8cf]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={img}
                src={src}
                alt={alt}
                draggable={false}
                onLoad={() => setLoaded(true)}
                className="absolute inset-0 size-full object-cover opacity-0"
                style={{ ...layer(0.55, 1), opacity: developed ? 1 : 0 }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                aria-hidden
                draggable={false}
                className="absolute inset-0 -z-10 size-full object-cover mix-blend-multiply grayscale contrast-125"
                style={{ ...layer(0, 0.45), opacity: developed ? 0.5 : 0 }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                aria-hidden
                draggable={false}
                className="absolute inset-0 -z-10 size-full object-cover brightness-110 contrast-[0.85] saturate-50 [mask-image:radial-gradient(circle_at_46%_42%,#000_35%,transparent_90%)]"
                style={{ ...layer(0.2, 0.75), opacity: developed ? 1 : 0 }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.07),inset_0_1px_3px_rgba(0,0,0,0.18)]"
              />
            </div>

            {(caption || date) && (
              <figcaption className="absolute inset-x-[6%] bottom-0 flex h-[20.3%] min-w-0 items-center justify-between gap-3">
                {caption && (
                  <span className="truncate text-[15px] leading-tight font-medium tracking-[-0.01em] text-[#1c1c1f]">
                    {caption}
                  </span>
                )}
                {date && (
                  <span className="shrink-0 text-[12px] text-[#1c1c1f]/50 tabular-nums">{date}</span>
                )}
              </figcaption>
            )}
          </div>
        </motion.div>
      </motion.div>
    </figure>
  );
}
