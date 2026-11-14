"use client";

import * as React from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  company?: string;
  /** Square photo, shown round. */
  avatar?: string;
  /** 1 to 5. */
  rating?: number;
};

export interface TestimonialDeckProps {
  items: Testimonial[];
  /** Accessible name for the deck. */
  label?: string;
  className?: string;
}

const EASE = [0.16, 1, 0.3, 1] as const;
const SPRING = { type: "spring", stiffness: 380, damping: 32, mass: 0.9 } as const;
/** How many cards show in the stack. */
const DEPTH = 3;
/** Past this distance or speed, a drag throws the card. */
const THROW_DISTANCE = 110;
const THROW_SPEED = 600;

const subscribeReduce = (cb: () => void) => {
  const m = window.matchMedia("(prefers-reduced-motion: reduce)");
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/* ------------------------------------------------------------------ */
/*  One card's face                                                    */
/* ------------------------------------------------------------------ */

function Face({ item }: { item: Testimonial }) {
  const who = [item.role, item.company].filter(Boolean).join(", ");
  return (
    <div className="flex h-full flex-col p-6 sm:p-8">
      {item.rating ? (
        <div className="mb-4 flex items-center gap-0.5" aria-label={`Rated ${item.rating} out of 5`}>
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              aria-hidden
              className={cn("size-3.5", i < item.rating! ? "fill-foreground text-foreground" : "fill-foreground/15 text-transparent")}
            />
          ))}
        </div>
      ) : null}
      <blockquote className="text-[17px] leading-[1.55] tracking-[-0.005em] text-pretty text-foreground sm:text-[19px]">
        {item.quote}
      </blockquote>
      <figcaption className="mt-auto flex items-center gap-3 pt-7">
        {item.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.avatar}
            alt=""
            draggable={false}
            className="size-10 shrink-0 rounded-full object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.06)]"
          />
        ) : null}
        <span className="grid min-w-0">
          <span className="truncate text-[14px] font-medium text-foreground">{item.name}</span>
          {who && <span className="truncate text-[13px] text-muted-foreground">{who}</span>}
        </span>
      </figcaption>
    </div>
  );
}

const surface =
  "rounded-lg bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.05),0_16px_36px_-20px_rgba(0,0,0,0.22)] dark:bg-[#17171b] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.14),inset_0_1px_0_rgba(255,255,255,0.05),0_16px_36px_-20px_rgba(0,0,0,0.8)]";

/* ------------------------------------------------------------------ */
/*  Card in the stack                                                  */
/* ------------------------------------------------------------------ */

type Motion = { dir: 1 | -1; back: boolean };

function DeckCard({
  item,
  depth,
  tilt,
  reduce,
  move,
  onThrow,
}: {
  item: Testimonial;
  depth: number;
  /** Which way this card leans while it waits in the stack. */
  tilt: 1 | -1;
  reduce: boolean;
  /** The move that put this card here: thrown forward, or brought back. */
  move: Motion;
  onThrow: (dir: 1 | -1) => void;
}) {
  const top = depth === 0;
  const x = useMotionValue(0);
  // The card turns a little as it is dragged, like one held at the bottom.
  const rotate = useTransform(x, [-240, 0, 240], reduce ? [0, 0, 0] : [-9, 0, 9]);

  const rest = reduce
    ? { opacity: depth < DEPTH ? 1 : 0, scale: 1, y: 0, rotate: 0 }
    : { opacity: 1, scale: 1 - depth * 0.045, y: depth * 14, rotate: top ? 0 : tilt * (1.2 + depth * 0.6) };

  return (
    <motion.div
      aria-hidden={!top}
      inert={!top}
      custom={move}
      initial="enter"
      animate={rest}
      exit="exit"
      variants={{
        enter: (m: Motion) =>
          m.back && !reduce
            ? // Comes back from the side the button throws cards to.
              { opacity: 0, x: m.dir * 420, rotate: m.dir * 12, scale: 1, y: 0 }
            : { opacity: 0, scale: 1 - DEPTH * 0.045, y: DEPTH * 14, rotate: tilt * 2.4 },
        exit: (m: Motion) =>
          reduce
            ? { opacity: 0, transition: { duration: 0.2 } }
            : m.back
              ? { opacity: 0, scale: 1 - DEPTH * 0.045, y: DEPTH * 14, transition: { duration: 0.3, ease: EASE } }
              : { opacity: 0, x: m.dir * 480, rotate: m.dir * 14, transition: { duration: 0.45, ease: EASE } },
      }}
      transition={reduce ? { duration: 0.25 } : SPRING}
      style={{ zIndex: DEPTH - depth }}
      className="absolute inset-x-0 top-0 bottom-[28px] origin-bottom"
    >
      <motion.figure
        drag={top ? "x" : false}
        dragSnapToOrigin
        dragElastic={0.85}
        dragTransition={{ bounceStiffness: 420, bounceDamping: 30 }}
        onDragEnd={(_: unknown, info: PanInfo) => {
          const d = info.offset.x;
          const v = info.velocity.x;
          if (Math.abs(d) > THROW_DISTANCE || Math.abs(v) > THROW_SPEED) onThrow((Math.abs(v) > THROW_SPEED ? Math.sign(v) : Math.sign(d)) as 1 | -1);
        }}
        style={{ x, rotate }}
        className={cn(
          "relative h-full touch-pan-y select-none",
          surface,
          top ? "cursor-grab active:cursor-grabbing" : "pointer-events-none",
        )}
      >
        <Face item={item} />
      </motion.figure>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Deck                                                               */
/* ------------------------------------------------------------------ */

/**
 * A stack of quote cards. Drag or flick the top card away (or use the
 * buttons or arrow keys) and the next one lifts into place; it loops, so the
 * deck never runs out. The deck reserves the height of its longest quote,
 * so nothing below it moves.
 */
export function TestimonialDeck({ items, label = "Testimonials", className }: TestimonialDeckProps) {
  const n = items.length;
  // `pos` counts every move, so each card in the stack gets a fresh key.
  const [pos, setPos] = React.useState(0);
  const [motionState, setMotionState] = React.useState<Motion>({ dir: -1, back: false });
  const reduce = React.useSyncExternalStore(
    subscribeReduce,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  const at = (k: number) => ((k % n) + n) % n;
  const current = at(pos);
  const visible = Math.min(DEPTH, n);

  const next = (dir: 1 | -1 = -1) => {
    setMotionState({ dir, back: false });
    setPos((p) => p + 1);
  };
  const prev = () => {
    setMotionState({ dir: -1, back: true });
    setPos((p) => p - 1);
  };

  if (n === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className={cn("mx-auto w-full max-w-[520px] outline-none", className)}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          next(-1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          prev();
        }
      }}
    >
      <div className="relative grid">
        {/* Every quote, invisible, in one cell: the deck is always as tall as the longest. */}
        {items.map((item, i) => (
          <div key={i} aria-hidden className="invisible col-start-1 row-start-1 pb-[28px]">
            <div className={surface}>
              <Face item={item} />
            </div>
          </div>
        ))}

        <AnimatePresence initial={false} custom={motionState}>
          {Array.from({ length: visible }, (_, d) => {
            const k = pos + d;
            return (
              <DeckCard
                key={k}
                item={items[at(k)]}
                depth={d}
                tilt={k % 2 === 0 ? 1 : -1}
                reduce={reduce}
                move={motionState}
                onThrow={next}
              />
            );
          }).reverse()}
        </AnimatePresence>
      </div>

      <div className="mt-5 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={prev}
          aria-label="Previous testimonial"
          className="grid size-9 place-items-center rounded-[6px] text-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] transition-[background-color,scale] duration-150 outline-none hover:bg-foreground/[0.04] focus-visible:ring-2 focus-visible:ring-foreground/25 active:scale-[0.96] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] dark:hover:bg-white/[0.06]"
        >
          <ChevronLeft className="size-4" strokeWidth={2} />
        </button>
        <p className="min-w-[52px] text-center text-[13px] text-muted-foreground tabular-nums" aria-live="polite">
          <span className="text-foreground">{current + 1}</span> / {n}
        </p>
        <button
          type="button"
          onClick={() => next(-1)}
          aria-label="Next testimonial"
          className="grid size-9 place-items-center rounded-[6px] text-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] transition-[background-color,scale] duration-150 outline-none hover:bg-foreground/[0.04] focus-visible:ring-2 focus-visible:ring-foreground/25 active:scale-[0.96] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] dark:hover:bg-white/[0.06]"
        >
          <ChevronRight className="size-4" strokeWidth={2} />
        </button>
      </div>
    </section>
  );
}
