"use client";

import * as React from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { cn } from "@/lib/utils";

export interface RotatingWordsProps {
  /** The words to cycle through, in order. The first one shows on load. */
  words: string[];
  /** How long each word stays, in milliseconds. Default 2600. */
  interval?: number;
  /**
   * "fit" glides the width to each word, so the words around it follow
   * smoothly. "longest" holds the width of the longest word, so nothing
   * around it moves. Default "fit".
   */
  width?: "fit" | "longest";
  /** Classes for the rotating word (color, weight). It inherits the font. */
  className?: string;
  /** Fires with the index of each new word. */
  onChange?: (index: number) => void;
}

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const EASE_IN = [0.55, 0, 0.75, 0.2] as const;
// Travel (the width) uses an even in-out curve; the house ease-out snaps.
const WIDTH_EASE = "cubic-bezier(0.65, 0, 0.35, 1)";
const WIDTH_MS = 700;
// Just enough room above and below the line for ascenders and descenders,
// so the letters never roll over the lines around it, with a short fade at
// the edges that they roll through.
const PAD_TOP = "0.1em";
const PAD_BOTTOM = "0.2em";
const FADE = "0.1em";

function subscribeReduced(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function subscribeVisibility(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

function letters(word: string) {
  return Array.from(word).map((char) => (char === " " ? " " : char));
}

function Letters({ word }: { word: string }) {
  return letters(word).map((char, i) => (
    <span key={i} className="inline-block">
      {char}
    </span>
  ));
}

export function RotatingWords({
  words,
  interval = 2600,
  width = "fit",
  className,
  onChange,
}: RotatingWordsProps) {
  const rootRef = React.useRef<HTMLSpanElement>(null);
  const measureRefs = React.useRef<(HTMLSpanElement | null)[]>([]);
  const [widths, setWidths] = React.useState<number[] | null>(null);
  // The step counts every swap (it keys the letters); prev is the word before.
  const [{ step, prev }, setTurn] = React.useState({ step: 0, prev: 0 });

  const reduce = React.useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
  const visible = React.useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "visible",
    () => false,
  );
  const inView = useInView(rootRef, { margin: "-10% 0px" });

  const count = words.length;
  const index = count ? step % count : 0;
  const word = words[index] ?? "";

  // Measure every word as it renders here (same font, same letter boxes),
  // and again whenever a web font swaps in and changes the sizes.
  const key = words.join("\u0000");
  React.useLayoutEffect(() => {
    const nodes = measureRefs.current.slice(0, count);
    // The observer also reports once right away, which gives the first sizes.
    const observer = new ResizeObserver(() =>
      setWidths(nodes.map((node) => node?.getBoundingClientRect().width ?? 0)),
    );
    nodes.forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, [key, count]);

  const running = !reduce && visible && inView && count > 1 && widths !== null;
  React.useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => {
      setTurn({ step: step + 1, prev: step % count });
      onChange?.((step + 1) % count);
    }, interval);
    return () => window.clearTimeout(id);
  }, [running, step, count, interval, onChange]);

  const longest = widths ? Math.max(...widths) : 0;
  const current = widths ? (width === "longest" ? longest : widths[index]) : 0;
  const before = widths
    ? width === "longest"
      ? longest
      : (widths[prev % count] ?? current)
    : 0;
  // A shrinking box waits for the old letters to leave before closing in.
  const shrinkDelay = current < before ? 140 : 0;
  const mask = `linear-gradient(to bottom, transparent, #000 ${FADE}, #000 calc(100% - ${FADE}), transparent)`;

  return (
    <span
      ref={rootRef}
      className={cn("relative inline-block whitespace-nowrap", className)}
      style={{
        paddingTop: PAD_TOP,
        paddingBottom: PAD_BOTTOM,
        marginTop: `-${PAD_TOP}`,
        marginBottom: `-${PAD_BOTTOM}`,
        verticalAlign: "baseline",
        ...(widths && {
          width: current,
          transition: `width ${WIDTH_MS}ms ${WIDTH_EASE} ${shrinkDelay}ms`,
          WebkitMaskImage: mask,
          maskImage: mask,
        }),
      }}
    >
      <span className="sr-only">{word}</span>

      {/* Measuring copies, never seen. */}
      <span
        aria-hidden="true"
        className="pointer-events-none invisible absolute top-0 left-0 whitespace-nowrap"
      >
        {words.map((w, i) => (
          <span
            key={`${w}-${i}`}
            ref={(node) => {
              measureRefs.current[i] = node;
            }}
            className="absolute top-0 left-0"
          >
            <Letters word={w} />
          </span>
        ))}
      </span>

      {widths === null ? (
        // Until the sizes are known, the first word paints as plain text.
        <span aria-hidden="true">
          <Letters word={word} />
        </span>
      ) : (
        <>
          {/* Holds the line box and the baseline; the letters ride over it. */}
          <span aria-hidden="true" className="invisible">
            {"​"}
          </span>
          <AnimatePresence initial={false}>
            <span
              key={step}
              aria-hidden="true"
              className="absolute left-0"
              style={{ top: PAD_TOP }}
            >
              {letters(word).map((char, i) => (
                <motion.span
                  key={i}
                  className="inline-block will-change-transform"
                  initial={{ y: "105%", opacity: 0 }}
                  animate={{
                    y: "0%",
                    opacity: 1,
                    transition: {
                      y: { duration: 0.62, ease: EASE_OUT, delay: 0.16 + i * 0.026 },
                      opacity: { duration: 0.3, ease: "linear", delay: 0.16 + i * 0.026 },
                    },
                  }}
                  exit={{
                    y: "-105%",
                    opacity: 0,
                    transition: {
                      y: { duration: 0.34, ease: EASE_IN, delay: i * 0.014 },
                      opacity: { duration: 0.26, ease: "linear", delay: 0.06 + i * 0.014 },
                    },
                  }}
                >
                  {char}
                </motion.span>
              ))}
            </span>
          </AnimatePresence>
        </>
      )}
    </span>
  );
}
