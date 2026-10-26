"use client";

import * as React from "react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { AtSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/prestigeui/prestige-brand";

/** Strong ease-out: responds at once, lands softly. */
export const EASE = [0.16, 1, 0.3, 1] as const;

/** One accent for meaning only (focus, success). Retint via --auth-accent. */
export const accentVars =
  "[--auth-accent:#2f6bff] dark:[--auth-accent:#5b8bff]";

export const ring =
  "outline-none focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_oklab,var(--auth-accent)_30%,transparent)]";

// Placeholder links ("#") stay put instead of jumping or changing the URL.
export const preventPlaceholder = (
  event: React.MouseEvent<HTMLAnchorElement>,
) => {
  if (event.currentTarget.getAttribute("href") === "#") event.preventDefault();
};

export const wait = (ms: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ------------------------------------------------------------------ */
/*  Handlers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Throw from a handler to show a message on the form, next to one field:
 * `throw new AuthError("Wrong email or password.", { field: "password" })`.
 * Any other error shows a generic line, so raw server or network messages
 * never reach the person signing in.
 */
export class AuthError extends Error {
  readonly field?: string;
  constructor(message: string, options?: { field?: string }) {
    super(message);
    this.name = "AuthError";
    this.field = options?.field;
  }
}

/** The message and field to show for a failed handler. */
export function failureOf(error: unknown): { message: string; field?: string } {
  if (error instanceof AuthError) return { message: error.message, field: error.field };
  console.error(error);
  return { message: "Something went wrong. Try again." };
}

/**
 * In development, names the handlers a block was rendered without. Without
 * them the block never pretends to succeed: submitting shows that the
 * action isn't available.
 */
export function useMissingHandlers(component: string, handlers: Record<string, unknown>) {
  const missing = Object.keys(handlers).filter((name) => !handlers[name]).join(", ");
  React.useEffect(() => {
    if (!missing || typeof process === "undefined" || process.env.NODE_ENV === "production") return;
    console.warn(`${component}: pass ${missing} to connect it to your auth. Until then it shows that the action isn't available.`);
  }, [component, missing]);
}

/* ------------------------------------------------------------------ */
/*  Page frame                                                         */
/* ------------------------------------------------------------------ */

/**
 * The page a sign-in screen needs and nothing more: brand and one helpful
 * link on top, the form centered in the space below, and the legal line
 * right under the form. An optional panel sits beside the form as a
 * compact column, never as an empty half of the screen.
 */
export function AuthShell({
  aside,
  panel,
  children,
  className,
  width = 380,
  legal = true,
}: {
  aside?: React.ReactNode;
  /** Show the terms line under the form. Turn it off on non-entry steps. */
  legal?: boolean;
  /**
   * Optional supporting column beside the form on large screens, divided
   * by a single rule. It is only as tall as its content, so it never
   * leaves an empty field of color.
   */
  panel?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  width?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <MotionConfig reducedMotion="user">
      <section
        className={cn(
          "flex min-h-[640px] w-full flex-col bg-background font-sans text-foreground",
          accentVars,
          className,
        )}
      >
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 px-5 sm:px-8">
          <a
            href="#"
            onClick={preventPlaceholder}
            className={cn("inline-flex items-center gap-2 rounded-lg text-[14px] font-semibold tracking-[-0.02em]", ring)}
          >
            <BrandMark className="size-6" />
            Prestige UI
          </a>
          {aside ? <div className="text-[13px] text-foreground/55">{aside}</div> : null}
        </header>

        <div className="flex flex-1 items-center justify-center px-5 pt-6 pb-16 sm:px-8">
          <div
            className={cn(
              "grid w-full items-center",
              panel && "lg:grid-cols-[var(--form-width)_1px_minmax(0,320px)] lg:justify-center lg:gap-16",
            )}
            style={{ "--form-width": `${width}px`, maxWidth: panel ? undefined : width } as React.CSSProperties}
          >
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
              className="mx-auto w-full"
              style={{ maxWidth: width }}
            >
              {children}
              {legal ? (
                <p className="mt-6 text-[12px] leading-[1.6] text-foreground/45">
                  By continuing you agree to our{" "}
                  <a href="#" onClick={preventPlaceholder} className={cn("rounded-sm underline decoration-foreground/20 underline-offset-2 hover:text-foreground", ring)}>
                    Terms
                  </a>{" "}
                  and{" "}
                  <a href="#" onClick={preventPlaceholder} className={cn("rounded-sm underline decoration-foreground/20 underline-offset-2 hover:text-foreground", ring)}>
                    Privacy Policy
                  </a>
                  .
                </p>
              ) : null}
            </motion.div>

            {panel ? (
              <>
                <motion.span
                  aria-hidden
                  initial={reduce ? false : { scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
                  className="hidden w-px origin-top self-stretch bg-border lg:block"
                />
                <motion.aside
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.15, ease: EASE }}
                  className="hidden lg:block"
                >
                  {panel}
                </motion.aside>
              </>
            ) : null}
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}

/**
 * Split stage for blocks that pair the form with a live illustration. The
 * form keeps the left half; the right half is a calm tinted field that the
 * illustration fills, so it never reads as empty. Below large screens the
 * illustration steps aside and the form stands alone.
 */
export function AuthStage({
  aside,
  illustration,
  children,
  className,
  width = 380,
  legal = true,
}: {
  aside?: React.ReactNode;
  illustration: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  width?: number;
  legal?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <MotionConfig reducedMotion="user">
      <section
        className={cn(
          "grid w-full bg-background font-sans text-foreground lg:min-h-[720px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]",
          accentVars,
          className,
        )}
      >
        <div className="flex min-h-[640px] flex-col">
          <header className="flex h-16 shrink-0 items-center justify-between gap-4 px-5 sm:px-8">
            <a
              href="#"
              onClick={preventPlaceholder}
              className={cn("inline-flex items-center gap-2 rounded-lg text-[14px] font-semibold tracking-[-0.02em]", ring)}
            >
              <BrandMark className="size-6" />
              Prestige UI
            </a>
            {aside ? <div className="text-[13px] text-foreground/55">{aside}</div> : null}
          </header>
          <div className="flex flex-1 items-center justify-center px-5 pt-4 pb-14 sm:px-8">
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
              className="w-full"
              style={{ maxWidth: width }}
            >
              {children}
              {legal ? (
                <p className="mt-6 text-[12px] leading-[1.6] text-balance text-foreground/45">
                  By continuing you agree to our{" "}
                  <a href="#" onClick={preventPlaceholder} className={cn("rounded-sm underline decoration-foreground/20 underline-offset-2 hover:text-foreground", ring)}>
                    Terms
                  </a>{" "}
                  and{" "}
                  <a href="#" onClick={preventPlaceholder} className={cn("rounded-sm underline decoration-foreground/20 underline-offset-2 hover:text-foreground", ring)}>
                    Privacy Policy
                  </a>
                  .
                </p>
              ) : null}
            </motion.div>
          </div>
        </div>
        <div
          aria-hidden
          className="relative hidden items-center justify-center overflow-hidden bg-[color-mix(in_oklab,var(--foreground)_3.5%,var(--background))] p-10 lg:flex xl:p-14"
        >
          {illustration}
        </div>
      </section>
    </MotionConfig>
  );
}

export function AuthTitle({
  title,
  children,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="text-[22px] leading-[1.25] font-semibold tracking-[-0.025em] text-balance">
        {title}
      </h1>
      {children ? (
        <p className="mt-1.5 text-[14px] leading-[1.55] text-pretty text-foreground/55">
          {children}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Steps                                                              */
/* ------------------------------------------------------------------ */

const stepVariants: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction * 18,
    filter: "blur(2px)",
  }),
  center: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: { duration: 0.38, ease: EASE },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -12,
    filter: "blur(2px)",
    transition: { duration: 0.16, ease: "easeOut" },
  }),
};

/**
 * Swaps one step for the next. Content slides in the direction of travel
 * (forward from the right, back from the left) and the card's height
 * follows the new content smoothly instead of jumping.
 */
export function Steps({
  step,
  direction,
  children,
}: {
  step: string;
  direction: number;
  children: React.ReactNode;
}) {
  const innerRef = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState<number | "auto">("auto");
  const reduce = useReducedMotion();

  React.useLayoutEffect(() => {
    const node = innerRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      initial={false}
      animate={{ height }}
      transition={reduce ? { duration: 0 } : { duration: 0.42, ease: EASE }}
      className="relative -mx-2 overflow-hidden px-2"
    >
      <div ref={innerRef}>
        <AnimatePresence initial={false} mode="popLayout" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="py-0.5"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Fields                                                             */
/* ------------------------------------------------------------------ */

const inputBase =
  "h-10 w-full rounded-lg border bg-background px-3 text-[14px] text-foreground outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-foreground/35 disabled:opacity-60 dark:bg-white/[0.02]";

export const inputClass = (invalid?: boolean) =>
  cn(
    inputBase,
    invalid
      ? "border-[#d4463e]/70 shadow-[0_0_0_3px_rgba(212,70,62,0.12)] dark:border-[#f0716a]/70"
      : "border-border hover:border-foreground/20 focus:border-[var(--auth-accent)] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--auth-accent)_16%,transparent)]",
  );

/** Email input with a leading @ mark; takes every normal input prop. */
export function EmailInput({
  invalid,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <AtSign
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-foreground/40"
        strokeWidth={2}
      />
      <input
        type="email"
        inputMode="email"
        spellCheck={false}
        aria-invalid={invalid || undefined}
        {...props}
        className={cn(inputClass(invalid), "pl-8.5", className)}
      />
    </div>
  );
}

/**
 * Label, control, and one reserved message line. The line holds either a
 * hint or an error and crossfades between them, so validation never
 * pushes the form around.
 */
export function Field({
  id,
  label,
  corner,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  corner?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="pb-1">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium">
          {label}
        </label>
        {corner}
      </div>
      {children}
      <p
        id={`${id}-message`}
        aria-live="polite"
        className="mt-1 grid min-h-[18px] text-[12px] leading-[18px]"
      >
        <AnimatePresence initial={false} mode="popLayout">
          {error ? (
            <motion.span
              key="error"
              initial={{ opacity: 0, y: -3 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: { duration: 0.22, ease: EASE },
              }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              className="col-start-1 row-start-1 text-[#c23b33] dark:text-[#f0716a]"
            >
              {error}
            </motion.span>
          ) : hint ? (
            <motion.span
              key={typeof hint === "string" ? hint : "hint"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.22 } }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              className="col-start-1 row-start-1 text-foreground/50"
            >
              {hint}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Buttons                                                            */
/* ------------------------------------------------------------------ */

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-4 animate-spin rounded-full border-[1.5px] border-current/25 border-t-current",
        className,
      )}
    />
  );
}

/**
 * Primary and secondary buttons. While busy, the label blurs out and a
 * spinner blurs in within the same box, so the width never changes.
 */
export function AuthButton({
  variant = "primary",
  busy = false,
  busyLabel,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  busy?: boolean;
  busyLabel?: string;
}) {
  return (
    <button
      {...props}
      aria-busy={busy || undefined}
      disabled={props.disabled || busy}
      className={cn(
        "relative inline-grid h-10 w-full cursor-pointer place-items-center rounded-lg px-4 text-[14px] font-medium transition-[transform,background-color,border-color,opacity] duration-150 active:scale-[0.98] disabled:cursor-default disabled:active:scale-100",
        variant === "primary"
          ? "bg-foreground text-background hover:bg-foreground/90 disabled:opacity-90"
          : "border border-border bg-background hover:bg-muted/60 dark:bg-transparent dark:hover:bg-white/[0.04]",
        ring,
        className,
      )}
    >
      <span
        className={cn(
          "col-start-1 row-start-1 inline-flex items-center gap-2 transition-[opacity,filter] duration-200",
          busy && "opacity-0 blur-[2px]",
        )}
      >
        {children}
      </span>
      <span
        className={cn(
          "col-start-1 row-start-1 inline-flex items-center gap-2 transition-[opacity,filter] duration-200",
          busy
            ? "opacity-100 blur-0"
            : "pointer-events-none opacity-0 blur-[2px]",
        )}
      >
        <Spinner />
        {busyLabel ? <span>{busyLabel}</span> : null}
      </span>
    </button>
  );
}

export function TextButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "cursor-pointer rounded-sm font-medium text-foreground underline decoration-foreground/20 underline-offset-[3px] transition-[text-decoration-color,color] duration-150 hover:decoration-foreground disabled:cursor-default disabled:text-foreground/40 disabled:no-underline",
        ring,
        className,
      )}
    />
  );
}

export function Divider({ children = "or" }: { children?: React.ReactNode }) {
  return (
    <div className="my-5 flex items-center gap-3 text-[12px] text-foreground/45">
      <span className="h-px flex-1 bg-border" />
      {children}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Marks and small pieces                                             */
/* ------------------------------------------------------------------ */

export function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-4", className)} aria-hidden>
      <path
        fill="#4285F4"
        d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8Z"
      />
      <path
        fill="#34A853"
        d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z"
      />
    </svg>
  );
}

export function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-4", className)}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.47-1.1-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.3 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  );
}

export function SocialRow({
  onPick,
}: {
  onPick?: (provider: "google" | "github") => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <AuthButton
        variant="secondary"
        type="button"
        onClick={() => onPick?.("google")}
      >
        <GoogleMark />
        Google
      </AuthButton>
      <AuthButton
        variant="secondary"
        type="button"
        onClick={() => onPick?.("github")}
      >
        <GitHubMark />
        GitHub
      </AuthButton>
    </div>
  );
}

/** A check that draws itself, inside a solid accent disc that settles in. */
export function SuccessMark({ size = 48 }: { size?: number }) {
  return (
    <motion.span
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", visualDuration: 0.4, bounce: 0.3 }}
      className="grid place-items-center rounded-full bg-[var(--auth-accent)] text-white"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" className="size-1/2" fill="none" aria-hidden>
        <motion.path
          d="M5 12.5 10 17.5 19 7"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.4, delay: 0.15, ease: EASE }}
        />
      </svg>
    </motion.span>
  );
}

/** Seconds left before an action unlocks again (resend, retry). */
export function useCountdown(seconds: number) {
  const [left, setLeft] = React.useState(0);
  React.useEffect(() => {
    if (left <= 0) return;
    const id = window.setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left]);
  return { left, start: () => setLeft(seconds), reset: () => setLeft(0) };
}

export const formatSeconds = (value: number) =>
  `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;

/** Initials on a tinted square, for orgs and people without photos. */
export function Monogram({
  name,
  tone,
  className,
}: {
  name: string;
  tone: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-lg text-[13px] font-semibold text-white",
        className,
      )}
      style={{ background: tone }}
    >
      {name.charAt(0)}
    </span>
  );
}
