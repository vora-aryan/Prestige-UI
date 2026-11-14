"use client";

import * as React from "react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type AddToCartProps = {
  /** Shown after the label, already formatted ("$48.00"). */
  price?: string;
  label?: string;
  /** Quantity in the cart (controlled). 0 shows the add button. */
  quantity?: number;
  defaultQuantity?: number;
  /** Called with the new quantity. Return a promise that rejects to undo it. */
  onQuantityChange?: (quantity: number) => void | Promise<void>;
  /** Most that can be added, for example the stock left. */
  max?: number;
  className?: string;
};

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** A cart whose basket dips as an item drops into it. */
function CartIcon({ drops, reduce }: { drops: number; reduce: boolean }) {
  return (
    <span className="relative grid size-4 place-items-center">
      {/* The item: a small parcel that falls into the basket on each add. */}
      <AnimatePresence>
        {drops > 0 && !reduce && (
          <motion.span
            key={drops}
            aria-hidden
            className="absolute top-[1px] left-[6.5px] size-[5px] rounded-[1px] bg-current"
            initial={{ y: -11, opacity: 0, scale: 0.6 }}
            // It lands inside the basket (below the rim), so a filled basket means items in the cart.
            animate={{
              y: [-11, -11, 4.5],
              opacity: [0, 1, 1],
              scale: [0.6, 1, 1],
              transition: { duration: 0.42, times: [0, 0.3, 1], ease: [0.5, 0, 0.75, 0] },
            }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
          />
        )}
      </AnimatePresence>
      <motion.svg
        key={`cart-${drops}`}
        viewBox="0 0 16 16"
        className="size-4 overflow-visible"
        fill="none"
        aria-hidden
        // The basket takes the weight the moment the item lands.
        initial={drops && !reduce ? { y: 0 } : false}
        animate={drops && !reduce ? { y: [0, 0, 1.6, 0] } : { y: 0 }}
        transition={{ duration: 0.62, times: [0, 0.62, 0.78, 1], ease: EASE_OUT }}
      >
        <path
          d="M1.5 2h1.6l1.6 8.2c.08.43.45.74.89.74h6.3c.42 0 .78-.29.88-.7L14 5H4"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={6.2} cy={13.6} r={1.1} fill="currentColor" />
        <circle cx={11.6} cy={13.6} r={1.1} fill="currentColor" />
      </motion.svg>
    </span>
  );
}

/** The quantity rolls up when it grows and down when it shrinks. */
function Count({ value, reduce }: { value: number; reduce: boolean }) {
  const [previous, setPrevious] = React.useState(value);
  const [direction, setDirection] = React.useState(1);
  if (value !== previous) {
    setDirection(value > previous ? 1 : -1);
    setPrevious(value);
  }
  return (
    <span className="relative inline-grid h-[1.25em] overflow-clip tabular-nums">
      <AnimatePresence initial={false} custom={direction}>
        <motion.span
          key={value}
          custom={direction}
          variants={{
            enter: (d: number) => ({ y: reduce ? 0 : `${d * 100}%`, opacity: reduce ? 0 : 1 }),
            center: { y: "0%", opacity: 1 },
            exit: (d: number) => ({ y: reduce ? 0 : `${d * -100}%`, opacity: reduce ? 0 : 1 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.28, ease: EASE_OUT }}
          className="col-start-1 row-start-1 leading-[1.25em]"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function AddToCart({
  price = "$48.00",
  label = "Add to cart",
  quantity: controlled,
  defaultQuantity = 0,
  onQuantityChange,
  max,
  className,
}: AddToCartProps) {
  const reduce = Boolean(useReducedMotion());
  const [own, setOwn] = React.useState(defaultQuantity);
  const [drops, setDrops] = React.useState(0);
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const addButton = React.useRef<HTMLButtonElement>(null);
  const plusButton = React.useRef<HTMLButtonElement>(null);
  const minusButton = React.useRef<HTMLButtonElement>(null);
  const quantity = controlled ?? own;
  const inCart = quantity > 0;
  const atMax = max !== undefined && quantity >= max;
  const wasInCart = React.useRef(inCart);

  // Keep focus on the control when it changes shape.
  React.useEffect(() => {
    if (wasInCart.current === inCart) return;
    const focusedInside = scope.current?.contains(document.activeElement);
    wasInCart.current = inCart;
    if (!focusedInside) return;
    (inCart ? plusButton : addButton).current?.focus({ preventScroll: true });
  }, [inCart, scope]);

  const change = async (next: number) => {
    const clamped = Math.max(0, max === undefined ? next : Math.min(max, next));
    if (clamped === quantity) return;
    const before = quantity;
    // + turns off at the limit, which drops its focus; hand focus to − instead.
    const handOff = max !== undefined && clamped >= max && document.activeElement === plusButton.current;
    if (clamped > before) setDrops((n) => n + 1);
    if (controlled === undefined) setOwn(clamped);
    if (handOff) requestAnimationFrame(() => minusButton.current?.focus({ preventScroll: true }));
    try {
      await onQuantityChange?.(clamped);
    } catch {
      // The cart didn't update: put it back and say so with a small shake.
      if (controlled === undefined) setOwn(before);
      if (!reduce && scope.current) {
        animate(scope.current, { x: [0, -4, 4, -3, 3, 0] }, { duration: 0.36, ease: "easeOut" });
      }
    }
  };

  const step =
    "grid h-full w-11 shrink-0 cursor-pointer place-items-center text-primary-foreground transition-colors duration-150 hover:bg-primary-foreground/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-foreground/45 disabled:cursor-default disabled:hover:bg-transparent";

  return (
    <div
      ref={scope}
      className={cn(
        "relative inline-grid h-11 overflow-clip rounded-md bg-primary text-sm font-medium text-primary-foreground select-none",
        "bg-[linear-gradient(to_bottom,rgba(255,255,255,0.10),rgba(255,255,255,0)_55%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-1px_0_rgba(0,0,0,0.3),0_1px_2px_rgba(0,0,0,0.14),0_6px_14px_-6px_rgba(0,0,0,0.24)]",
        "dark:bg-[linear-gradient(to_bottom,rgba(255,255,255,0),rgba(0,0,0,0.06))] dark:shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)]",
        className,
      )}
    >
      {/* The add state's content reserves the width; the stepper fits inside it. */}
      <span aria-hidden className="invisible col-start-1 row-start-1 flex items-center gap-2 px-5 whitespace-nowrap">
        <span className="size-4" />
        {label}
        {price && <span className="ml-1">· {price}</span>}
      </span>

      <AnimatePresence initial={false}>
        {!inCart ? (
          <motion.button
            key="add"
            ref={addButton}
            type="button"
            onClick={() => change(1)}
            aria-label={price ? `${label}, ${price}` : label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2, delay: reduce ? 0 : 0.14, ease: EASE_OUT } }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className="col-start-1 row-start-1 flex cursor-pointer items-center justify-center gap-2 px-5 whitespace-nowrap transition-[background-color,transform,scale] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-primary-foreground/[0.06] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-foreground/45"
          >
            <CartIcon drops={0} reduce={reduce} />
            {label}
            {price && <span className="ml-1 text-primary-foreground/65">· {price}</span>}
          </motion.button>
        ) : (
          <motion.div
            key="stepper"
            role="group"
            aria-label="Quantity in cart"
            initial={{ opacity: 0 }}
            // Waits for the add label to leave, so two labels never overlap.
            animate={{ opacity: 1, transition: { duration: 0.2, delay: reduce ? 0 : 0.12, ease: EASE_OUT } }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className="col-start-1 row-start-1 flex items-center justify-between"
          >
            {/* − and + slide out from the centre once the item has landed. */}
            <motion.button
              ref={minusButton}
              type="button"
              aria-label={quantity === 1 ? "Remove from cart" : "Remove one"}
              onClick={() => change(quantity - 1)}
              initial={{ x: reduce ? 0 : 14, opacity: 0 }}
              animate={{ x: 0, opacity: 1, transition: { duration: 0.32, delay: reduce ? 0 : 0.22, ease: EASE_OUT } }}
              className={step}
            >
              <Minus className="size-4" strokeWidth={2} />
            </motion.button>

            <span className="flex items-center gap-2">
              <CartIcon drops={drops} reduce={reduce} />
              {/* Same line box for the rolling number and the words, centred, so they share a baseline. */}
              <span className="flex items-center gap-1 whitespace-nowrap">
                <Count value={quantity} reduce={reduce} />
                <span className="leading-[1.25em] text-primary-foreground/65">in cart</span>
              </span>
            </span>

            <motion.button
              ref={plusButton}
              type="button"
              aria-label="Add one"
              onClick={() => change(quantity + 1)}
              disabled={atMax}
              initial={{ x: reduce ? 0 : -14, opacity: 0 }}
              animate={{ x: 0, opacity: atMax ? 0.4 : 1, transition: { duration: 0.32, delay: reduce ? 0 : 0.22, ease: EASE_OUT } }}
              className={step}
            >
              <Plus className="size-4" strokeWidth={2} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <span className="sr-only" aria-live="polite">
        {inCart ? `${quantity} in cart` : ""}
      </span>
    </div>
  );
}

export { AddToCart, type AddToCartProps };
