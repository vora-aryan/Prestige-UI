"use client";

import * as React from "react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type FollowButtonProps = {
  /** Who is being followed, for screen readers ("Follow Lena Ortiz"). */
  name?: string;
  following?: boolean;
  defaultFollowing?: boolean;
  /** Called with the new state. Return a promise that rejects to undo it. */
  onFollowingChange?: (following: boolean) => void | Promise<void>;
  followLabel?: string;
  followingLabel?: string;
  unfollowLabel?: string;
  className?: string;
};

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

// The icon's two strokes, drawn with the same commands in every shape so they
// can morph into each other: a plus, a check and a cross.
const SHAPES = {
  plus: ["M8 3.5L8 12.5", "M3.5 8L12.5 8"],
  check: ["M3.5 8.5L6.5 11.5", "M6.5 11.5L12.5 4.5"],
  cross: ["M4.5 4.5L11.5 11.5", "M11.5 4.5L4.5 11.5"],
} as const;

function MorphIcon({ shape, reduce }: { shape: keyof typeof SHAPES; reduce: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0 overflow-visible" fill="none" aria-hidden>
      {SHAPES[shape].map((d, i) => (
        <motion.path
          key={i}
          initial={false}
          animate={{ d }}
          transition={{ duration: reduce ? 0 : 0.32, ease: EASE_OUT }}
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

function FollowButton({
  name,
  following: controlled,
  defaultFollowing = false,
  onFollowingChange,
  followLabel = "Follow",
  followingLabel = "Following",
  unfollowLabel = "Unfollow",
  className,
}: FollowButtonProps) {
  const reduce = Boolean(useReducedMotion());
  const [own, setOwn] = React.useState(defaultFollowing);
  const [hover, setHover] = React.useState(false);
  // Right after following, the pointer is still on the button; it must leave
  // once before the button offers to unfollow.
  const [armed, setArmed] = React.useState(true);
  const [scope, animate] = useAnimate<HTMLButtonElement>();
  const following = controlled ?? own;
  const unfollowing = following && hover && armed;

  const shape: keyof typeof SHAPES = !following ? "plus" : unfollowing ? "cross" : "check";
  const label = !following ? followLabel : unfollowing ? unfollowLabel : followingLabel;

  const toggle = async () => {
    const next = !following;
    if (controlled === undefined) setOwn(next);
    setArmed(false);
    try {
      await onFollowingChange?.(next);
    } catch {
      // The save failed: put it back and say so with a small shake.
      if (controlled === undefined) setOwn(!next);
      if (!reduce && scope.current) {
        animate(scope.current, { x: [0, -3, 3, -2, 2, 0] }, { duration: 0.32, ease: "easeOut" });
      }
    }
  };

  return (
    <button
      ref={scope}
      type="button"
      aria-pressed={following}
      aria-label={`${followLabel}${name ? ` ${name}` : ""}`}
      data-state={unfollowing ? "unfollow" : following ? "following" : "follow"}
      onClick={toggle}
      onPointerEnter={(event) => event.pointerType === "mouse" && setHover(true)}
      onPointerLeave={() => {
        setHover(false);
        setArmed(true);
      }}
      className={cn(
        "relative inline-grid h-9 cursor-pointer place-items-center rounded-md border px-3.5 text-[13px] font-medium select-none",
        "transition-[background-color,border-color,color,box-shadow,transform,scale] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "[--danger:#d4463e] [--danger-text:#c2372f] dark:[--danger:#e0625a] dark:[--danger-text:#f08a82]",
        !following &&
          "border-[color-mix(in_oklab,var(--primary)_85%,black)] bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-1px_0_rgba(0,0,0,0.3),0_1px_2px_rgba(0,0,0,0.12)] hover:bg-primary/90 dark:border-primary dark:shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)]",
        following &&
          !unfollowing &&
          "border-black/[0.1] bg-background text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.05)] dark:border-white/[0.12] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        unfollowing &&
          "border-[color-mix(in_oklab,var(--danger)_35%,transparent)] bg-[color-mix(in_oklab,var(--danger)_5%,var(--background))] text-[var(--danger-text)]",
        className,
      )}
    >
      {/* Invisible copies of every state reserve the widest, so the button never resizes. */}
      {[followLabel, followingLabel, unfollowLabel].map((text) => (
        <span
          key={text}
          aria-hidden
          className="invisible col-start-1 row-start-1 flex items-center gap-1.5 whitespace-nowrap"
        >
          <span className="size-4" />
          {text}
        </span>
      ))}

      {/* The visible content stays centred: the label crossfades and the icon
          glides to its new place instead of jumping. */}
      <span className="absolute inset-0 flex items-center justify-center">
        {/* Position only: animating size would stretch the text mid-change. */}
        <motion.span
          layout={reduce ? false : "position"}
          transition={{ layout: { duration: 0.32, ease: EASE_OUT } }}
          className="flex items-center gap-1.5"
        >
          <MorphIcon shape={shape} reduce={reduce} />
          <span className="relative grid whitespace-nowrap">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={label}
                initial={{ opacity: 0, y: reduce ? 0 : 3 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.22, delay: reduce ? 0 : 0.06, ease: EASE_OUT } }}
                exit={{ opacity: 0, y: reduce ? 0 : -3, transition: { duration: 0.12, ease: EASE_OUT } }}
                className="col-start-1 row-start-1"
              >
                {label}
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.span>
      </span>

      <span className="sr-only" aria-live="polite">
        {following ? followingLabel : ""}
      </span>
    </button>
  );
}

export { FollowButton, type FollowButtonProps };
