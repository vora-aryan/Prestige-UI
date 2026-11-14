"use client";

import * as React from "react";
import { Check, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProductImage = { src: string; alt: string };

export type ProductVariant = {
  /** e.g. "Graphite". */
  name: string;
  /** Swatch color, any CSS color. */
  color: string;
  images: ProductImage[];
};

export interface ProductCardProps {
  name: string;
  /** Formatted price, e.g. "$249". */
  price: string;
  /** Original price when on sale, shown struck through. */
  compareAt?: string;
  /** One short line, e.g. "Wireless, 40-hour battery". */
  detail?: string;
  /** Small tag on the photo, e.g. "New" or "Sale". */
  badge?: string;
  /** Colors, each with its own photos. Pass `images` instead for a single look. */
  variants?: ProductVariant[];
  images?: ProductImage[];
  /** Makes the name a link that covers the card. */
  href?: string;
  /** Called with the chosen variant name (or undefined). Leave it out to hide the button. */
  onAddToCart?: (variant?: string) => void;
  className?: string;
}

const EASE = "ease-[cubic-bezier(0.16,1,0.3,1)]";

/**
 * A product card: move across the photo to flip through it (swipe on
 * phones), pick a color to swap the photos, and add to cart from a button
 * that rises over the photo on hover. Nothing moves when anything changes.
 */
export function ProductCard({
  name,
  price,
  compareAt,
  detail,
  badge,
  variants,
  images,
  href,
  onAddToCart,
  className,
}: ProductCardProps) {
  const looks = React.useMemo<ProductVariant[]>(
    () => variants ?? [{ name: "", color: "transparent", images: images ?? [] }],
    [variants, images],
  );
  const [look, setLook] = React.useState(0);
  const [shot, setShot] = React.useState(0);
  const [added, setAdded] = React.useState(false);
  const swipe = React.useRef<{ x: number; id: number } | null>(null);
  const photoRef = React.useRef<HTMLDivElement>(null);
  const groupId = React.useId();

  const current = looks[look] ?? looks[0];
  const count = current.images.length;
  const showing = Math.min(shot, count - 1);

  React.useEffect(() => {
    if (!added) return;
    const t = window.setTimeout(() => setAdded(false), 1600);
    return () => window.clearTimeout(t);
  }, [added]);

  const add = () => {
    onAddToCart?.(variants ? current.name : undefined);
    setAdded(true);
  };

  const addLabel = (
    <span className="relative grid">
      <span className={cn("col-start-1 row-start-1 inline-flex items-center justify-center gap-2 transition-opacity duration-200", added ? "opacity-0" : "opacity-100")}>
        <ShoppingBag className="size-4" strokeWidth={2} />
        Add to cart
      </span>
      <span className={cn("col-start-1 row-start-1 inline-flex items-center justify-center gap-2 transition-opacity duration-200", added ? "opacity-100" : "opacity-0")}>
        <Check className="size-4" strokeWidth={2.25} />
        Added
      </span>
    </span>
  );

  return (
    <article
      className={cn(
        "group/product relative flex min-w-0 touch-pan-y flex-col overflow-clip rounded-lg bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] transition-shadow duration-300 hover:shadow-[0_0_0_1px_rgba(0,0,0,0.09),0_14px_32px_-18px_rgba(0,0,0,0.22)] dark:bg-[#17171b] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.14),inset_0_1px_0_rgba(255,255,255,0.05)] dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]",
        className,
      )}
      // Listened to on the card, so it still works under the link that covers it.
      onPointerMove={(e) => {
        const r = photoRef.current?.getBoundingClientRect();
        if (e.pointerType !== "mouse" || count < 2 || !r) return;
        if (e.clientY > r.bottom) return setShot(0);
        setShot(Math.max(0, Math.min(count - 1, Math.floor(((e.clientX - r.left) / r.width) * count))));
      }}
      onPointerLeave={(e) => e.pointerType === "mouse" && setShot(0)}
      onPointerDown={(e) => {
        const r = photoRef.current?.getBoundingClientRect();
        if (e.pointerType !== "mouse" && r && e.clientY <= r.bottom) swipe.current = { x: e.clientX, id: e.pointerId };
      }}
      onPointerUp={(e) => {
        const st = swipe.current;
        swipe.current = null;
        if (!st || st.id !== e.pointerId || count < 2) return;
        const dx = e.clientX - st.x;
        if (Math.abs(dx) > 36) setShot((v) => Math.max(0, Math.min(count - 1, Math.min(v, count - 1) + (dx < 0 ? 1 : -1))));
      }}
    >
      {/* Photo: pointer position picks the shot; a swipe steps through on touch. */}
      <div
        ref={photoRef}
        className="relative aspect-[4/5] touch-pan-y overflow-clip bg-[#f3f3f1] select-none dark:bg-[#202025]"
      >
        {looks.map((l, li) =>
          l.images.map((img, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${li}-${i}`}
              src={img.src}
              alt={li === look && i === showing ? img.alt : ""}
              aria-hidden={!(li === look && i === showing)}
              loading="lazy"
              draggable={false}
              className={cn(
                "absolute inset-0 size-full object-cover transition-[opacity,scale] duration-500 motion-reduce:transition-none",
                EASE,
                li === look && i === showing ? "opacity-100" : "opacity-0",
                "group-hover/product:scale-[1.03] motion-reduce:group-hover/product:scale-100",
              )}
            />
          )),
        )}

        {/* Which shot is showing. White with a soft edge reads on light and dark photos.
            Pointer devices: shown on hover, just above the add button. Touch: always, bottom left. */}
        {count > 1 && (
          <div
            aria-hidden
            className={cn(
              "absolute bottom-3 left-3 flex gap-1 transition-opacity duration-300 [@media(hover:hover)]:right-3 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/product:opacity-100",
              onAddToCart ? "right-[64px] [@media(hover:hover)]:bottom-[62px]" : "right-3",
            )}
          >
            {current.images.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-[3px] flex-1 rounded-full shadow-[0_0_0_0.5px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.18)] transition-colors duration-200",
                  i === showing ? "bg-white" : "bg-white/45",
                )}
              />
            ))}
          </div>
        )}

        {badge && (
          <span
            className={cn(
              "absolute top-3 left-3 inline-flex h-6 items-center rounded-[5px] bg-white px-2 text-[12px] font-medium text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.12)]",
            )}
          >
            {badge}
          </span>
        )}

        {onAddToCart && (
          <>
            {/* Pointer devices: a full-width button rises over the photo on hover or focus. */}
            <div
              className={cn(
                "absolute inset-x-3 bottom-3 z-10 hidden translate-y-2 opacity-0 transition-[opacity,translate] duration-300 group-focus-within/product:translate-y-0 group-focus-within/product:opacity-100 group-hover/product:translate-y-0 group-hover/product:opacity-100 [@media(hover:hover)]:block",
                EASE,
              )}
            >
              <button
                type="button"
                onClick={add}
                aria-label={added ? `${name} added to cart` : `Add ${name} to cart`}
                className="h-10 w-full rounded-[6px] bg-neutral-900 text-[13.5px] font-medium text-white shadow-[0_6px_16px_-8px_rgba(0,0,0,0.5)] transition-[background-color,scale] duration-150 outline-none hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-white/70 active:scale-[0.98] dark:bg-white dark:text-neutral-900 dark:hover:bg-white/90"
              >
                {addLabel}
              </button>
            </div>
            {/* Touch screens: no hover, so a compact button stays in the corner. */}
            <button
              type="button"
              onClick={add}
              aria-label={added ? `${name} added to cart` : `Add ${name} to cart`}
              className="absolute right-3 bottom-3 z-10 grid size-10 place-items-center rounded-[6px] bg-white text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.12),0_6px_16px_-8px_rgba(0,0,0,0.35)] transition-[scale] duration-150 outline-none active:scale-[0.96] [@media(hover:hover)]:hidden"
            >
              <span className="relative grid size-4">
                <ShoppingBag className={cn("col-start-1 row-start-1 size-4 transition-opacity duration-200", added ? "opacity-0" : "opacity-100")} strokeWidth={2} />
                <Check className={cn("col-start-1 row-start-1 size-4 transition-opacity duration-200", added ? "opacity-100" : "opacity-0")} strokeWidth={2.25} />
              </span>
            </button>
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="min-w-0 truncate text-[15px] font-medium text-foreground">
            {href ? (
              <a href={href} className="outline-none after:absolute after:inset-0 focus-visible:underline">
                {name}
              </a>
            ) : (
              name
            )}
          </h3>
          <p className="shrink-0 text-[15px] font-medium text-foreground tabular-nums">
            {compareAt && (
              <s className="mr-1.5 text-[13px] font-normal text-muted-foreground">
                <span className="sr-only">Was </span>
                {compareAt}
              </s>
            )}
            {compareAt && <span className="sr-only">now </span>}
            {price}
          </p>
        </div>
        {detail && <p className="mt-1 truncate text-[13px] text-muted-foreground">{detail}</p>}

        {variants && variants.length > 1 && (
          <div className="relative z-10 mt-3.5 flex items-center gap-3">
            <div role="radiogroup" aria-label="Color" className="flex items-center gap-1.5">
              {variants.map((v, i) => (
                <button
                  key={v.name}
                  type="button"
                  role="radio"
                  aria-checked={i === look}
                  aria-label={v.name}
                  onClick={() => {
                    setLook(i);
                    setShot(0);
                  }}
                  onKeyDown={(e) => {
                    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
                    if (!step) return;
                    e.preventDefault();
                    const next = (look + step + variants.length) % variants.length;
                    setLook(next);
                    setShot(0);
                    document.getElementById(`${groupId}-${next}`)?.focus();
                  }}
                  id={`${groupId}-${i}`}
                  tabIndex={i === look ? 0 : -1}
                  className={cn(
                    "grid size-6 place-items-center rounded-full outline-none transition-shadow duration-200 focus-visible:ring-2 focus-visible:ring-foreground/40",
                    i === look
                      ? "shadow-[0_0_0_1.5px_var(--foreground)]"
                      : "shadow-[0_0_0_1px_rgba(0,0,0,0.1)] hover:shadow-[0_0_0_1px_rgba(0,0,0,0.3)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.16)] dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.4)]",
                  )}
                >
                  <span
                    className="size-[18px] rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12),inset_0_1px_1px_rgba(255,255,255,0.25)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]"
                    style={{ background: v.color }}
                  />
                </button>
              ))}
            </div>
            {/* Every name stacked in one cell, so the row never changes width. */}
            <span className="grid text-[12.5px] text-muted-foreground">
              {variants.map((v, i) => (
                <span
                  key={v.name}
                  aria-hidden={i !== look}
                  className={cn("col-start-1 row-start-1 transition-opacity duration-200", i === look ? "opacity-100" : "opacity-0")}
                >
                  {v.name}
                </span>
              ))}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
