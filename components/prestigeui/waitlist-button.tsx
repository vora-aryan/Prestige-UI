"use client";

import * as React from "react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type WaitlistState = "idle" | "open" | "sending" | "done";

type WaitlistResult = void | { position?: number };

type WaitlistButtonProps = {
  /**
   * Saves the email. Resolve when it is stored, optionally with the person's
   * place in line; reject to show an error and keep the field open.
   */
  action?: (email: string) => Promise<WaitlistResult>;
  /** The button label before it opens. */
  label?: string;
  /** The submit button inside the open field. */
  submitLabel?: string;
  placeholder?: string;
  /** Shown across the field when the action returns no position. */
  successLabel?: string;
  /** The line under the field once the email is saved. */
  successMessage?: (email: string) => string;
  invalidMessage?: string;
  errorMessage?: string;
  className?: string;
};

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
// Opening and closing is travel, not an entrance: an even in-out curve, so
// the shape doesn't snap most of the way in the first frames.
const TRAVEL = [0.65, 0, 0.35, 1] as const;
const HEIGHT = 44;
const INSET = 4;
const ICON = 16;
const IDLE_PAD = 20;
const SUBMIT_PAD = 14;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Digits roll up into place, left to right, like an odometer. */
function Odometer({ value, delay, reduce }: { value: number; delay: number; reduce: boolean }) {
  const chars = value.toLocaleString("en-US").split("");
  let digit = 0;
  return (
    <span className="inline-flex tabular-nums" aria-hidden>
      {chars.map((char, index) => {
        if (!/\d/.test(char)) {
          return (
            <span key={index} className="inline-block">
              {char}
            </span>
          );
        }
        const n = Number(char);
        const order = digit++;
        return (
          <span key={index} className="relative inline-block h-[1em] overflow-clip">
            <motion.span
              className="flex flex-col"
              initial={reduce ? false : { y: "0em" }}
              animate={{ y: `-${n}em` }}
              transition={{ duration: 0.9, delay: delay + order * 0.07, ease: EASE_OUT }}
            >
              {Array.from({ length: 10 }, (_, d) => (
                <span key={d} className="block h-[1em] leading-none">
                  {d}
                </span>
              ))}
            </motion.span>
          </span>
        );
      })}
    </span>
  );
}

const WaitlistButton = React.forwardRef<HTMLDivElement, WaitlistButtonProps>(
  (
    {
      action,
      label = "Join the waitlist",
      submitLabel = "Join",
      placeholder = "you@company.com",
      successLabel = "You're on the list",
      successMessage = (email) => `We'll email ${email} when your spot opens.`,
      invalidMessage = "Enter a valid email address.",
      errorMessage = "Couldn't save that. Try again.",
      className,
    },
    ref,
  ) => {
    const [state, setState] = React.useState<WaitlistState>("idle");
    const [email, setEmail] = React.useState("");
    const [position, setPosition] = React.useState<number | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [hover, setHover] = React.useState(false);
    const [size, setSize] = React.useState({ box: 0, idle: 0, submit: 0 });
    const reduce = Boolean(useReducedMotion());
    const [scope, animate] = useAnimate<HTMLDivElement>();
    const box = React.useRef<HTMLDivElement>(null);
    const idleButton = React.useRef<HTMLButtonElement>(null);
    const submitButton = React.useRef<HTMLButtonElement>(null);
    const input = React.useRef<HTMLInputElement>(null);
    const mounted = React.useRef(true);
    const inputId = React.useId();
    const messageId = React.useId();

    React.useImperativeHandle(ref, () => scope.current, [scope]);

    React.useEffect(() => {
      mounted.current = true;
      return () => {
        mounted.current = false;
      };
    }, []);

    // Every shape below is drawn from the real widths of the box and labels.
    React.useEffect(() => {
      const measure = () =>
        setSize({
          box: box.current?.offsetWidth ?? 0,
          idle: idleButton.current?.offsetWidth ?? 0,
          submit: submitButton.current?.offsetWidth ?? 0,
        });
      measure();
      const observer = new ResizeObserver(measure);
      [box, idleButton, submitButton].forEach((r) => r.current && observer.observe(r.current));
      return () => observer.disconnect();
    }, []);

    React.useEffect(() => {
      if (state === "open") input.current?.focus({ preventScroll: true });
    }, [state]);

    const measured = size.box > 0 && size.idle > 0 && size.submit > 0;
    const side = Math.max(0, (size.box - size.idle) / 2);
    const submitLeft = Math.max(0, size.box - INSET - size.submit);
    const idleClip = `inset(0px ${side}px 0px ${side}px round 6px)`;
    const fullClip = "inset(0px 0px 0px 0px round 6px)";
    const submitClip = `inset(${INSET}px ${INSET}px ${INSET}px ${submitLeft}px round 4px)`;
    const open = state === "open" || state === "sending";

    const inkClip = state === "idle" ? idleClip : state === "done" ? fullClip : submitClip;
    // The arrow keeps the same distance from the ink's right edge the whole
    // way, so it rides on the ink instead of crossing the field.
    const arrowX =
      state === "idle" ? side + size.idle - IDLE_PAD - ICON : size.box - INSET - SUBMIT_PAD - ICON;
    const travel = { duration: reduce ? 0 : 0.55, ease: TRAVEL };

    const shake = () => {
      if (reduce || !scope.current) return;
      animate(scope.current, { x: [0, -4, 4, -3, 3, 0] }, { duration: 0.36, ease: "easeOut" });
    };

    const close = () => {
      setError(null);
      setState("idle");
      requestAnimationFrame(() => idleButton.current?.focus({ preventScroll: true }));
    };

    const submit = async (event: React.FormEvent) => {
      event.preventDefault();
      if (state !== "open") return;
      const value = email.trim();
      if (!EMAIL.test(value)) {
        setError(invalidMessage);
        shake();
        input.current?.focus();
        return;
      }
      setError(null);
      setState("sending");
      try {
        const result = await action?.(value);
        if (!mounted.current) return;
        setEmail(value);
        setPosition(result && typeof result.position === "number" ? result.position : null);
        setState("done");
      } catch {
        if (!mounted.current) return;
        setError(errorMessage);
        setState("open");
        shake();
      }
    };

    const fade = (visible: boolean, delay = 0) => ({
      opacity: visible ? 1 : 0,
      transition: visible
        ? { duration: 0.24, delay: reduce ? 0 : delay, ease: EASE_OUT }
        : { duration: 0.12, ease: EASE_OUT },
    });

    return (
      <div ref={scope} className={cn("w-[360px] max-w-full", className)}>
        <form
          noValidate
          onSubmit={submit}
          onKeyDown={(event) => {
            if (event.key === "Escape" && open && state !== "sending") close();
          }}
          onBlur={(event) => {
            // Leaving an empty field folds it back into the button.
            const next = event.relatedTarget as Node | null;
            if (state === "open" && !email.trim() && !event.currentTarget.contains(next)) {
              setError(null);
              setState("idle");
            }
          }}
        >
          <div
            ref={box}
            data-hover={hover && state === "idle"}
            className="group relative text-sm font-medium transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] has-[[data-slot=idle]:active]:scale-[0.98]"
            style={{ height: HEIGHT }}
          >
            {/* The layers mount once their real shape is known, so the first
                frame is already the finished button: nothing animates in. */}
            {measured && (
              <>
                {/* The field, opening out of the button's own shape. */}
                <div className="absolute inset-0 [filter:drop-shadow(0_1px_1px_rgba(0,0,0,0.04))]">
                  <motion.div
                    aria-hidden
                    initial={false}
                    animate={{ clipPath: state === "idle" ? idleClip : fullClip }}
                    transition={travel}
                    className="absolute inset-0 rounded-md bg-background shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]"
                  />
                </div>
                {/* Its outline is drawn, not clipped, so every frame shows a
                    whole rounded border instead of two loose hairlines. */}
                <svg
                  aria-hidden
                  width={size.box}
                  height={HEIGHT}
                  className="pointer-events-none absolute inset-0 overflow-visible"
                >
                  <motion.rect
                    initial={false}
                    animate={{
                      x: state === "idle" ? side + 0.5 : 0.5,
                      width: state === "idle" ? Math.max(0, size.idle - 1) : size.box - 1,
                    }}
                    transition={travel}
                    y={0.5}
                    height={HEIGHT - 1}
                    rx={5.5}
                    fill="none"
                    strokeWidth={1}
                    className={cn(
                      "transition-[stroke] duration-150",
                      error
                        ? "stroke-red-500/60 dark:stroke-red-400/60"
                        : "stroke-black/[0.12] group-has-[input:focus]:stroke-black/30 dark:stroke-white/[0.14] dark:group-has-[input:focus]:stroke-white/35",
                    )}
                  />
                </svg>
              </>
            )}

            <motion.input
              ref={input}
              id={inputId}
              type="email"
              name="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              placeholder={placeholder}
              aria-label="Email address"
              aria-invalid={Boolean(error)}
              aria-describedby={messageId}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (error) setError(null);
              }}
              disabled={!open}
              tabIndex={open ? 0 : -1}
              initial={false}
              animate={fade(open, 0.28)}
              className="absolute inset-y-0 left-0 w-full bg-transparent pl-3.5 text-sm font-normal text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-default"
              style={{ paddingRight: size.submit + INSET * 2 + 8 }}
            />

            {measured && (
              // The drop shadow sits on a wrapper, so it follows the clipped shape.
              <div className="pointer-events-none absolute inset-0 [filter:drop-shadow(0_1px_1px_rgba(0,0,0,0.14))_drop-shadow(0_6px_12px_rgba(0,0,0,0.12))] dark:[filter:none]">
                <motion.div
                  aria-hidden
                  initial={false}
                  animate={{ clipPath: inkClip }}
                  transition={travel}
                  className="absolute inset-0 rounded-md bg-primary bg-[linear-gradient(to_bottom,rgba(255,255,255,0.10),rgba(255,255,255,0)_55%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-1px_0_rgba(0,0,0,0.3)] dark:bg-[linear-gradient(to_bottom,rgba(255,255,255,0),rgba(0,0,0,0.06))] dark:shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)]"
                />
              </div>
            )}

            <motion.button
              ref={idleButton}
              type="button"
              data-slot="idle"
              aria-expanded={open}
              aria-controls={inputId}
              onClick={() => state === "idle" && setState("open")}
              onPointerEnter={(event) => event.pointerType === "mouse" && setHover(true)}
              onPointerLeave={() => setHover(false)}
              tabIndex={state === "idle" ? 0 : -1}
              initial={false}
              animate={fade(state === "idle", 0.32)}
              className={cn(
                "absolute inset-y-0 left-1/2 flex -translate-x-1/2 cursor-pointer items-center gap-2 whitespace-nowrap rounded-md text-primary-foreground transition-colors duration-150",
                "hover:bg-primary-foreground/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                // Until the widths are known the button paints its own ink and
                // arrow, so the very first paint already looks finished.
                !measured && "bg-primary",
                state !== "idle" && "pointer-events-none",
              )}
              style={{ paddingInline: IDLE_PAD }}
            >
              {label}
              {measured ? (
                <span aria-hidden className="inline-block" style={{ width: ICON }} />
              ) : (
                <ArrowRight aria-hidden className="size-4" />
              )}
            </motion.button>

            <motion.button
              ref={submitButton}
              type="submit"
              tabIndex={open ? 0 : -1}
              disabled={state !== "open"}
              initial={false}
              animate={fade(open, 0.44)}
              className={cn(
                "absolute top-1 right-1 bottom-1 flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[4px] text-primary-foreground transition-colors duration-150",
                "hover:bg-primary-foreground/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                !open && "pointer-events-none",
              )}
              style={{ paddingInline: SUBMIT_PAD }}
            >
              {submitLabel}
              <span aria-hidden className="inline-block" style={{ width: ICON }} />
            </motion.button>

            {/* One arrow for the whole journey: on the button, then riding the
                ink into the submit button, then turning into the spinner. */}
            {measured && (
              <motion.span
                aria-hidden
                initial={false}
                animate={{ x: arrowX, opacity: state === "done" ? 0 : 1 }}
                transition={{ x: travel, opacity: { duration: 0.15, ease: EASE_OUT } }}
                className="pointer-events-none absolute top-1/2 left-0 -mt-2 grid size-4 text-primary-foreground"
              >
                <motion.span
                  className="col-start-1 row-start-1 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] [[data-hover=true]_&]:translate-x-0.5"
                  animate={{ opacity: state === "sending" ? 0 : 1, scale: state === "sending" ? 0.6 : 1 }}
                  transition={{ duration: 0.18, ease: EASE_OUT }}
                >
                  <ArrowRight className="size-4" />
                </motion.span>
                <motion.span
                  className="col-start-1 row-start-1"
                  initial={false}
                  animate={{ opacity: state === "sending" ? 1 : 0, scale: state === "sending" ? 1 : 0.6 }}
                  transition={{ duration: 0.18, ease: EASE_OUT }}
                >
                  <Loader2 className="size-4 animate-spin [animation-duration:700ms]" />
                </motion.span>
              </motion.span>
            )}

            <motion.div
              aria-hidden={state !== "done"}
              initial={false}
              animate={fade(state === "done", 0.34)}
              className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-primary-foreground"
            >
              <motion.span
                initial={false}
                animate={state === "done" ? { scale: 1, rotate: 0 } : { scale: 0.4, rotate: -30 }}
                transition={
                  state === "done" && !reduce
                    ? { type: "spring", stiffness: 420, damping: 24, delay: 0.38 }
                    : { duration: 0 }
                }
              >
                <Check aria-hidden className="size-4" strokeWidth={2.5} />
              </motion.span>
              {state === "done" && position !== null ? (
                <span className="flex items-center gap-[0.3em] leading-none">
                  You&apos;re
                  <span className="inline-flex">
                    #<Odometer value={position} delay={0.45} reduce={reduce} />
                  </span>
                  in line
                  <span className="sr-only">{`You're number ${position} in line`}</span>
                </span>
              ) : (
                successLabel
              )}
            </motion.div>
          </div>

          {/* One reserved line for the error or the follow-up, so nothing below moves. */}
          <div id={messageId} aria-live="polite" className="relative mt-2.5 h-5 text-center text-[13px] leading-5">
            <AnimatePresence initial={false}>
              {error && state !== "done" && (
                <motion.p
                  key={error}
                  initial={{ opacity: 0, y: reduce ? 0 : -2 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE_OUT } }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  className="absolute inset-x-0 text-red-600 dark:text-red-400"
                >
                  {error}
                </motion.p>
              )}
              {state === "done" && (
                <motion.p
                  key="done"
                  initial={{ opacity: 0, y: reduce ? 0 : -2 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.3, delay: reduce ? 0 : 0.9, ease: EASE_OUT },
                  }}
                  className="absolute inset-x-0 truncate text-muted-foreground"
                >
                  {successMessage(email)}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </form>
      </div>
    );
  },
);
WaitlistButton.displayName = "WaitlistButton";

export { WaitlistButton, type WaitlistButtonProps, type WaitlistResult };
