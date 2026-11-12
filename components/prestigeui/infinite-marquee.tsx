"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type InfiniteMarqueeProps = React.ComponentProps<"div"> & {
  pauseOnHover?: boolean;
  reverse?: boolean;
  duration?: number;
  gap?: string;
};

function InfiniteMarquee({
  className,
  children,
  pauseOnHover = true,
  reverse = false,
  duration = 30,
  gap = "2rem",
  ...props
}: InfiniteMarqueeProps) {
  const viewport = React.useRef<HTMLDivElement>(null);
  const lap = React.useRef<HTMLDivElement>(null);
  // Laps in each half of the track. The animation moves the track by half
  // its length, so each half must be at least as wide as the strip, or a
  // few short items leave the strip blank for part of every loop.
  const [laps, setLaps] = React.useState(1);
  // The loop stops while the strip is off screen.
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    const box = viewport.current;
    if (!box) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "120px" },
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const box = viewport.current;
    const el = lap.current;
    if (!box || !el) return;
    const measure = () => {
      const size = el.offsetWidth;
      // Capped, so a strip of near-empty items cannot render hundreds of copies.
      if (size) setLaps(Math.min(12, Math.max(1, Math.ceil(box.clientWidth / size))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The row gap only shows when reduced motion wraps the lap onto lines.
  const lapStyle = { columnGap: gap, rowGap: `min(${gap}, 0.75rem)`, paddingInlineEnd: gap };

  return (
    <div
      ref={viewport}
      className={cn(
        "group relative flex overflow-hidden",
        "[mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]",
        // Reduced motion: one still lap, wrapped and centred, with no fade.
        "motion-reduce:[mask-image:none]",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "flex w-max shrink-0 items-center animate-marquee",
          "motion-reduce:w-full motion-reduce:shrink motion-reduce:animate-none",
          reverse && "[animation-direction:reverse]",
          pauseOnHover && "group-hover:[animation-play-state:paused]",
        )}
        style={{
          // Each lap keeps the same speed however many laps fill the strip.
          animationDuration: `${duration * laps}s`,
          // Left unset on screen, so the hover pause class still applies.
          animationPlayState: visible ? undefined : "paused",
        }}
      >
        <div
          ref={lap}
          className="flex shrink-0 items-center motion-reduce:w-full motion-reduce:shrink motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:pe-0!"
          style={lapStyle}
        >
          {children}
        </div>
        {Array.from({ length: laps * 2 - 1 }, (_, i) => (
          <div
            key={i}
            className="flex shrink-0 items-center motion-reduce:hidden"
            aria-hidden
            style={lapStyle}
          >
            {children}
          </div>
        ))}
      </div>
    </div>
  );
}

export { InfiniteMarquee, type InfiniteMarqueeProps };
