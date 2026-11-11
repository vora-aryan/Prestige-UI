"use client";

import * as React from "react";
import { AnimatePresence, MotionConfig, motion, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";
import {
  Beam,
  BrandMark,
  Diagram,
  EASE,
  Trace,
  Wire,
  card,
  elbow,
  travel,
  useLoop,
  useTicks,
  type Mark,
  type Pt,
  type Route,
  type Size,
} from "@/components/prestigeui/illustration-ui";

export type OrbitTool = { name: string; mark: Mark };

const TOOLS: OrbitTool[] = [
  { name: "Slack", mark: "slack" },
  { name: "GitHub", mark: "github" },
  { name: "Figma", mark: "figma" },
  { name: "Notion", mark: "notion" },
  { name: "Stripe", mark: "stripe" },
  { name: "Linear", mark: "linear" },
  { name: "HubSpot", mark: "hubspot" },
  { name: "Google Drive", mark: "googledrive" },
];


/* ------------------------------------------------------------------ */
/*  Layout                                                             */
/* ------------------------------------------------------------------ */

type Layout = {
  size: Size;
  center: Pt;
  core: number;
  tile: number;
  radius: number;
  tiles: Pt[];
  spokes: Route[];
};

// Tools sit at 22.5° + k·45° on one ring, so every spoke has the same length.
function layout(size: number, radius: number, tile: number, core: number): Layout {
  const c = size / 2;
  const center: Pt = [c, c];
  const tiles: Pt[] = [];
  const spokes: Route[] = [];
  for (let k = 0; k < 8; k++) {
    const a = ((-90 + 22.5 + k * 45) * Math.PI) / 180;
    const p: Pt = [c + radius * Math.cos(a), c + radius * Math.sin(a)];
    // Round tiles: a spoke meets each one at its radius.
    const edge = (half: number) => half;
    const from: Pt = [p[0] - Math.cos(a) * edge(tile / 2), p[1] - Math.sin(a) * edge(tile / 2)];
    const to: Pt = [c + Math.cos(a) * edge(core / 2), c + Math.sin(a) * edge(core / 2)];
    tiles.push(p);
    spokes.push(elbow([from, to]));
  }
  return { size: { w: size, h: size }, center, core, tile, radius, tiles, spokes };
}

const WIDE = layout(540, 200, 58, 92);
const COMPACT = layout(360, 132, 46, 72);

/* ------------------------------------------------------------------ */
/*  Timeline                                                           */
/* ------------------------------------------------------------------ */

// Turns alternate across the circle, so the eye keeps moving.
const ORDER = [0, 4, 2, 6, 1, 5, 3, 7];
const FIRST = 0.6;
const GAP = 0.55;
const HOLD = 2;

function timeline(l: Layout) {
  const sends: number[] = [];
  const lands: number[] = [];
  ORDER.forEach((slot, k) => {
    sends[slot] = FIRST + k * GAP;
    lands[slot] = sends[slot] + travel(l.spokes[slot]);
  });
  const fade = Math.max(...lands) + HOLD;
  return { sends, lands, fade, loop: fade + 0.8 };
}

const TIMES = { wide: timeline(WIDE), compact: timeline(COMPACT) };
const LOOP = Math.max(TIMES.wide.loop, TIMES.compact.loop);

/* ------------------------------------------------------------------ */
/*  Scene                                                              */
/* ------------------------------------------------------------------ */

function Scene({
  l,
  times,
  time,
  tools,
  center,
}: {
  l: Layout;
  times: ReturnType<typeof timeline>;
  time: MotionValue<number>;
  tools: OrbitTool[];
  center: Mark;
}) {
  const marks = React.useMemo(
    () => [...times.sends, ...times.lands, times.fade].sort((a, b) => a - b),
    [times],
  );
  const { n, lap } = useTicks(time, marks);
  const now = n === 0 ? 0 : marks[n - 1];
  const faded = now >= times.fade;
  const landed = faded ? 0 : times.lands.filter((t) => now >= t).length;
  const sending = (i: number) => !faded && now >= times.sends[i];
  const [cx, cy] = l.center;

  return (
    <>
      <svg className="absolute inset-0 overflow-visible" width={l.size.w} height={l.size.h} aria-hidden>
        {l.spokes.map((route, i) => (
          <Wire key={`w${i}`} route={route} />
        ))}
        {l.spokes.map((route, i) => (
          <React.Fragment key={`b${i}`}>
            <Trace route={route} time={time} start={times.sends[i]} fadeAt={times.fade} />
            <Beam route={route} time={time} start={times.sends[i]} />
          </React.Fragment>
        ))}
      </svg>

      {l.tiles.map((p, i) => (
        <div
          key={i}
          title={tools[i].name}
          className={cn(
            "absolute grid place-items-center rounded-full transition-[border-color] duration-300",
            card,
            sending(i) && "border-foreground/35 dark:border-white/40",
          )}
          style={{ left: p[0] - l.tile / 2, top: p[1] - l.tile / 2, width: l.tile, height: l.tile }}
        >
          <BrandMark mark={tools[i].mark} className="size-[44%] text-foreground" />
        </div>
      ))}

      {/* The model in the middle: every landing sends one ripple out */}
      <div
        className="absolute"
        style={{ left: cx - l.core / 2, top: cy - l.core / 2, width: l.core, height: l.core }}
      >
        <AnimatePresence>
          {landed > 0 ? (
            <motion.span
              key={`${lap}-${landed}`}
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full outline outline-[1.5px] outline-foreground/30 dark:outline-white/40"
              initial={{ outlineOffset: 0, opacity: 0.9 }}
              animate={{ outlineOffset: 18, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: EASE }}
            />
          ) : null}
        </AnimatePresence>
        <div className={cn("relative grid size-full place-items-center rounded-full", card)}>
          <BrandMark mark={center} className="size-[46%] text-foreground" />
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Illustration                                                       */
/* ------------------------------------------------------------------ */

export type IllustrationOrbitProps = {
  /** The AI model in the middle: a built-in brand id or { path, color }. */
  center?: Mark;
  /** Its name, for screen readers. */
  name?: string;
  /** Eight tools around it, clockwise from the top right. */
  tools?: OrbitTool[];
  /** Holds the animation where it is, e.g. to play only on hover. Before it first plays it shows the finished state. */
  paused?: boolean;
  className?: string;
};

function IllustrationOrbit({
  center = "claude",
  name = "Claude",
  tools = TOOLS,
  paused = false,
  className,
}: IllustrationOrbitProps) {
  const { ref, time } = useLoop(LOOP, TIMES.wide.fade - 0.3, paused);
  const list = tools.slice(0, 8);

  return (
    <MotionConfig reducedMotion="user">
      <figure ref={ref} className={cn("w-full font-sans text-foreground", className)}>
        <Diagram wide={WIDE.size} compact={COMPACT.size} compactBelow={520}>
          {({ compact }) => (
            <Scene
              l={compact ? COMPACT : WIDE}
              times={compact ? TIMES.compact : TIMES.wide}
              time={time}
              tools={list}
              center={center}
            />
          )}
        </Diagram>
        <figcaption className="sr-only">
          {name} connected to {list.map((t) => t.name).join(", ")}.
        </figcaption>
      </figure>
    </MotionConfig>
  );
}

export { IllustrationOrbit };
