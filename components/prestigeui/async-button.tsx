"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type AsyncButtonState = "idle" | "loading" | "success";

type AsyncButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  action?: () => Promise<void>;
  loadingDelay?: number;
  successDuration?: number;
};

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

function Swap({
  children,
  reduceMotion,
}: {
  children: React.ReactNode;
  reduceMotion: boolean;
}) {
  return (
    <motion.span
      initial={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, filter: "blur(2px)", transform: "translateY(4px)" }
      }
      animate={
        reduceMotion
          ? { opacity: 1 }
          : { opacity: 1, filter: "blur(0px)", transform: "translateY(0px)" }
      }
      exit={
        reduceMotion
          ? { opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }
          : {
              opacity: 0,
              filter: "blur(2px)",
              transform: "translateY(-4px)",
              transition: { duration: 0.12, ease: EASE_OUT },
            }
      }
      transition={{ duration: 0.18, ease: EASE_OUT }}
      className="absolute inset-0 flex items-center justify-center"
    >
      {children}
    </motion.span>
  );
}

const AsyncButton = React.forwardRef<HTMLButtonElement, AsyncButtonProps>(
  (
    {
      children,
      className,
      action,
      loadingDelay = 200,
      successDuration = 1500,
      disabled,
      onClick,
      ...props
    },
    ref,
  ) => {
    const [state, setState] = React.useState<AsyncButtonState>("idle");
    const [pending, setPending] = React.useState(false);
    const reduceMotion = Boolean(useReducedMotion());
    const generation = React.useRef(0);
    const timers = React.useRef<number[]>([]);

    const clearTimers = React.useCallback(() => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    }, []);

    React.useEffect(() => {
      return () => {
        generation.current += 1;
        clearTimers();
      };
    }, [clearTimers]);

    const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (event.defaultPrevented || !action || disabled || pending || state !== "idle") {
        return;
      }

      const gen = generation.current;
      setPending(true);

      const loadingTimer = window.setTimeout(() => {
        if (generation.current === gen) setState("loading");
      }, loadingDelay);
      timers.current.push(loadingTimer);

      try {
        await action();
        if (generation.current !== gen) return;
        window.clearTimeout(loadingTimer);
        setState("success");
        const idleTimer = window.setTimeout(() => {
          if (generation.current !== gen) return;
          setState("idle");
          setPending(false);
        }, successDuration);
        timers.current.push(idleTimer);
      } catch {
        if (generation.current !== gen) return;
        window.clearTimeout(loadingTimer);
        setState("idle");
        setPending(false);
      }
    };

    const busy = pending || state !== "idle";

    return (
      <button
        ref={ref}
        disabled={Boolean(disabled) || busy}
        onClick={handleClick}
        aria-busy={state === "loading"}
        aria-live="polite"
        data-state={state}
        className={cn(
          "relative inline-flex h-11 cursor-pointer items-center justify-center overflow-hidden rounded-md bg-primary px-6 font-medium text-primary-foreground",
          "transition-[transform,background-color] duration-[160ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
          "hover:bg-primary/90 active:scale-[0.97]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:pointer-events-none",
          disabled && "opacity-50",
          className,
        )}
        {...props}
      >
        <span className="invisible inline-flex items-center justify-center whitespace-nowrap" aria-hidden>
          {children}
        </span>
        <span className="sr-only">
          {state === "loading" ? "Loading" : state === "success" ? "Done" : null}
        </span>
        <AnimatePresence initial={false}>
          {state === "idle" && (
            <Swap key="idle" reduceMotion={reduceMotion}>
              {children}
            </Swap>
          )}
          {state === "loading" && (
            <Swap key="loading" reduceMotion={reduceMotion}>
              <Loader2 className="size-4 animate-spin [animation-duration:700ms]" />
            </Swap>
          )}
          {state === "success" && (
            <Swap key="success" reduceMotion={reduceMotion}>
              <Check className="size-4" strokeWidth={2.5} />
            </Swap>
          )}
        </AnimatePresence>
      </button>
    );
  },
);
AsyncButton.displayName = "AsyncButton";

export { AsyncButton, type AsyncButtonProps };
