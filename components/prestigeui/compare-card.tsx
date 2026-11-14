"use client";

import * as React from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "motion/react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CompareCardProps {
  /** Shown left of the divider. */
  before: React.ReactNode;
  /** Shown right of the divider. It sets the card's size, so give both the same layout. */
  after: React.ReactNode;
  beforeLabel?: string;
  afterLabel?: string;
  /** Where the divider rests, 0 to 100 (% from the left). It returns here when the pointer leaves. */
  rest?: number;
  /** Accessible name for the slider. */
  label?: string;
  className?: string;
}

function subscribe(callback: () => void) {
  const queries = ["(prefers-reduced-motion: reduce)"].map((q) => window.matchMedia(q));
  queries.forEach((q) => q.addEventListener("change", callback));
  return () => queries.forEach((q) => q.removeEventListener("change", callback));
}
const useMedia = (query: string, server: boolean) =>
  React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => server,
  );

const clamp = (v: number) => Math.min(100, Math.max(0, v));

/**
 * Two versions of one card split by a divider. With a mouse the divider
 * follows the pointer across the card and glides back when it leaves; on
 * touch it is dragged; with the keyboard it is a slider.
 */
export function CompareCard({
  before,
  after,
  beforeLabel,
  afterLabel,
  rest = 50,
  label = "Comparison",
  className,
}: CompareCardProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduce = useMedia("(prefers-reduced-motion: reduce)", false);
  const home = clamp(rest);

  const target = useMotionValue(home);
  const smooth = useSpring(target, { stiffness: 260, damping: 32, mass: 0.7 });
  const pos = reduce ? target : smooth;
  const [value, setValue] = React.useState(home);
  const dragging = React.useRef(false);

  // Follow a changed resting point.
  React.useEffect(() => {
    target.set(home);
    smooth.jump(home);
  }, [home, target, smooth]);

  const moveTo = (v: number) => {
    target.set(clamp(v));
    setValue(Math.round(clamp(v)));
  };
  const fromPointer = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (box) moveTo(((clientX - box.left) / box.width) * 100);
  };

  const clip = useMotionTemplate`inset(0 calc(100% - ${pos}%) 0 0)`;
  const shift = useMotionTemplate`${pos}%`;
  // The divider fades out at the very edges, where there is nothing to compare.
  const show = useTransform(pos, [0, 2, 98, 100], [0, 1, 1, 0]);
  const beforeTag = useTransform(pos, [6, 18], [0, 1]);
  const afterTag = useTransform(pos, [82, 94], [1, 0]);

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-valuetext={`${value}% ${beforeLabel ?? "before"}`}
      onPointerMove={(e) => {
        if (e.pointerType === "mouse" || dragging.current) fromPointer(e.clientX);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") moveTo(home);
      }}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse") return;
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        fromPointer(e.clientX);
      }}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 20 : 5;
        const now = target.get();
        const keys: Record<string, number> = {
          ArrowLeft: now - step,
          ArrowDown: now - step,
          ArrowRight: now + step,
          ArrowUp: now + step,
          Home: 0,
          End: 100,
        };
        if (e.key in keys) {
          e.preventDefault();
          moveTo(keys[e.key]);
        }
      }}
      onBlur={() => moveTo(home)}
      className={cn(
        "group/compare relative isolate w-full min-w-0 cursor-ew-resize touch-pan-y overflow-clip rounded-lg outline-none select-none",
        "shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.05),0_18px_40px_-24px_rgba(0,0,0,0.35)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.14),0_18px_40px_-24px_rgba(0,0,0,0.8)]",
        "focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <div aria-hidden={value >= 100} className="relative">
        {after}
      </div>
      <motion.div aria-hidden={value <= 0} className="absolute inset-0" style={{ clipPath: clip }}>
        {before}
      </motion.div>

      {beforeLabel && (
        <motion.span
          aria-hidden
          style={{ opacity: beforeTag }}
          className="pointer-events-none absolute top-3 left-3 rounded-[5px] bg-white/[0.12] px-2 py-1 text-[12px] leading-none font-medium text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] backdrop-blur-md"
        >
          {beforeLabel}
        </motion.span>
      )}
      {afterLabel && (
        <motion.span
          aria-hidden
          style={{ opacity: afterTag }}
          className="pointer-events-none absolute top-3 right-3 rounded-[5px] bg-black/[0.05] px-2 py-1 text-[12px] leading-none font-medium text-neutral-700 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] backdrop-blur-md"
        >
          {afterLabel}
        </motion.span>
      )}

      {/* Divider: a full-width track moved by its own width, so the line sits at pos%. */}
      <motion.div aria-hidden className="pointer-events-none absolute inset-0" style={{ x: shift, opacity: show }}>
        <div className="absolute inset-y-0 left-0 w-[2px] -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.12),0_0_12px_rgba(0,0,0,0.18)]" />
        <div className="absolute top-1/2 left-0 grid h-9 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-md bg-white text-neutral-500 shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_2px_6px_rgba(0,0,0,0.18)] transition-transform duration-200 group-active/compare:scale-95">
          <GripVertical className="size-3.5" strokeWidth={2} />
        </div>
      </motion.div>
    </div>
  );
}
