"use client";

import * as React from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { cn } from "@/lib/utils";

type StarButtonProps = {
  /** "star" for repos and bookmarks, "upvote" for launches and posts. */
  icon?: "star" | "upvote";
  label?: string;
  /** The count to show. With `repo`, it is the fallback until GitHub answers. */
  count?: number;
  /** "owner/name": shows that repository's live star count and links to it. */
  repo?: string;
  /** Turns the button into a link (set automatically from `repo`). */
  href?: string;
  /** Toggle mode: whether the viewer has starred or upvoted. */
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  className?: string;
};

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const ROLL = { duration: 0.6, ease: EASE_OUT } as const;

/**
 * One odometer wheel: 0-9 twice. Counting up past 9 rolls on into the second
 * 0; counting down past 0 starts from it. So a carry always keeps turning the
 * same way, like the real thing.
 */
function Wheel({
  digit,
  direction,
  delay,
  hold,
  reduce,
}: {
  digit: number;
  direction: 1 | -1;
  delay: number;
  /** Wait at 0 until released, then roll up to the digit. */
  hold: boolean;
  reduce: boolean;
}) {
  const shown = hold ? 0 : digit;
  const index = useMotionValue(shown);
  const y = useTransform(index, (v) => `${-v}em`);
  const previous = React.useRef(shown);
  const held = React.useRef(hold);

  React.useEffect(() => {
    const from = previous.current;
    previous.current = shown;
    const releasing = held.current && !hold;
    held.current = hold;
    if (from === shown) return;
    const dir = releasing ? 1 : direction;
    index.stop();
    if (reduce) {
      index.set(shown);
      return;
    }
    if (dir === 1) {
      index.set(from);
      const target = shown > from ? shown : shown + 10;
      animate(index, target, { ...ROLL, delay }).then(() => index.set(shown));
    } else {
      index.set(shown < from ? from : from + 10);
      animate(index, shown, { ...ROLL, delay });
    }
  }, [shown, hold, direction, delay, index, reduce]);

  return (
    <span className="relative inline-block h-[1em] overflow-clip leading-none">
      <motion.span className="flex flex-col" style={{ y }}>
        {Array.from({ length: 20 }, (_, i) => (
          <span key={i} className="block h-[1em] leading-none">
            {i % 10}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

/** Each character with a key counted from the right, so units stay units as the number grows. */
function keyFromRight(text: string) {
  const out: { char: string; key: string; place: number }[] = [];
  let place = 0;
  for (let i = text.length - 1; i >= 0; i--) {
    const char = text[i];
    const isDigit = char >= "0" && char <= "9";
    out.unshift({ char, key: isDigit ? `d${place}` : `s${place}`, place });
    if (isDigit) place += 1;
  }
  return out;
}

function Odometer({ value, hold, reduce }: { value: number; hold: boolean; reduce: boolean }) {
  // The whole number decides which way every wheel turns.
  const [previous, setPrevious] = React.useState(value);
  const [direction, setDirection] = React.useState<1 | -1>(1);
  if (value !== previous) {
    setDirection(value > previous ? 1 : -1);
    setPrevious(value);
  }
  return (
    <span className="inline-flex tabular-nums" aria-hidden>
      {keyFromRight(value.toLocaleString("en-US")).map(({ char, key, place }) =>
        char >= "0" && char <= "9" ? (
          // Higher places start a touch later, like a carry travelling left.
          <Wheel
            key={key}
            digit={Number(char)}
            direction={direction}
            delay={reduce ? 0 : place * 0.05}
            hold={hold}
            reduce={reduce}
          />
        ) : (
          <span key={key} className="inline-block leading-none">
            {char}
          </span>
        ),
      )}
    </span>
  );
}

function StarIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="size-4 overflow-visible" aria-hidden>
      <path
        d="M8 1.6l1.93 3.92 4.32.63-3.13 3.05.74 4.3L8 11.47l-3.86 2.03.74-4.3L1.75 6.15l4.32-.63L8 1.6z"
        strokeWidth={1.4}
        strokeLinejoin="round"
        className={cn(
          "transition-[fill,stroke] duration-200",
          on
            ? "fill-[#f0b429] stroke-[#b7791f] dark:fill-[#f2c94c] dark:stroke-[#f2c94c]"
            : "fill-transparent stroke-current",
        )}
      />
    </svg>
  );
}

function UpvoteIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="size-4 overflow-visible" aria-hidden>
      <path
        d="M8 2.5l5.5 8.5h-11L8 2.5z"
        strokeWidth={1.4}
        strokeLinejoin="round"
        className={cn("transition-[fill] duration-200 stroke-current", on ? "fill-current" : "fill-transparent")}
      />
    </svg>
  );
}

function readCached(key: string) {
  try {
    const cached = sessionStorage.getItem(key);
    return cached === null ? null : Number(cached);
  } catch {
    return null;
  }
}

/** The repository's live star count, cached for the visit (GitHub allows 60 requests an hour without a token). */
function useRepoStars(repo: string | undefined) {
  const [stars, setStars] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!repo) return;
    const key = `stars:${repo}`;
    const controller = new AbortController();
    const cached = readCached(key);
    const source: Promise<number | null> =
      cached !== null
        ? Promise.resolve(cached)
        : fetch(`https://api.github.com/repos/${repo}`, { signal: controller.signal })
            .then((res) => (res.ok ? res.json() : null))
            .then((data: { stargazers_count?: number } | null) => {
              const n = typeof data?.stargazers_count === "number" ? data.stargazers_count : null;
              if (n !== null) {
                try {
                  sessionStorage.setItem(key, String(n));
                } catch {
                  // Not cached this visit.
                }
              }
              return n;
            });
    source.then((n) => n !== null && !controller.signal.aborted && setStars(n)).catch(() => {});
    return () => controller.abort();
  }, [repo]);
  return stars;
}

function StarButton({
  icon = "star",
  label,
  count = 0,
  repo,
  href,
  pressed: controlled,
  defaultPressed = false,
  onPressedChange,
  className,
}: StarButtonProps) {
  const reduce = Boolean(useReducedMotion());
  const root = React.useRef<HTMLElement>(null);
  const seen = useInView(root, { once: true, margin: "-40px" });
  const [own, setOwn] = React.useState(defaultPressed);
  const [twirl, setTwirl] = React.useState(0);
  const live = useRepoStars(repo);
  const pressed = controlled ?? own;
  const link = href ?? (repo ? `https://github.com/${repo}` : undefined);
  const text = label ?? (icon === "star" ? "Star" : "Upvote");

  // Uncontrolled, the viewer's own press adds or removes one. Controlled, pass
  // the count that already includes it.
  const base = live ?? count;
  const ownDelta = controlled === undefined ? Number(pressed) - Number(defaultPressed) : 0;
  const total = link ? base : base + ownDelta;
  // Every wheel waits at 0 until the button is first seen, then they roll up together.
  const hold = !seen && !reduce;
  // Room for one more digit, so 999 to 1,000 doesn't push anything.
  const widest = Math.max(total, total + 1).toLocaleString("en-US");

  const toggle = () => {
    const next = !pressed;
    if (controlled === undefined) setOwn(next);
    if (next) setTwirl((n) => n + 1);
    onPressedChange?.(next);
  };

  const content = (
    <>
      {/* Label and digits both sit in 1em boxes, so their text shares one baseline. */}
      <span className="flex items-center gap-1.5 px-3 leading-none">
        <motion.span
          className="grid size-4 place-items-center"
          key={twirl}
          initial={twirl && !reduce ? { scale: 0.7, rotate: -72 } : false}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 18 }}
        >
          {icon === "star" ? <StarIcon on={link ? false : pressed} /> : <UpvoteIcon on={link ? false : pressed} />}
        </motion.span>
        {text}
      </span>
      <span aria-hidden className="h-4 w-px bg-black/[0.1] dark:bg-white/[0.12]" />
      <span className="relative grid px-3 tabular-nums">
        <span aria-hidden className="invisible col-start-1 row-start-1 text-right">
          {widest}
        </span>
        <span className="col-start-1 row-start-1 flex items-center justify-end">
          <Odometer value={total} hold={hold} reduce={reduce} />
        </span>
      </span>
    </>
  );

  const surface = cn(
    "inline-flex h-9 cursor-pointer items-center rounded-md border border-black/[0.09] bg-background text-[13px] font-medium text-foreground select-none",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.06)] dark:border-white/[0.1] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.4)]",
    "transition-[background-color,transform,scale] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-black/[0.03] active:scale-[0.97] dark:hover:bg-white/[0.05]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    className,
  );
  const noun = icon === "star" ? (total === 1 ? "star" : "stars") : total === 1 ? "upvote" : "upvotes";
  const name = `${text}, ${total.toLocaleString("en-US")} ${noun}`;

  if (link) {
    return (
      <a
        ref={root as React.Ref<HTMLAnchorElement>}
        href={link}
        target="_blank"
        rel="noreferrer"
        aria-label={repo ? `${name} on GitHub` : name}
        className={surface}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      ref={root as React.Ref<HTMLButtonElement>}
      type="button"
      aria-pressed={pressed}
      aria-label={name}
      onClick={toggle}
      className={surface}
    >
      {content}
    </button>
  );
}

export { StarButton, type StarButtonProps };
