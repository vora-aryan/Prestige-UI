"use client";

import * as React from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type AnimationPlaybackControls,
} from "motion/react";
import { Check, Download } from "lucide-react";
import { cn } from "@/lib/utils";

type InteractiveButtonState = "idle" | "loading" | "success";

type InteractiveButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /**
   * The work to run on click. Call `progress` with a value from 0 to 1 to show
   * real progress; without it the fill creeps towards 90% until the promise
   * settles.
   */
  action?: (progress: (value: number) => void) => Promise<void>;
  /** Label while the action runs. */
  loadingLabel?: string;
  /** Label once the action has finished. */
  successLabel?: string;
  /** How long the finished state stays, in milliseconds. */
  successDuration?: number;
};

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
// A gentle curve for the indeterminate creep: it keeps moving for the whole
// wait instead of racing to 70% and stalling.
const CREEP_EASE = [0.25, 0.6, 0.35, 1] as const;

function Swap({
  children,
  reduceMotion,
}: {
  children: React.ReactNode;
  reduceMotion: boolean;
}) {
  return (
    <motion.span
      initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE_OUT } }}
      exit={{
        opacity: 0,
        y: reduceMotion ? 0 : -4,
        transition: { duration: 0.14, ease: EASE_OUT },
      }}
      className="col-start-1 row-start-1 flex items-center justify-center gap-2 whitespace-nowrap"
    >
      {children}
    </motion.span>
  );
}

const InteractiveButton = React.forwardRef<HTMLButtonElement, InteractiveButtonProps>(
  (
    {
      action,
      loadingLabel = "Downloading",
      successLabel = "Downloaded",
      successDuration = 1600,
      children = "Download",
      className,
      disabled,
      onClick,
      ...props
    },
    ref,
  ) => {
    const [state, setState] = React.useState<InteractiveButtonState>("idle");
    const [percent, setPercent] = React.useState<number | null>(null);
    const reduceMotion = Boolean(useReducedMotion());
    const fill = useMotionValue(0);
    const fillAnimation = React.useRef<AnimationPlaybackControls | null>(null);
    const generation = React.useRef(0);
    const timer = React.useRef<number | undefined>(undefined);

    const moveFill = React.useCallback(
      (to: number, duration: number, ease: readonly number[] = EASE_OUT) => {
        fillAnimation.current?.stop();
        fillAnimation.current = animate(fill, to, {
          duration: reduceMotion ? 0 : duration,
          ease: [...ease] as [number, number, number, number],
        });
        return fillAnimation.current;
      },
      [fill, reduceMotion],
    );

    React.useEffect(() => {
      return () => {
        generation.current += 1;
        window.clearTimeout(timer.current);
        fillAnimation.current?.stop();
      };
    }, []);

    const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (event.defaultPrevented || !action || disabled || state !== "idle") return;

      const gen = ++generation.current;
      let determinate = false;
      fill.set(0);
      setPercent(null);
      setState("loading");
      moveFill(0.9, 3.2, CREEP_EASE);

      const report = (value: number) => {
        if (generation.current !== gen) return;
        const clamped = Math.min(1, Math.max(0, value));
        determinate = true;
        setPercent(Math.round(clamped * 100));
        moveFill(clamped, 0.3);
      };

      try {
        await action(report);
        if (generation.current !== gen) return;
        if (determinate) setPercent(100);
        // The fill reaches the end before the label says it is done.
        await moveFill(1, 0.28);
        if (generation.current !== gen) return;
        setState("success");
        timer.current = window.setTimeout(() => {
          if (generation.current !== gen) return;
          setState("idle");
          moveFill(0, 0.2);
        }, successDuration);
      } catch {
        if (generation.current !== gen) return;
        setState("idle");
        moveFill(0, 0.2);
      }
    };

    const idleLabel = (
      <>
        <Download
          aria-hidden
          className="size-4 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0.5"
        />
        {children}
      </>
    );
    const loadingText = (value: number | null) => (
      <>
        {loadingLabel}
        {value !== null && (
          <span className="inline-block w-[4ch] text-left tabular-nums text-muted-foreground">
            {value}%
          </span>
        )}
      </>
    );
    const successText = (
      <>
        <Check aria-hidden className="size-4" strokeWidth={2.5} />
        {successLabel}
      </>
    );

    return (
      <button
        ref={ref}
        type="button"
        disabled={Boolean(disabled) || state !== "idle"}
        onClick={handleClick}
        aria-busy={state === "loading"}
        data-state={state}
        className={cn(
          "group relative inline-flex h-11 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-border bg-background px-5 text-sm font-medium text-foreground",
          "transition-[background-color,transform,scale] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-muted active:scale-[0.98]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:pointer-events-none data-[state=idle]:disabled:opacity-50",
          className,
        )}
        {...props}
      >
        <motion.span
          aria-hidden
          style={{ scaleX: fill }}
          className="pointer-events-none absolute inset-0 origin-left bg-foreground/[0.07]"
        />

        <span className="relative grid">
          {/* Every label sits in the same cell, so the button never resizes. */}
          <span aria-hidden className="invisible col-start-1 row-start-1 flex items-center justify-center gap-2 whitespace-nowrap">
            {idleLabel}
          </span>
          <span aria-hidden className="invisible col-start-1 row-start-1 flex items-center justify-center gap-2 whitespace-nowrap">
            {loadingText(100)}
          </span>
          <span aria-hidden className="invisible col-start-1 row-start-1 flex items-center justify-center gap-2 whitespace-nowrap">
            {successText}
          </span>

          <AnimatePresence initial={false}>
            {state === "idle" && (
              <Swap key="idle" reduceMotion={reduceMotion}>
                {idleLabel}
              </Swap>
            )}
            {state === "loading" && (
              // Centred while there is no value; the first value crossfades
              // to the label-plus-percent layout instead of shoving it aside.
              <Swap key={percent === null ? "loading" : "progress"} reduceMotion={reduceMotion}>
                {loadingText(percent)}
              </Swap>
            )}
            {state === "success" && (
              <Swap key="success" reduceMotion={reduceMotion}>
                {successText}
              </Swap>
            )}
          </AnimatePresence>
        </span>

        <span className="sr-only" aria-live="polite">
          {state === "loading" ? loadingLabel : state === "success" ? successLabel : ""}
        </span>
      </button>
    );
  },
);
InteractiveButton.displayName = "InteractiveButton";

export { InteractiveButton, type InteractiveButtonProps };
