"use client";

import React, { useEffect, useRef, useState, forwardRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export interface ScrambleTextProps {
  /** The final text to settle on (required) */
  text: string;
  /** Wrapper element, default "span" */
  as?: React.ElementType;
  /** Total time in ms for the scramble, default 800 */
  duration?: number;
  /** ms between character updates, default 50 */
  speed?: number;
  /**
   * Pool of random characters to cycle through. By default each character
   * cycles through glyphs of its kind (A–Z, a–z or 0–9) about as wide as
   * itself, so words keep their size in any font.
   */
  chars?: string;
  /** Whether characters settle left-to-right or all at once, default "sequential" */
  revealMode?: "sequential" | "all";
  /** When to start, default "mount" */
  trigger?: "mount" | "hover" | "inView";
  /** Additional CSS classes */
  className?: string;
  /** Fires when the final text is fully settled */
  onComplete?: () => void;
}

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";

function poolFor(char: string) {
  if (/[a-z]/.test(char)) return LOWER;
  if (/[0-9]/.test(char)) return DIGITS;
  return UPPER;
}

// For each character, the glyphs of its kind that are about as wide in the
// element's own font, so a scrambled word keeps the size of the real one
// instead of running into its neighbors.
function matchWidths(el: HTMLElement | null, text: string) {
  const pools = new Map<string, string>();
  const ctx = el ? document.createElement("canvas").getContext("2d") : null;
  if (!el || !ctx) return pools;
  const style = getComputedStyle(el);
  ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const width = (char: string) => ctx.measureText(char).width;
  for (const char of new Set(text)) {
    if (!/[a-zA-Z0-9]/.test(char)) continue;
    const target = width(char);
    const near = [...poolFor(char)]
      .map((glyph) => ({ glyph, gap: Math.abs(width(glyph) - target) }))
      .sort((a, b) => a.gap - b.gap);
    // Within 8% of the real glyph's width, and never fewer than four.
    const keep = near.filter((n, index) => index < 4 || n.gap <= target * 0.08);
    pools.set(char, keep.map((n) => n.glyph).join(""));
  }
  return pools;
}

/** Words and the spaces between them, with where each starts in the text. */
function splitWords(text: string) {
  const parts: { part: string; start: number }[] = [];
  let start = 0;
  for (const part of text.split(/(\s+)/)) {
    if (part) parts.push({ part, start });
    start += part.length;
  }
  return parts;
}

export const ScrambleText = forwardRef<HTMLElement, ScrambleTextProps>(
  (
    {
      text,
      as = "span",
      duration = 800,
      speed = 40,
      chars,
      revealMode = "sequential",
      trigger = "mount",
      className,
      onComplete,
    },
    ref,
  ) => {
    const prefersReducedMotion = useReducedMotion();
    const [displayText, setDisplayText] = useState(text);
    const [isAnimating, setIsAnimating] = useState(false);
    const containerRef = useRef<HTMLElement | null>(null);
    const isInView = useInView(containerRef as React.RefObject<Element>, {
      once: true,
    });

    // Set up local ref to manage inView if external ref isn't provided or needed
    const mergedRef = (node: HTMLElement) => {
      containerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref)
        (ref as React.MutableRefObject<HTMLElement | null>).current = node;
    };

    const scramble = () => {
      if (prefersReducedMotion) {
        setDisplayText(text);
        onComplete?.();
        return;
      }

      setIsAnimating(true);
      let intervalId: number | null = null;

      const run = () => {
        let iterations = 0;
        const totalIterations = duration / speed;
        const textArray = text.split("");
        const pools = chars ? null : matchWidths(containerRef.current, text);

        intervalId = window.setInterval(() => {
          let allSettled = true;

          const newText = textArray.map((char, index) => {
            if (char === " " || !/[a-zA-Z0-9]/.test(char)) return char;

            let isSettled = false;
            if (revealMode === "sequential") {
              isSettled = iterations >= (totalIterations / text.length) * index;
            } else {
              isSettled = iterations >= totalIterations;
            }

            if (isSettled) {
              return char;
            } else {
              allSettled = false;
              const pool = chars || pools?.get(char) || poolFor(char);
              return pool[Math.floor(Math.random() * pool.length)];
            }
          });

          setDisplayText(newText.join(""));
          iterations++;

          if (allSettled || iterations >= totalIterations + 1) {
            window.clearInterval(intervalId!);
            setDisplayText(text);
            setIsAnimating(false);
            onComplete?.();
          }
        }, speed);
      };

      run();

      return () => {
        if (intervalId) window.clearInterval(intervalId);
      };
    };

    useEffect(() => {
      let cleanup: (() => void) | undefined;
      if (trigger === "mount") {
        cleanup = scramble();
      } else if (trigger === "inView" && isInView) {
        cleanup = scramble();
      }
      return () => {
        if (cleanup) cleanup();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trigger, isInView, text, prefersReducedMotion]);

    const handleMouseEnter = () => {
      if (trigger === "hover" && !isAnimating) {
        scramble();
      }
    };

    const shown = prefersReducedMotion ? text : displayText;

    const MotionComponent = motion[
      as as keyof typeof motion
    ] as React.ElementType;

    return (
      <MotionComponent
        ref={mergedRef}
        className={cn("relative inline-block", className)}
        onMouseEnter={handleMouseEnter}
      >
        <span className="sr-only">{text}</span>
        {/* Each word keeps the size of its final form, so random glyphs of
            other widths never move the text around it, in any font. */}
        <span aria-hidden="true">
          {splitWords(text).map(({ part, start }) =>
            /^\s+$/.test(part) ? (
              part
            ) : (
              <span key={start} className="relative inline-block whitespace-nowrap">
                <span className="invisible">{part}</span>
                <span className="absolute top-0 left-0">
                  {shown.slice(start, start + part.length)}
                </span>
              </span>
            ),
          )}
        </span>
      </MotionComponent>
    );
  },
);

ScrambleText.displayName = "ScrambleText";
