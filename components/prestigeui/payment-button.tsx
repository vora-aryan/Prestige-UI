"use client";

import * as React from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type HTMLMotionProps,
} from "motion/react";
import { CircleAlert, Check, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type PaymentButtonState = "idle" | "processing" | "paid" | "failed";

type PaymentButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  /** The amount shown after the label, already formatted. */
  amount?: string;
  /** The action word before the amount. */
  label?: string;
  /** Charges the customer. Resolve when paid, reject when the payment fails. */
  action?: () => Promise<void>;
  processingLabel?: string;
  paidLabel?: string;
  failedLabel?: string;
  /** How long the failed state stays before the button can be tried again. */
  failedDuration?: number;
  /** Return to idle this many milliseconds after paying. Leave unset to stay paid. */
  resetAfter?: number;
};

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

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

const slot =
  "invisible col-start-1 row-start-1 flex items-center justify-center gap-2 whitespace-nowrap";

const PaymentButton = React.forwardRef<HTMLButtonElement, PaymentButtonProps>(
  (
    {
      amount = "$49.00",
      label = "Pay",
      action,
      processingLabel = "Processing",
      paidLabel = "Paid",
      failedLabel = "Payment failed",
      failedDuration = 1800,
      resetAfter,
      className,
      disabled,
      onClick,
      ...props
    },
    ref,
  ) => {
    const [state, setState] = React.useState<PaymentButtonState>("idle");
    const [attempt, setAttempt] = React.useState(0);
    const reduceMotion = Boolean(useReducedMotion());
    const generation = React.useRef(0);
    const timer = React.useRef<number | undefined>(undefined);

    React.useEffect(() => {
      return () => {
        generation.current += 1;
        window.clearTimeout(timer.current);
      };
    }, []);

    const settle = (gen: number, next: PaymentButtonState, after?: number) => {
      setState(next);
      if (after === undefined) return;
      timer.current = window.setTimeout(() => {
        if (generation.current === gen) setState("idle");
      }, after);
    };

    const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (event.defaultPrevented || !action || disabled || state !== "idle") return;

      const gen = ++generation.current;
      setState("processing");
      try {
        await action();
        if (generation.current === gen) settle(gen, "paid", resetAfter);
      } catch {
        if (generation.current !== gen) return;
        setAttempt((n) => n + 1);
        settle(gen, "failed", failedDuration);
      }
    };

    const idle = (
      <>
        <Lock aria-hidden className="size-4 opacity-70" strokeWidth={2.25} />
        <span>
          {label} <span className="tabular-nums">{amount}</span>
        </span>
      </>
    );
    const processing = (
      <>
        <Loader2 aria-hidden className="size-4 animate-spin [animation-duration:700ms]" />
        {processingLabel}
      </>
    );
    const paid = (
      <>
        <Check aria-hidden className="size-4" strokeWidth={2.5} />
        {paidLabel}
      </>
    );
    const failed = (
      <>
        <CircleAlert aria-hidden className="size-4" strokeWidth={2.25} />
        {failedLabel}
      </>
    );

    return (
      <motion.button
        ref={ref}
        type="button"
        disabled={Boolean(disabled) || state !== "idle"}
        onClick={handleClick}
        aria-busy={state === "processing"}
        data-state={state}
        // One small shake per failed attempt; nothing under reduced motion.
        animate={
          state === "failed" && !reduceMotion
            ? { x: [0, -4, 4, -3, 3, 0], transition: { duration: 0.36, ease: "easeOut" } }
            : { x: 0 }
        }
        className={cn(
          "relative inline-flex h-12 w-full max-w-[280px] cursor-pointer items-center justify-center overflow-hidden rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground",
          "transition-[background-color,transform,scale] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-primary/90 active:scale-[0.98]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:pointer-events-none data-[state=idle]:disabled:opacity-50",
          className,
        )}
        {...props}
      >
        <span className="grid">
          {/* Every state sits in the same cell, so the button never resizes. */}
          <span aria-hidden className={slot}>{idle}</span>
          <span aria-hidden className={slot}>{processing}</span>
          <span aria-hidden className={slot}>{paid}</span>
          <span aria-hidden className={slot}>{failed}</span>

          <AnimatePresence initial={false}>
            {state === "idle" && (
              <Swap key="idle" reduceMotion={reduceMotion}>
                {idle}
              </Swap>
            )}
            {state === "processing" && (
              <Swap key="processing" reduceMotion={reduceMotion}>
                {processing}
              </Swap>
            )}
            {state === "paid" && (
              <Swap key="paid" reduceMotion={reduceMotion}>
                {paid}
              </Swap>
            )}
            {state === "failed" && (
              <Swap key={`failed-${attempt}`} reduceMotion={reduceMotion}>
                {failed}
              </Swap>
            )}
          </AnimatePresence>
        </span>

        <span className="sr-only" aria-live="polite">
          {state === "processing"
            ? processingLabel
            : state === "paid"
              ? paidLabel
              : state === "failed"
                ? failedLabel
                : ""}
        </span>
      </motion.button>
    );
  },
);
PaymentButton.displayName = "PaymentButton";

export { PaymentButton, type PaymentButtonProps };
