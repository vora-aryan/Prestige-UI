"use client";

import * as React from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/prestigeui/prestige-brand";
import {
  FooterAnchor,
  SocialLinks,
  accentVars,
  defaultGroups,
  preventPlaceholder,
  ring,
  scrollToTop,
  type FooterGroup,
} from "@/components/prestigeui/footer-ui";

type FooterWordmarkProps = {
  brand?: string;
  tagline?: string;
  groups?: FooterGroup[];
  /** IANA time zone for the live clock in the bottom bar. */
  timeZone?: string;
  city?: string;
  className?: string;
};

const minuteStore = {
  subscribe(callback: () => void) {
    const id = window.setInterval(callback, 15_000);
    return () => window.clearInterval(id);
  },
};

function useClock(timeZone: string) {
  return React.useSyncExternalStore(
    minuteStore.subscribe,
    () =>
      new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date()),
    () => "",
  );
}

/**
 * The brand name set edge to edge. Its size is solved from the measured
 * width, so it fills the row exactly at any screen size, and a soft light
 * follows the pointer across the letters.
 */
function Wordmark({ text }: { text: string }) {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLSpanElement>(null);
  const [shown, setShown] = React.useState(false);

  React.useLayoutEffect(() => {
    const box = boxRef.current;
    const measure = measureRef.current;
    if (!box || !measure) return;
    // Size is written straight to the element: resizing never re-renders.
    const fit = () => {
      // Width at 100px. Negative tracking is also applied after the last
      // letter, which would let the glyphs overhang on the right, so the
      // measurement adds that trailing space back.
      const natural = measure.getBoundingClientRect().width + 6.5;
      if (natural <= 6.5) return;
      const size = (box.clientWidth / natural) * 100;
      box.style.setProperty("--wordmark-size", `${size}px`);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    document.fonts?.ready.then(fit).catch(() => {});
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(box);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, [text]);

  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--wx", `${event.clientX - box.left}px`);
    event.currentTarget.style.setProperty("--wy", `${event.clientY - box.top}px`);
  };

  const letters =
    "block whitespace-nowrap text-center font-semibold leading-[0.8] tracking-[-0.065em] [font-size:var(--wordmark-size,18vw)]";

  return (
    <div
      ref={boxRef}
      aria-hidden
      onPointerMove={move}
      className="group/wm relative overflow-hidden select-none [--wx:50%] [--wy:0px]"
      // Crop through the descenders, the way large footer marks sit on the edge.
      style={{ height: "calc(var(--wordmark-size, 18vw) * 0.7)" }}
    >
      <span ref={measureRef} className="invisible absolute top-0 left-0 font-semibold tracking-[-0.065em] whitespace-nowrap [font-size:100px]">
        {text}
      </span>
      <div
        className={cn(
          "pt-[0.06em] transition-[transform,opacity] duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none [font-size:var(--wordmark-size,18vw)]",
          shown ? "translate-y-0 opacity-100" : "translate-y-[18%] opacity-0",
        )}
      >
        <div className="relative">
          {/* Resting ink: fades down into the page. */}
          <span
            className={cn(letters, "bg-clip-text text-transparent")}
            style={{
              backgroundImage:
                "linear-gradient(to bottom, color-mix(in oklab, var(--foreground) 14%, transparent), color-mix(in oklab, var(--foreground) 3%, transparent) 85%)",
            }}
          >
            {text}
          </span>
          {/* Lit copy, revealed only around the pointer. */}
          <span
            className={cn(
              letters,
              "absolute inset-0 bg-clip-text text-transparent opacity-0 transition-opacity duration-500 group-hover/wm:opacity-100 motion-reduce:hidden",
            )}
            style={{
              backgroundImage:
                "linear-gradient(to bottom, color-mix(in oklab, var(--foreground) 55%, transparent), color-mix(in oklab, var(--footer-accent) 35%, transparent) 90%)",
              WebkitMaskImage: "radial-gradient(240px circle at var(--wx) var(--wy), #000, transparent 70%)",
              maskImage: "radial-gradient(240px circle at var(--wx) var(--wy), #000, transparent 70%)",
            }}
          >
            {text}
          </span>
        </div>
      </div>
    </div>
  );
}

function FooterWordmark({
  brand = "Prestige UI",
  tagline = "Animated, accessible interface blocks you own as source. Copy one, or install the set.",
  groups = defaultGroups,
  timeZone = "Europe/Berlin",
  city = "Berlin",
  className,
}: FooterWordmarkProps) {
  const footerRef = React.useRef<HTMLElement>(null);
  const time = useClock(timeZone);

  return (
    <footer
      ref={footerRef}
      className={cn("w-full overflow-hidden border-t border-border bg-background font-sans text-foreground", accentVars, className)}
    >
      <div className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
          <div className="flex flex-col items-start">
            <a
              href="#"
              onClick={preventPlaceholder}
              className={cn("inline-flex items-center gap-2.5 rounded-md text-[16px] font-semibold tracking-[-0.02em]", ring)}
            >
              <BrandMark className="size-7" />
              {brand}
            </a>
            <p className="mt-4 max-w-[34ch] text-[14px] leading-[1.6] text-pretty text-foreground/60">{tagline}</p>
            <SocialLinks className="mt-6" />
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
            {groups.map((group) => (
              <div key={group.title}>
                <p className="text-[13px] font-medium">{group.title}</p>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <FooterAnchor link={link} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-border py-5 text-[12.5px] text-foreground/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 {brand}. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a href="#" onClick={preventPlaceholder} className={cn("rounded-sm transition-colors hover:text-foreground", ring)}>
              Status: <span className="text-foreground/75">operational</span>
            </a>
            <span className="tabular-nums" suppressHydrationWarning>
              {city}
              {time ? ` ${time}` : ""}
            </span>
            <button
              type="button"
              onClick={() => scrollToTop(footerRef.current)}
              className={cn(
                "group inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-foreground/60 transition-colors hover:text-foreground",
                ring,
              )}
            >
              Back to top
              <ArrowUp className="size-3.5 transition-transform duration-200 group-hover:-translate-y-0.5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-2 sm:px-4">
        <Wordmark text={brand} />
      </div>
    </footer>
  );
}

export { FooterWordmark, type FooterWordmarkProps };
