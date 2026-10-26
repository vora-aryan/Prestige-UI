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

  const lapStyle = { gap, paddingInlineEnd: gap };

  return (
    <div
      ref={viewport}
      className={cn(
        "group relative flex overflow-hidden",
        "[mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "flex w-max shrink-0 items-center animate-marquee motion-reduce:animate-none",
          reverse && "[animation-direction:reverse]",
          pauseOnHover && "group-hover:[animation-play-state:paused]",
        )}
        // Each lap keeps the same speed however many laps fill the strip.
        style={{ animationDuration: `${duration * laps}s` }}
      >
        <div ref={lap} className="flex shrink-0 items-center" style={lapStyle}>
          {children}
        </div>
        {Array.from({ length: laps * 2 - 1 }, (_, i) => (
          <div
            key={i}
            className="flex shrink-0 items-center"
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
