"use client";

import * as React from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
  type MotionValue,
} from "motion/react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type HoldState = "idle" | "holding" | "pending" | "done";

type HoldToConfirmProps = {
  /** Runs once the hold completes. Reject to show the error label. */
  action?: () => Promise<void>;
  /** The resting label. */
  label?: string;
  /** Shown briefly after a click or a hold released too early. */
  hintLabel?: string;
  pendingLabel?: string;
  doneLabel?: string;
  errorLabel?: string;
  /** How long to hold, in milliseconds. */
  holdDuration?: number;
  /** Return to idle this many milliseconds after finishing. Leave unset to stay done. */
  resetAfter?: number;
  disabled?: boolean;
  className?: string;
};

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

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

/** A trash can whose lid lifts on its hinge as the hold progresses. */
function TrashIcon({ lid }: { lid: MotionValue<number> }) {
  return (
    <svg viewBox="0 0 16 16" className="size-4 overflow-visible" fill="none" aria-hidden>
      <motion.g style={{ rotate: lid, originX: 0, originY: 1 }}>
        <path d="M2 4.5h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path
          d="M6 4.5V3.25c0-.41.34-.75.75-.75h2.5c.41 0 .75.34.75.75V4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </motion.g>
      <path
        d="M3.5 6.5l.6 6.6c.07.77.71 1.4 1.49 1.4h4.82c.78 0 1.42-.63 1.49-1.4l.6-6.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6.75 8.5v3.5M9.25 8.5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function HoldToConfirm({
  action,
  label = "Hold to delete",
  hintLabel = "Keep holding",
  pendingLabel = "Deleting",
  doneLabel = "Deleted",
  errorLabel = "Couldn't delete",
  holdDuration = 1200,
  resetAfter,
  disabled,
  className,
}: HoldToConfirmProps) {
  const [state, setState] = React.useState<HoldState>("idle");
  const [note, setNote] = React.useState<"hint" | "error" | null>(null);
  const reduce = Boolean(useReducedMotion());
  const progress = useMotionValue(0);
  // 1 slams the lid shut at the end, whatever the progress.
  const shut = useMotionValue(0);
  // The lid opens up to 34 degrees, so a full hold reads as an open can.
  const lid = useTransform<number, number>([progress, shut], ([p, s]) => -34 * p * (1 - s));
  const run = React.useRef<AnimationPlaybackControls | null>(null);
  const timer = React.useRef<number | undefined>(undefined);
  const mounted = React.useRef(true);
  const descriptionId = React.useId();

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      run.current?.stop();
      window.clearTimeout(timer.current);
    };
  }, []);

  const showNote = (kind: "hint" | "error") => {
    setNote(kind);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => mounted.current && setNote(null), 1600);
  };

  const finish = async () => {
    run.current = null;
    setNote(null);
    // The lid slams shut first; the button turns solid as it lands.
    await animate(shut, 1, { duration: reduce ? 0 : 0.16, ease: [0.55, 0, 1, 0.45] });
    if (!mounted.current) return;
    if ("vibrate" in navigator) navigator.vibrate?.(12);
    setState("pending");
    try {
      await action?.();
      if (!mounted.current) return;
      setState("done");
      if (resetAfter !== undefined) {
        timer.current = window.setTimeout(() => {
          if (!mounted.current) return;
          setState("idle");
          animate(progress, 0, { duration: 0.3, ease: EASE_OUT });
        }, resetAfter);
      }
    } catch {
      if (!mounted.current) return;
      setState("idle");
      animate(progress, 0, { duration: 0.3, ease: EASE_OUT });
      showNote("error");
    }
  };

  const start = () => {
    if (disabled || (state !== "idle" && state !== "holding")) return;
    setState("holding");
    setNote(null);
    shut.set(0);
    run.current?.stop();
    const remaining = holdDuration * (1 - progress.get());
    // Progress is time, so it moves at a constant rate.
    run.current = animate(progress, 1, {
      duration: remaining / 1000,
      ease: "linear",
      onComplete: () => {
        if (mounted.current) void finish();
      },
    });
  };

  const release = () => {
    if (state !== "holding" || !run.current) return;
    run.current.stop();
    run.current = null;
    // A tap or an early release teaches the gesture instead of doing nothing.
    if (progress.get() < 0.6) showNote("hint");
    setState("idle");
    animate(progress, 0, { duration: reduce ? 0 : 0.35, ease: EASE_OUT });
  };

  const solid = state === "pending" || state === "done";
  const idleText = note === "hint" ? hintLabel : note === "error" ? errorLabel : label;


  return (
    <button
      type="button"
      disabled={disabled}
      aria-describedby={descriptionId}
      data-state={state}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        start();
      }}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onKeyDown={(event) => {
        if ((event.key === " " || event.key === "Enter") && !event.repeat) {
          event.preventDefault();
          start();
        }
      }}
      onKeyUp={(event) => {
        if (event.key === " " || event.key === "Enter") release();
      }}
      onBlur={release}
      onContextMenu={(event) => event.preventDefault()}
      className={cn(
        // One deep red, set once: calm enough to sit in a settings page, still
        // unmistakably destructive.
        // The solid state is a shade deeper so white text keeps 4.5:1 contrast.
        "[--danger:#d4463e] [--danger-solid:#c4403a] [--danger-text:#c2372f] dark:[--danger:#e0625a] dark:[--danger-solid:#b9453d] dark:[--danger-text:#f08a82]",
        "relative inline-flex h-11 cursor-pointer touch-manipulation items-center justify-center overflow-clip rounded-md px-5 text-sm font-medium select-none [-webkit-touch-callout:none]",
        "transition-[background-color,border-color,color,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--danger)_45%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
        solid
          ? "border border-[color-mix(in_oklab,var(--danger-solid)_82%,black)] bg-[var(--danger-solid)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.16),0_6px_14px_-6px_rgba(0,0,0,0.28)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-1px_0_rgba(0,0,0,0.2)]"
          : "border border-[color-mix(in_oklab,var(--danger)_32%,transparent)] bg-background text-[var(--danger-text)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-[color-mix(in_oklab,var(--danger)_48%,transparent)] hover:bg-[color-mix(in_oklab,var(--danger)_4%,transparent)]",
        className,
      )}
    >
      {/* The fill that rises with the hold. */}
      <motion.span
        aria-hidden
        style={{ scaleX: progress }}
        className={cn(
          "pointer-events-none absolute inset-0 origin-left bg-[color-mix(in_oklab,var(--danger)_13%,transparent)] dark:bg-[color-mix(in_oklab,var(--danger)_18%,transparent)]",
          solid && "opacity-0",
        )}
      />

      <span className="relative grid">
        {/* Invisible copies of every state size the button, so it never resizes. */}
        {[label, hintLabel, errorLabel, pendingLabel, doneLabel].map((text) => (
          <span
            key={text}
            aria-hidden
            className="invisible col-start-1 row-start-1 flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <span className="size-4" />
            {text}
          </span>
        ))}

        {/* Each state is its own centred icon-and-label unit. */}
        <AnimatePresence initial={false}>
          {(state === "idle" || state === "holding") && (
            <Swap key="idle" reduce={reduce} className="flex items-center justify-center gap-2">
              <span className="grid size-4 place-items-center">
                <TrashIcon lid={lid} />
              </span>
              {/* The hint and the error swap in place, starting where the label
                  starts, so the trash can never moves. The space is sized to the
                  resting label, which keeps the resting state centred. */}
              <span className="relative whitespace-nowrap">
                <span aria-hidden className="invisible">
                  {label}
                </span>
                <AnimatePresence initial={false}>
                  <Swap key={idleText} reduce={reduce} className="absolute top-0 left-0 whitespace-nowrap">
                    {idleText}
                  </Swap>
                </AnimatePresence>
              </span>
            </Swap>
          )}
          {state === "pending" && (
            <Swap key="pending" reduce={reduce} className="flex items-center justify-center gap-2 whitespace-nowrap">
              <span className="grid size-4 place-items-center">
                <Loader2 className="size-4 animate-spin [animation-duration:700ms]" />
              </span>
              {pendingLabel}
            </Swap>
          )}
          {state === "done" && (
            <Swap key="done" reduce={reduce} className="flex items-center justify-center gap-2 whitespace-nowrap">
              <motion.span
                className="grid size-4 place-items-center"
                initial={reduce ? false : { scale: 0.4, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 24 }}
              >
                <Check className="size-4" strokeWidth={2.5} />
              </motion.span>
              {doneLabel}
            </Swap>
          )}
        </AnimatePresence>
      </span>

      <span id={descriptionId} className="sr-only">
        {`Press and hold for ${(holdDuration / 1000).toFixed(1)} seconds to confirm.`}
      </span>
      <span className="sr-only" aria-live="polite">
        {state === "pending" ? pendingLabel : state === "done" ? doneLabel : note === "error" ? errorLabel : ""}
      </span>
    </button>
  );
}

export { HoldToConfirm, type HoldToConfirmProps };
