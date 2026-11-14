"use client";

import * as React from "react";
import { animate, motion, useInView, useMotionValue, useTransform, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";

export interface ScrollFillProps {
  /** The copy to fill. */
  text: string;
  /** Element for the copy. Default "p". */
  as?: "p" | "h1" | "h2" | "h3" | "blockquote" | "div";
  /** Opacity of a word before it fills, 0 to 1. Default 0.18. */
  from?: number;
  /**
   * Where the fill starts: the top of the copy at this height of the
   * viewport (0 is the top edge, 1 the bottom). Default 0.85.
   */
  start?: number;
  /**
   * Where the fill is complete: the bottom of the copy at this height of
   * the viewport. Default 0.4, so it always finishes while the copy is in view.
   */
  end?: number;
  className?: string;
}

const isSpace = (part: string) => /^\s+$/.test(part);

/** The copy as words and the spaces between them, each word with its place. */
function splitWords(text: string) {
  let n = -1;
  return text
    .split(/(\s+)/)
    .filter(Boolean)
    .map((part) => ({ part, index: isSpace(part) ? -1 : ++n }));
}

function subscribeReduced(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/**
 * What scrolls the copy: the nearest scrolling ancestor, the page (null),
 * or nothing ("fixed") when it sits in a fixed layer such as a full-screen
 * overlay that the page's scroll doesn't move.
 */
function scrollParent(node: HTMLElement): HTMLElement | null | "fixed" {
  for (let el = node.parentElement; el && el !== document.body; el = el.parentElement) {
    const { overflowY, position } = getComputedStyle(el);
    if (/(auto|scroll|overlay)/.test(overflowY) && el.scrollHeight > el.clientHeight + 1) return el;
    if (position === "fixed") return "fixed";
  }
  return null;
}

function Word({
  progress,
  range,
  from,
  children,
}: {
  progress: MotionValue<number>;
  range: [number, number];
  from: number;
  children: string;
}) {
  const opacity = useTransform(progress, range, [from, 1]);
  return <motion.span style={{ opacity }}>{children}</motion.span>;
}

export function ScrollFill({
  text,
  as = "p",
  from = 0.18,
  start = 0.85,
  end = 0.4,
  className,
}: ScrollFillProps) {
  const ref = React.useRef<HTMLElement>(null);
  const progress = useMotionValue(0);
  const [timed, setTimed] = React.useState(false);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduce = React.useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  const parts = splitWords(text);
  const words = parts.filter((p) => p.index >= 0).length;

  // Scroll drives the fill. The range adapts to the page: it never starts
  // before the top (copy already on screen at load starts empty and fills
  // as you scroll) and never ends past the furthest the page can scroll
  // (copy near the bottom of a page still finishes). With too little
  // scroll to drive it, it fills at reading pace once in view instead.
  React.useEffect(() => {
    const node = ref.current;
    if (!node || reduce) return;
    const found = scrollParent(node);
    if (found === "fixed") {
      // Nothing scrolls it here; fill at reading pace once in view.
      const id = requestAnimationFrame(() => setTimed(true));
      return () => cancelAnimationFrame(id);
    }
    const parent = found;
    const scroller = parent ?? document.scrollingElement ?? document.documentElement;
    const target: HTMLElement | Window = parent ?? window;

    let range: [number, number] | null = null;
    const measure = () => {
      const view = parent ? parent.clientHeight : window.innerHeight;
      const top = parent
        ? node.getBoundingClientRect().top - parent.getBoundingClientRect().top + parent.scrollTop
        : node.getBoundingClientRect().top + window.scrollY;
      const bottom = top + node.offsetHeight;
      const max = scroller.scrollHeight - view;
      const first = Math.max(0, top - start * view);
      const last = Math.min(max, bottom - end * view);
      range = last - first >= view * 0.2 ? [first, last] : null;
      setTimed(range === null);
      update();
    };
    const update = () => {
      if (!range) return;
      const y = parent ? parent.scrollTop : window.scrollY;
      progress.set(Math.min(1, Math.max(0, (y - range[0]) / (range[1] - range[0]))));
    };

    // The observer reports once right away, which takes the first measure.
    target.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", measure);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (parent) observer.observe(parent);
    return () => {
      target.removeEventListener("scroll", update);
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [reduce, start, end, progress]);

  React.useEffect(() => {
    if (!timed || !inView || reduce) return;
    const controls = animate(progress, 1, {
      duration: Math.min(3.2, Math.max(1.4, words * 0.07)),
      ease: [0.33, 0, 0.67, 1],
      delay: 0.2,
    });
    return () => controls.stop();
  }, [timed, inView, reduce, words, progress]);

  // Each word fills over a short stretch that overlaps its neighbours, so
  // the edge between read and unread is soft, about three words wide.
  const span = Math.min(0.35, 3 / Math.max(words, 1));
  const step = words > 1 ? (1 - span) / (words - 1) : 0;

  const Tag = as as React.ElementType;
  return (
    <Tag ref={ref} className={cn(className)}>
      {parts.map(({ part, index }, i) => {
        if (index < 0) return part;
        if (reduce) return <span key={i}>{part}</span>;
        const at = index * step;
        return (
          <Word key={i} progress={progress} range={[at, at + span]} from={from}>
            {part}
          </Word>
        );
      })}
    </Tag>
  );
}
