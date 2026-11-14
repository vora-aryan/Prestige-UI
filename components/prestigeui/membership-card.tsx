"use client";

import * as React from "react";
import { animate, motion, useInView, useMotionTemplate, useMotionValue, useSpring, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

export interface MembershipCardProps {
  /** The member's name, printed on the card. */
  name: string;
  /** Membership number, shown large. Default "0042". */
  number?: string;
  /** Tier, top right. Default "Founding member". */
  tier?: string;
  /** When they joined. Default "Nov 2026". */
  since?: string;
  /** Your brand, top left: a logo or a wordmark. */
  brand?: React.ReactNode;
  /** Card material. Default "graphite". */
  tone?: "graphite" | "pearl";
  /** Sweeps the light across once when the card comes into view. Default true. */
  intro?: boolean;
  className?: string;
}

const MAX_TILT = 11; // degrees
const SPRING = { stiffness: 170, damping: 20, mass: 0.6 };

/* ------------------------------------------------------------------ */
/*  Security print: guilloche lines, drawn once as an SVG mask         */
/* ------------------------------------------------------------------ */

const W = 856;
const H = 540;
const r1 = (n: number) => Math.round(n * 10) / 10;

function wavePath(i: number) {
  // A band of fine waves across the card, each a little out of phase.
  // Sits in the open band between the brand row and the number.
  const base = 150 + i * 7.5;
  const phase = i * 0.32;
  let d = `M0 ${r1(base)}`;
  for (let x = 0; x <= W; x += 8) {
    const y = base + Math.sin(x / 58 + phase) * 22 + Math.sin(x / 23 + phase * 1.7) * 5;
    d += ` L${x} ${r1(y)}`;
  }
  return d;
}

function rosettePath(k: number) {
  // A rosette like the ones on banknotes: an epitrochoid, rotated per layer.
  // Right of centre, clear of the tier label above and the date below.
  const cx = 650;
  const cy = 262;
  const R = 112 - k * 9;
  const a = 26 - k * 1.2;
  const lobes = 18;
  const rot = k * 0.11;
  let d = "";
  for (let s = 0; s <= 720; s++) {
    const t = (s / 720) * Math.PI * 2;
    const r = R + a * Math.sin(lobes * t);
    const x = cx + r * Math.cos(t + rot);
    const y = cy + r * Math.sin(t + rot);
    d += `${s ? "L" : "M"}${r1(x)} ${r1(y)}`;
  }
  return d + "Z";
}

const PRINT_SVG = (() => {
  const waves = Array.from({ length: 14 }, (_, i) => wavePath(i)).join(" ");
  const rosette = Array.from({ length: 7 }, (_, k) => rosettePath(k)).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><g fill="none" stroke="#000" stroke-width="1.15"><path d="${waves}"/><path d="${rosette}"/></g></svg>`;
})();
const PRINT_MASK = `url("data:image/svg+xml;utf8,${encodeURIComponent(PRINT_SVG)}")`;

/* ------------------------------------------------------------------ */

function subscribeReduced(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

const TONES = {
  graphite: {
    base: "linear-gradient(155deg, #3a3b3f 0%, #232427 46%, #17181a 100%)",
    brushed: "rgba(255,255,255,0.022)",
    ink: "rgba(255,255,255,0.92)",
    muted: "rgba(255,255,255,0.52)",
    print: "rgba(255,255,255,0.07)",
    edge: "rgba(255,255,255,0.22)",
    glare: "rgba(255,255,255,0.16)",
    // Light lines brightening on dark metal.
    foil: "linear-gradient(115deg, transparent 38%, #efe3c6 44%, #ffffff 48%, #cfe1ee 52%, #e4dac6 56%, transparent 62%)",
    foilBlend: "screen",
    foilOpacity: 0.62,
  },
  pearl: {
    base: "linear-gradient(155deg, #f7f6f2 0%, #ecebe6 50%, #dedcd5 100%)",
    brushed: "rgba(0,0,0,0.025)",
    ink: "rgba(20,20,22,0.9)",
    muted: "rgba(20,20,22,0.5)",
    print: "rgba(0,0,0,0.1)",
    edge: "rgba(255,255,255,0.9)",
    glare: "rgba(255,255,255,0.55)",
    // On a light card the print catches as a deeper champagne and steel.
    foil: "linear-gradient(115deg, transparent 38%, #b8a272 44%, #8d8d8d 48%, #7f9cb3 52%, #b3a37c 56%, transparent 62%)",
    foilBlend: "multiply",
    foilOpacity: 0.85,
  },
} as const;

export function MembershipCard({
  name,
  number = "0042",
  tier = "Founding member",
  since = "Nov 2026",
  brand,
  tone = "graphite",
  intro = true,
  className,
}: MembershipCardProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const t = TONES[tone];
  const reduce = React.useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  const inView = useInView(ref, { once: true, amount: 0.6 });

  // Where the light is, 0 to 1 across and down the card. It drives the tilt,
  // the glare and the foil together, so they always agree.
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, SPRING);
  const sy = useSpring(py, SPRING);
  const rotateY = useTransform(sx, [0, 1], [-MAX_TILT, MAX_TILT]);
  const rotateX = useTransform(sy, [0, 1], [MAX_TILT * 0.8, -MAX_TILT * 0.8]);
  const glareX = useTransform(sx, (v) => `${v * 100}%`);
  const glareY = useTransform(sy, (v) => `${v * 100}%`);
  // The foil band travels a little further than the pointer, so a small
  // tilt sweeps a lot of light, like a real foil.
  // Mapped so the band of light stays on the card for every pointer
  // position: from the far right edge to the far left as you cross it.
  const foilPos = useTransform([sx, sy], ([x, y]: number[]) => `${(0.82 - x * 0.74) * 100}% ${(0.82 - y * 0.74) * 100}%`);
  const shadowX = useTransform(sx, [0, 1], [10, -10]);
  const shadowY = useTransform(sy, [0, 1], [26, 14]);
  const shadow = useMotionTemplate`0 ${shadowY}px 40px -18px rgba(0,0,0,0.55), ${shadowX}px ${shadowY}px 24px -20px rgba(0,0,0,0.35)`;
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, ${t.glare}, transparent 55%)`;

  // One slow sweep of light the first time the card is seen.
  React.useEffect(() => {
    if (!intro || reduce || !inView) return;
    px.set(0.08);
    py.set(0.35);
    const a = animate(px, [0.08, 0.92, 0.5], { duration: 2.2, ease: [0.45, 0, 0.25, 1], times: [0, 0.7, 1], delay: 0.3 });
    const b = animate(py, [0.35, 0.6, 0.5], { duration: 2.2, ease: [0.45, 0, 0.25, 1], times: [0, 0.7, 1], delay: 0.3 });
    return () => {
      a.stop();
      b.stop();
    };
  }, [intro, reduce, inView, px, py]);

  const move = (event: React.PointerEvent) => {
    if (reduce) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    px.set(Math.min(1, Math.max(0, (event.clientX - r.left) / r.width)));
    py.set(Math.min(1, Math.max(0, (event.clientY - r.top) / r.height)));
  };
  const rest = () => {
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <div
      ref={ref}
      className={cn("w-[420px] max-w-full touch-pan-y select-none [perspective:1000px]", className)}
      onPointerMove={move}
      onPointerLeave={rest}
      onPointerCancel={rest}
      onPointerUp={(e) => e.pointerType !== "mouse" && rest()}
    >
      <motion.div
        role="img"
        aria-label={`${tier} card for ${name}, member number ${number}, member since ${since}`}
        className="relative aspect-[85.6/54] w-full overflow-hidden [container-type:inline-size] will-change-transform"
        style={{
          rotateX: reduce ? 0 : rotateX,
          rotateY: reduce ? 0 : rotateY,
          // Square-ish like the house panels: about 8px at full size.
          // In percent of its own size (container units here would read an
          // ancestor), so it scales with the card: 8px at 420px wide.
          borderRadius: "1.9% / 3.01%",
          background: t.base,
          boxShadow: reduce ? "0 22px 40px -18px rgba(0,0,0,0.5)" : shadow,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Brushed metal: fine horizontal grain. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, ${t.brushed} 0 0.5px, transparent 0.5px 2px)`,
          }}
        />

        {/* Security print, always faintly there. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: t.print,
            WebkitMaskImage: PRINT_MASK,
            maskImage: PRINT_MASK,
            WebkitMaskSize: "100% 100%",
            maskSize: "100% 100%",
          }}
        />

        {/* Foil: a soft pearl band that lights the print where the light falls. */}
        <motion.div
          aria-hidden
          className="absolute inset-0"
          style={{
            mixBlendMode: t.foilBlend,
            backgroundImage: t.foil,
            backgroundSize: "260% 260%",
            backgroundPosition: reduce ? "50% 50%" : foilPos,
            opacity: t.foilOpacity,
            WebkitMaskImage: PRINT_MASK,
            maskImage: PRINT_MASK,
            WebkitMaskSize: "100% 100%",
            maskSize: "100% 100%",
          }}
        />

        {/* Glare across the whole surface. */}
        {!reduce && (
          <motion.div aria-hidden className="absolute inset-0 mix-blend-overlay" style={{ backgroundImage: glare }} />
        )}

        {/* Top-lit edge. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            borderRadius: "inherit",
            boxShadow: `inset 0 1px 0 ${t.edge}, inset 0 0 0 1px rgba(255,255,255,0.05)`,
          }}
        />

        {/* Printed content, laid out in card units so it scales as one object. */}
        <div
          className="absolute inset-0 flex flex-col justify-between"
          style={{ padding: "6.5cqw 7cqw", color: t.ink }}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center font-medium" style={{ fontSize: "4.6cqw", gap: "2cqw", letterSpacing: "-0.01em" }}>
              {brand ?? <DefaultBrand />}
            </div>
            <span style={{ fontSize: "3cqw", color: t.muted, letterSpacing: "0.01em" }}>{tier}</span>
          </div>

          <div>
            <div className="tabular-nums" style={{ fontSize: "9.5cqw", fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1 }}>
              {number}
            </div>
            <div className="flex items-end justify-between" style={{ marginTop: "5cqw" }}>
              <div>
                <div style={{ fontSize: "2.7cqw", color: t.muted }}>Member</div>
                <div className="font-medium" style={{ fontSize: "4.2cqw", marginTop: "0.6cqw", letterSpacing: "-0.01em" }}>
                  {name}
                </div>
              </div>
              <div className="text-right">
                <div style={{ fontSize: "2.7cqw", color: t.muted }}>Since</div>
                <div className="tabular-nums font-medium" style={{ fontSize: "4.2cqw", marginTop: "0.6cqw" }}>
                  {since}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/** The Prestige mark and wordmark, shaded from the card's own ink so it reads on graphite and pearl. */
function DefaultBrand() {
  return (
    <>
      <svg viewBox="245 214 764 764" aria-hidden style={{ width: "1.3em", height: "1.3em" }}>
        <path
          d="M626 222 961 414V772L622 975 519 917V780L628 835 838 712V481L628 357 413 481V866L292 798V414Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="14"
          strokeLinejoin="round"
        />
        <path d="M627 478 734 539 627 600 520 539Z" fill="currentColor" opacity="0.62" />
        <path d="M520 539 627 600V720L520 659Z" fill="currentColor" opacity="0.4" />
        <path d="M627 600 734 539V659L627 720Z" fill="currentColor" opacity="0.22" />
      </svg>
      Prestige UI
    </>
  );
}
