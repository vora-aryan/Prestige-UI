"use client";

import * as React from "react";
import { motion, useInView } from "motion/react";
import { cn } from "@/lib/utils";

export interface LineMaskRevealProps {
  /** The copy. It is split into lines exactly where the browser wraps it. */
  text: string;
  /** Element for the copy. Default "h2". */
  as?: "h1" | "h2" | "h3" | "p" | "div";
  /** "inView" plays once when it scrolls into view; "mount" plays on load. Default "inView". */
  trigger?: "inView" | "mount";
  /** Seconds before the first line moves. Default 0. */
  delay?: number;
  /** Seconds between lines. Default 0.09. */
  stagger?: number;
  /** Seconds each line takes to rise. Default 0.95. */
  duration?: number;
  className?: string;
}

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
// Room inside each line's mask for ascenders and descenders, taken back
// with negative margins so the lines keep their exact spacing.
const PAD_TOP = "0.08em";
const PAD_BOTTOM = "0.22em";

function subscribeReduced(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/** Group the measured words into the lines the browser drew. */
function readLines(root: HTMLElement) {
  const lines: string[][] = [];
  let lastTop = Number.NaN;
  root.querySelectorAll<HTMLElement>("[data-word]").forEach((word) => {
    const top = Math.round(word.getBoundingClientRect().top);
    if (lines.length === 0 || Math.abs(top - lastTop) > 2) {
      lines.push([]);
      lastTop = top;
    }
    lines[lines.length - 1].push(word.textContent ?? "");
  });
  return lines.map((words) => words.join(" "));
}

export function LineMaskReveal({
  text,
  as = "h2",
  trigger = "inView",
  delay = 0,
  stagger = 0.09,
  duration = 0.95,
  className,
}: LineMaskRevealProps) {
  const rootRef = React.useRef<HTMLElement>(null);
  const measureRef = React.useRef<HTMLSpanElement>(null);
  const [lines, setLines] = React.useState<string[] | null>(null);
  // Once revealed, lines re-split by a resize appear in place, not again.
  const [done, setDone] = React.useState(false);
  const inView = useInView(rootRef, { once: true, amount: 0.35 });
  const reduce = React.useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  // A hidden copy wraps exactly like the real text; reading where its words
  // land gives the lines. It is read again whenever the width changes, so
  // the lines always match the layout (after the reveal they simply stay).
  React.useEffect(() => {
    const node = measureRef.current;
    if (!node) return;
    let width = -1;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next === width) return;
      width = next;
      const read = readLines(node);
      setLines((prev) => (prev && prev.join("\n") === read.join("\n") ? prev : read));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [text]);

  const play = reduce || (trigger === "mount" ? true : inView);
  const words = text.trim().split(/\s+/);
  const Tag = as as React.ElementType;

  return (
    <Tag ref={rootRef} className={cn("relative", className)}>
      {/* The text as the browser lays it out: it sets the size, stays unseen,
          and tells where each line breaks. */}
      <span ref={measureRef} aria-hidden="true" className="invisible block">
        {words.map((word, i) => (
          <React.Fragment key={i}>
            <span data-word="">{word}</span>
            {i < words.length - 1 ? " " : null}
          </React.Fragment>
        ))}
      </span>

      {lines !== null && (
        // The lines, laid exactly over it. Each mask has room for ascenders
        // and descenders; the bottom margin gives that room back (a top
        // margin would collapse into it), and the whole stack starts that
        // much higher so the first line lands where the text is.
        <span className="absolute inset-x-0 block" style={{ top: `-${PAD_TOP}` }}>
          {lines.map((line, i) => (
            <span
              key={`${i}-${line}`}
              className="block overflow-clip"
              style={{
                paddingTop: PAD_TOP,
                paddingBottom: PAD_BOTTOM,
                marginBottom: `calc(-${PAD_TOP} - ${PAD_BOTTOM})`,
              }}
            >
              <motion.span
                className="block whitespace-nowrap will-change-transform"
                initial={reduce || done ? false : { y: "115%" }}
                animate={play ? { y: "0%" } : { y: "115%" }}
                transition={{ duration, ease: EASE_OUT, delay: delay + i * stagger }}
                onAnimationComplete={i === lines.length - 1 && play ? () => setDone(true) : undefined}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </span>
      )}
    </Tag>
  );
}
