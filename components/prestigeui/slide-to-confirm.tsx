"use client";

import * as React from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SlideState = "idle" | "dragging" | "pending" | "done";

type SlideToConfirmProps = {
  /** Runs once the thumb reaches the end. Reject to send it back with the error label. */
  action?: () => Promise<void>;
  /** The label in the track. */
  label?: string;
  pendingLabel?: string;
  doneLabel?: string;
  errorLabel?: string;
  /** How far the thumb must travel, from 0 to 1, before letting go confirms. */
  threshold?: number;
  /** Return to the start this many milliseconds after finishing. Leave unset to stay done. */
  resetAfter?: number;
  disabled?: boolean;
  className?: string;
};

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const HEIGHT = 48;
const INSET = 4;
const THUMB = 40;
// Springs back without overshoot, so it reads as "not yet", never as a bounce.
const RETURN = { type: "spring", stiffness: 520, damping: 42 } as const;

function Swap({
  children,
  reduce,
  className,
}: {
  children: React.ReactNode;
  reduce: boolean;
  className?: string;
}) {
  return (
    <motion.span
      initial={{ opacity: 0, y: reduce ? 0 : 4 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE_OUT } }}
      exit={{ opacity: 0, y: reduce ? 0 : -4, transition: { duration: 0.14, ease: EASE_OUT } }}
      className={cn("col-start-1 row-start-1", className)}
    >
      {children}
    </motion.span>
  );
}

function SlideToConfirm({
  action,
  label = "Slide to deploy",
  pendingLabel = "Deploying",
  doneLabel = "Deployed",
  errorLabel = "Couldn't deploy",
  threshold = 0.9,
  resetAfter,
  disabled,
  className,
}: SlideToConfirmProps) {
  const [state, setState] = React.useState<SlideState>("idle");
  const [error, setError] = React.useState(false);
  const [width, setWidth] = React.useState(0);
  const [value, setValue] = React.useState(0);
  const reduce = Boolean(useReducedMotion());
  const track = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{ id: number; startX: number; origin: number; moved: boolean; at: number } | null>(null);
  const timer = React.useRef<number | undefined>(undefined);
  const mounted = React.useRef(true);
  const x = useMotionValue(0);
  // Where the thumb is heading, so quick key presses add up instead of
  // reading a position that is still animating.
  const target = React.useRef(0);

  const max = Math.max(0, width - THUMB - INSET * 2);
  // The ink covers the track up to the thumb's right edge.
  const reach = useTransform(x, (v) => Math.max(0, width - (v + THUMB + INSET * 2)));
  const fillClip = useMotionTemplate`inset(0px ${reach}px 0px 0px round 6px)`;
  // At rest there is no ink; it fades in over the first few pixels of travel.
  const fillOpacity = useTransform(x, [0, 16], [0, 1]);

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(timer.current);
    };
  }, []);

  React.useEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => setWidth(el.offsetWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const busy = state === "pending" || state === "done";

  const sendBack = () => {
    setValue(0);
    target.current = 0;
    animate(x, 0, reduce ? { duration: 0 } : RETURN);
  };

  const confirm = async () => {
    setState("pending");
    setValue(100);
    setError(false);
    await animate(x, max, { duration: reduce ? 0 : 0.18, ease: EASE_OUT });
    if (!mounted.current) return;
    if ("vibrate" in navigator) navigator.vibrate?.(12);
    try {
      await action?.();
      if (!mounted.current) return;
      setState("done");
      if (resetAfter !== undefined) {
        timer.current = window.setTimeout(() => {
          if (!mounted.current) return;
          setState("idle");
          sendBack();
        }, resetAfter);
      }
    } catch {
      if (!mounted.current) return;
      setState("idle");
      sendBack();
      setError(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => mounted.current && setError(false), 1800);
    }
  };

  // A tap does nothing on a slider, so the thumb shows the way instead.
  const nudge = async () => {
    if (reduce) return;
    await animate(x, Math.min(28, max), { duration: 0.22, ease: EASE_OUT });
    animate(x, 0, RETURN);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || busy || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    x.stop();
    drag.current = { id: event.pointerId, startX: event.clientX, origin: x.get(), moved: false, at: performance.now() };
    target.current = x.get();
    setState("dragging");
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    const dx = event.clientX - d.startX;
    if (Math.abs(dx) > 3) d.moved = true;
    x.set(Math.min(max, Math.max(0, d.origin + dx)));
  };

  const onPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    drag.current = null;
    if (max && x.get() / max >= threshold) {
      void confirm();
      return;
    }
    setState("idle");
    if (!d.moved && performance.now() - d.at < 400) {
      void nudge();
      return;
    }
    sendBack();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || busy) return;
    const step = max / 5;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = target.current + step;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = target.current - step;
    if (event.key === "Home") next = 0;
    if (event.key === "End" || event.key === "Enter" || event.key === " ") next = max;
    if (next === null) return;
    event.preventDefault();
    const clamped = Math.min(max, Math.max(0, next));
    if (max && clamped / max >= threshold) {
      void confirm();
      return;
    }
    target.current = clamped;
    setValue(Math.round((clamped / (max || 1)) * 100));
    animate(x, clamped, { duration: reduce ? 0 : 0.2, ease: EASE_OUT });
  };

  const measured = width > 0;
  const restText = error ? errorLabel : label;

  return (
    <div
      ref={track}
      data-state={state}
      className={cn(
        "relative w-[320px] max-w-full overflow-clip rounded-md text-sm font-medium select-none",
        // Keyboard focus rings the whole track: a ring on the thumb would vanish against the ink.
        "has-[[role=slider]:focus-visible]:outline-solid has-[[role=slider]:focus-visible]:outline-2 has-[[role=slider]:focus-visible]:outline-offset-2 has-[[role=slider]:focus-visible]:outline-ring/50",
        // A recessed track, so the thumb reads as something raised you can push.
        "border border-black/[0.08] bg-black/[0.035] shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] dark:border-white/[0.08] dark:bg-white/[0.04] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]",
        disabled && "opacity-50",
        className,
      )}
      style={{ height: HEIGHT }}
    >
      {/* The resting label, centred in the room right of the thumb. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 grid place-items-center text-muted-foreground"
        style={{ left: THUMB + INSET * 2 }}
      >
        <AnimatePresence initial={false}>
          {!busy && (
            <Swap key={restText} reduce={reduce} className={cn("whitespace-nowrap", error && "text-red-600 dark:text-red-400")}>
              {restText}
            </Swap>
          )}
        </AnimatePresence>
      </span>

      {measured && (
        <motion.div
          aria-hidden
          style={{ clipPath: fillClip, opacity: fillOpacity }}
          className="pointer-events-none absolute inset-0 bg-primary bg-[linear-gradient(to_bottom,rgba(255,255,255,0.08),rgba(255,255,255,0)_60%)] dark:bg-[linear-gradient(to_bottom,rgba(255,255,255,0),rgba(0,0,0,0.06))]"
        >
          {/* The same label in white, revealed only where the ink has passed. */}
          <span
            className="absolute inset-y-0 right-0 grid place-items-center text-primary-foreground"
            style={{ left: THUMB + INSET * 2 }}
          >
            <AnimatePresence initial={false}>
              {!busy && (
                <Swap key={restText} reduce={reduce} className="whitespace-nowrap">
                  {restText}
                </Swap>
              )}
            </AnimatePresence>
          </span>
        </motion.div>
      )}

      {/* While working and once done, the label centres in the ink left of the thumb. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 grid place-items-center text-primary-foreground"
        style={{ right: THUMB + INSET * 2 }}
      >
        <AnimatePresence initial={false}>
          {state === "pending" && (
            <Swap key="pending" reduce={reduce} className="whitespace-nowrap">
              {pendingLabel}
            </Swap>
          )}
          {state === "done" && (
            <Swap key="done" reduce={reduce} className="whitespace-nowrap">
              {doneLabel}
            </Swap>
          )}
        </AnimatePresence>
      </span>

      <motion.button
        type="button"
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={state === "pending" ? pendingLabel : state === "done" ? doneLabel : `${value}%`}
        aria-disabled={disabled || busy}
        disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        onContextMenu={(event) => event.preventDefault()}
        style={{ x, width: THUMB, top: INSET, bottom: INSET, left: INSET }}
        className={cn(
          "group absolute grid touch-none place-items-center rounded-[4px] bg-background text-foreground",
          // Raised: a lit top edge and a soft, close shadow.
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_0_0_1px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.1),0_3px_8px_-2px_rgba(0,0,0,0.14)] dark:bg-zinc-800 dark:text-zinc-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(255,255,255,0.1),0_1px_2px_rgba(0,0,0,0.6)]",
          "transition-shadow duration-150 focus-visible:outline-none",
          busy ? "cursor-default" : state === "dragging" ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        {/* One slot for the arrow, the spinner and the check. */}
        <span className="grid size-4 place-items-center">
          <AnimatePresence initial={false}>
            {!busy && (
              <Swap key="arrow" reduce={reduce} className="grid place-items-center">
                <ArrowRight className="size-4 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5" />
              </Swap>
            )}
            {state === "pending" && (
              <Swap key="spinner" reduce={reduce} className="grid place-items-center">
                <Loader2 className="size-4 animate-spin [animation-duration:700ms]" />
              </Swap>
            )}
            {state === "done" && (
              <Swap key="check" reduce={reduce} className="grid place-items-center">
                <motion.span
                  className="grid place-items-center"
                  initial={reduce ? false : { scale: 0.4, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 24 }}
                >
                  <Check className="size-4" strokeWidth={2.5} />
                </motion.span>
              </Swap>
            )}
          </AnimatePresence>
        </span>
      </motion.button>

      <span className="sr-only" aria-live="polite">
        {state === "pending" ? pendingLabel : state === "done" ? doneLabel : error ? errorLabel : ""}
      </span>
    </div>
  );
}

export { SlideToConfirm, type SlideToConfirmProps };
