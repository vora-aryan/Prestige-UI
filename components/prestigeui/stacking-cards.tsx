"use client";

import * as React from "react";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StackingCardItem {
  /** Short name in the card's top row, e.g. a client or step name. It stays visible once the card is covered. */
  label: string;
  /** Small note at the right of the top row, e.g. "Packaging". */
  tag?: string;
  title: string;
  description?: string;
  /** Facts set in two columns under the description. */
  meta?: { label: string; value: string }[];
  href?: string;
  linkLabel?: string;
  image?: { src: string; alt: string };
  /** Any visual in place of the image. */
  media?: React.ReactNode;
}

export interface StackingCardsProps {
  items: StackingCardItem[];
  /** Where the stack pins, in px from the top of the view. Leave room for a sticky header. */
  top?: number;
  /**
   * Eases mouse-wheel and trackpad scrolling while the stack is on screen, so
   * the cards glide instead of stepping. Turn it off if your site already
   * smooths scrolling (Lenis is detected and left alone).
   */
  smooth?: boolean;
  className?: string;
}

// Height of each card's top row. Covered cards leave exactly this much showing,
// so the finished stack reads as a list of what is underneath.
const HEAD = 56;
// How far each covered card eases back, per card above it.
const STEP = 0.04;

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

/** The nearest pane that really scrolls, or null for the page. */
function scrollParent(node: HTMLElement): HTMLElement | null {
  let el = node.parentElement;
  while (el && el !== document.body) {
    const scrolls = /(auto|scroll|overlay)/.test(getComputedStyle(el).overflowY);
    if (scrolls && el.scrollHeight > el.clientHeight + 1) return el;
    el = el.parentElement;
  }
  return null;
}

/** True if something between `from` and the scroller can still scroll this way itself. */
function innerCanScroll(from: EventTarget | null, delta: number, scroller: Element) {
  let el = from instanceof Element ? from : null;
  while (el && el !== scroller && el !== document.documentElement) {
    if (el.hasAttribute("data-lenis-prevent")) return true;
    if (el.scrollHeight > el.clientHeight + 1 && /(auto|scroll|overlay)/.test(getComputedStyle(el).overflowY)) {
      if (delta > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return true;
    }
    el = el.parentElement;
  }
  return false;
}

/*
 * Smooth wheel scrolling, the way Lenis does it: wheel steps move a target and
 * the real scroll position follows it on an exponential ease every frame
 * (Lenis's default lerp of 0.1 at 60fps). Only while `active`; touch,
 * keyboard, scrollbar, zoom gestures and inner scroll areas stay native.
 */
function useSmoothWheel(active: boolean, pane: HTMLElement | null) {
  const glide = React.useRef<(top: number) => void>(() => {});

  React.useEffect(() => {
    const el = pane ?? (document.scrollingElement as HTMLElement | null);
    if (!active || !el || document.documentElement.classList.contains("lenis")) {
      glide.current = (top) => (pane ?? window).scrollTo({ top, behavior: "smooth" });
      return;
    }
    const events: HTMLElement | Window = pane ?? window;
    let current = el.scrollTop;
    let goal = current;
    let frame = 0;
    let last = 0;
    const max = () => el.scrollHeight - el.clientHeight;
    const set = (top: number) => (pane ? (pane.scrollTop = top) : window.scrollTo(0, top));

    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
      last = now;
      current += (goal - current) * (1 - Math.exp(-60 * 0.1 * dt));
      if (Math.abs(goal - current) < 0.5) current = goal;
      set(current);
      if (current !== goal) frame = requestAnimationFrame(tick);
      else frame = last = 0;
    };
    const go = (top: number) => {
      if (!frame) current = el.scrollTop;
      goal = Math.min(max(), Math.max(0, top));
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const onWheel = (event: Event) => {
      const e = event as WheelEvent;
      if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (innerCanScroll(e.target, e.deltaY, el)) return;
      e.preventDefault();
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * el.clientHeight : e.deltaY;
      go((frame ? goal : el.scrollTop) + delta);
    };
    // Keyboard, scrollbar or touch scrolling while idle: start from there next time.
    const onScroll = () => {
      if (!frame) current = goal = el.scrollTop;
    };

    glide.current = go;
    events.addEventListener("wheel", onWheel, { passive: false });
    events.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      events.removeEventListener("wheel", onWheel);
      events.removeEventListener("scroll", onScroll);
    };
  }, [active, pane]);

  return glide;
}

/*
 * Each card sits in a sticky slot one screen tall, so the browser pins it and
 * a screen of scrolling brings up the next. Covered cards ease back and darken
 * in step with the scroll, and each photo settles from a zoom as its card
 * rises, like a parallax. With `smooth`, wheel scrolling glides.
 */
export function StackingCards({ items, top = 88, smooth = true, className }: StackingCardsProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const count = items.length;
  const [pane, setPane] = React.useState<HTMLElement | null>(null);
  const paneRef = React.useRef<HTMLElement | null>(null);
  const [near, setNear] = React.useState(false);

  React.useLayoutEffect(() => {
    if (!ref.current) return;
    const found = scrollParent(ref.current);
    paneRef.current = found;
    if (found) setPane(found);
  }, []);

  // Smooth scrolling only runs while the stack is on or near the screen.
  React.useEffect(() => {
    const root = ref.current;
    if (!root || !smooth) return;
    const io = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), {
      root: pane,
      rootMargin: "50% 0px",
    });
    io.observe(root);
    return () => io.disconnect();
  }, [smooth, pane]);

  const glide = useSmoothWheel(smooth && near && !reduce, pane);

  const { scrollYProgress } = useScroll({
    target: ref,
    container: pane ? (paneRef as React.RefObject<HTMLElement>) : undefined,
    offset: ["start start", "end end"],
  });

  // Every card takes the height of the tallest so covered cards line up.
  React.useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-stack-card]"));
    const measure = () => {
      cards.forEach((card) => (card.style.minHeight = ""));
      const tallest = Math.max(...cards.map((card) => card.offsetHeight));
      cards.forEach((card) => (card.style.minHeight = `${tallest}px`));
    };
    measure();
    const resize = new ResizeObserver(measure);
    cards.forEach((card) => card.firstElementChild && resize.observe(card.firstElementChild));
    return () => resize.disconnect();
  }, [count, reduce]);

  // Scrolls so card `index` is the one on top.
  const bring = React.useCallback(
    (index: number) => {
      const root = ref.current;
      if (!root || reduce) return;
      const slot = root.children[index] as HTMLElement | undefined;
      if (!slot) return;
      const paneTop = pane ? pane.getBoundingClientRect().top : 0;
      const scrollTop = pane ? pane.scrollTop : window.scrollY;
      glide.current(scrollTop + root.getBoundingClientRect().top - paneTop + index * slot.offsetHeight);
    },
    [reduce, pane, glide],
  );

  return (
    <div ref={ref} className={cn("relative w-full min-w-0", reduce && "flex flex-col gap-8", className)}>
      {items.map((item, i) => (
        <Slot
          key={item.label}
          item={item}
          index={i}
          count={count}
          top={top}
          progress={scrollYProgress}
          pane={pane ? paneRef : undefined}
          reduce={reduce}
          onBring={bring}
        />
      ))}
    </div>
  );
}

function Slot({
  item,
  index,
  count,
  top,
  progress,
  pane,
  reduce,
  onBring,
}: {
  item: StackingCardItem;
  index: number;
  count: number;
  top: number;
  progress: MotionValue<number>;
  pane?: React.RefObject<HTMLElement | null>;
  reduce: boolean;
  onBring: (index: number) => void;
}) {
  const slot = React.useRef<HTMLDivElement>(null);
  const last = count - 1;

  // Eases back from the moment it is pinned until the last card lands.
  const start = last > 0 ? index / last : 1;
  const scale = useTransform(progress, [start, 1], [1, 1 - (last - index) * STEP]);
  const shade = useTransform(progress, [start, 1], [0, Math.min((last - index) * 0.06, 0.18)]);

  // The photo settles from a zoom while its card rises into place.
  const { scrollYProgress: arrival } = useScroll({
    target: slot,
    container: pane as React.RefObject<HTMLElement> | undefined,
    offset: ["start end", "start start"],
  });
  const zoom = useTransform(arrival, [0, 1], [1.3, 1]);

  if (reduce) return <Card item={item} index={index} count={count} onBring={onBring} />;

  return (
    <div ref={slot} className="pointer-events-none sticky top-0 h-svh" style={{ paddingTop: top + index * HEAD }}>
      <motion.div className="pointer-events-auto origin-top will-change-transform" style={{ scale }}>
        <Card item={item} index={index} count={count} onBring={onBring} zoom={zoom} shade={shade} />
      </motion.div>
    </div>
  );
}

function Card({
  item,
  index,
  count,
  onBring,
  zoom,
  shade,
}: {
  item: StackingCardItem;
  index: number;
  count: number;
  onBring: (index: number) => void;
  zoom?: MotionValue<number>;
  shade?: MotionValue<number>;
}) {
  return (
    <article
      data-stack-card
      aria-label={`${index + 1} of ${count}: ${item.label}`}
      onFocus={(event) => {
        if (event.target.matches(":focus-visible")) onBring(index);
      }}
      className={cn(
        "@container relative flex flex-col overflow-clip rounded-lg bg-white",
        "shadow-[0_0_0_1px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.05),0_-10px_30px_-18px_rgba(0,0,0,0.22)]",
        "dark:bg-[#17171b] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.14),inset_0_1px_0_rgba(255,255,255,0.05),0_-12px_32px_-16px_rgba(0,0,0,0.9)]",
      )}
    >
      <div className="flex flex-1 flex-col">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onBring(index)}
          className="flex shrink-0 items-center gap-3 border-b border-black/[0.06] px-5 text-left outline-none dark:border-white/10"
          style={{ height: HEAD }}
        >
          <span className="w-5 text-[13px] text-foreground/40 tabular-nums">{String(index + 1).padStart(2, "0")}</span>
          <span className="min-w-0 truncate text-[14px] font-medium text-foreground">{item.label}</span>
          {item.tag && <span className="ml-auto shrink-0 text-[13px] text-foreground/50">{item.tag}</span>}
        </button>

        <div className="grid flex-1 @3xl:grid-cols-[5fr_7fr]">
          <div className="flex min-w-0 flex-col p-5 @3xl:p-8 @3xl:pr-10">
            <h3 className="text-[22px] leading-[1.15] font-medium tracking-[-0.02em] text-balance text-foreground @3xl:text-[30px] @3xl:leading-[1.1]">
              {item.title}
            </h3>
            {item.description && (
              <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-pretty text-foreground/60">
                {item.description}
              </p>
            )}
            {item.meta && item.meta.length > 0 && (
              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 @3xl:mt-auto @3xl:pt-8">
                {item.meta.map((fact) => (
                  <div key={fact.label} className="min-w-0">
                    <dt className="text-[12px] text-foreground/45">{fact.label}</dt>
                    <dd className="mt-0.5 text-[13.5px] text-foreground">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {item.href && (
              <a
                href={item.href}
                className={cn(
                  "group/link mt-6 inline-flex h-9 items-center gap-1.5 self-start rounded-md bg-neutral-900 px-3.5 text-[13.5px] font-medium text-white transition-colors outline-none hover:bg-neutral-800 focus-visible:ring-[3px] focus-visible:ring-neutral-900/20 dark:bg-white dark:text-neutral-900 dark:hover:bg-white/90 dark:focus-visible:ring-white/25",
                  !item.meta?.length && "@3xl:mt-auto",
                )}
              >
                {item.linkLabel ?? "Learn more"}
                <ArrowUpRight
                  className="size-3.5 transition-transform duration-200 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5"
                  strokeWidth={2}
                />
              </a>
            )}
          </div>

          {(item.media || item.image) && (
            <div className="min-w-0 px-2 pb-2 @3xl:py-2 @3xl:pl-0">
              <div className="relative aspect-[16/10] h-full w-full overflow-clip rounded-[5px] bg-neutral-100 @3xl:aspect-auto @3xl:min-h-[360px] dark:bg-white/5">
                {item.media ??
                  (item.image && (
                    <motion.img
                      src={item.image.src}
                      alt={item.image.alt}
                      loading="lazy"
                      draggable={false}
                      style={zoom ? { scale: zoom } : undefined}
                      className="absolute inset-0 size-full object-cover"
                    />
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Darkens a card a little more for every card that covers it. */}
      {shade && (
        <motion.div aria-hidden style={{ opacity: shade }} className="pointer-events-none absolute inset-0 bg-black" />
      )}
    </article>
  );
}
