"use client";

import * as React from "react";
import { useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Strong ease-out: responds at once, lands softly. */
export const EASE = [0.16, 1, 0.3, 1] as const;

/** One accent for meaning only. Retint by overriding --cta-accent. */
export const accentVars = "[--cta-accent:#2f6bff] dark:[--cta-accent:#5b8bff]";

/** The focus ring every control in the family shares. */
export const ring =
  "outline-none focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_oklab,var(--cta-accent)_30%,transparent)]";

// Placeholder links ("#") stay put instead of jumping or changing the URL.
// Real hrefs passed in by you navigate as usual.
export const preventPlaceholder = (event: React.MouseEvent<HTMLAnchorElement>) => {
  if (event.currentTarget.getAttribute("href") === "#") event.preventDefault();
};

const noop = () => () => {};

// The server cannot know the motion preference, so the first client render
// matches it (motion on) and the reduced state applies right after hydration.
export function useHydratedReduce() {
  const reduce = useReducedMotion() ?? false;
  const hydrated = React.useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  return hydrated && reduce;
}

export type CtaAction = { label: string; href: string };

/**
 * The primary action: solid ink, an arrow that leaves to the right and a
 * fresh one that slides in from the left on hover. Both arrows sit in one
 * fixed box, so the label never moves.
 */
export function PrimaryAction({
  action,
  className,
  ...rest
}: {
  action: CtaAction;
  className?: string;
} & Omit<React.ComponentProps<"a">, "href" | "children">) {
  return (
    <a
      {...rest}
      href={action.href}
      onClick={preventPlaceholder}
      className={cn(
        "group/primary inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-foreground pr-4 pl-5 text-[14.5px] font-medium text-background shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.12),0_8px_20px_-10px_rgba(0,0,0,0.45)] transition-[transform,opacity] duration-150 ease-out hover:opacity-[0.92] active:scale-[0.97]",
        ring,
        className,
      )}
    >
      {action.label}
      <span aria-hidden className="relative grid size-4 overflow-hidden">
        <ArrowRight
          className="col-start-1 row-start-1 size-4 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/primary:translate-x-[130%]"
          strokeWidth={2}
        />
        <ArrowRight
          className="col-start-1 row-start-1 size-4 -translate-x-[130%] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/primary:translate-x-0"
          strokeWidth={2}
        />
      </span>
    </a>
  );
}

/** The quieter second action: a light surface that sits on any field. */
export function SecondaryAction({
  action,
  className,
}: {
  action: CtaAction;
  className?: string;
}) {
  return (
    <a
      href={action.href}
      onClick={preventPlaceholder}
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-lg bg-background/70 px-5 text-[14.5px] font-medium text-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] transition-[transform,background-color] duration-150 ease-out hover:bg-background active:scale-[0.97] dark:bg-white/[0.06] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] dark:hover:bg-white/[0.1]",
        ring,
        className,
      )}
    >
      {action.label}
    </a>
  );
}

/* ------------------------------------------------------------------ */
/*  Field: a soft, slow color mesh with paper grain                    */
/* ------------------------------------------------------------------ */

const VERTEX = `attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

// Four colors drift through each other on a slow warped noise, like light
// on colored paper. The pointer carries a soft pool of light with it, and a
// fine static grain, one value per CSS pixel, keeps it matte.
const FRAGMENT = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;
uniform float uHover;
uniform float uFocus;
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform vec3 uLight;
uniform float uGrain;
uniform float uScale;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// Stops arrive in OKLab, so pastels blend through clean hues instead of
// greying out in the middle the way an RGB mix does.
vec3 toRgb(vec3 lab) {
  float l = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  vec3 lin = vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
  lin = clamp(lin, 0.0, 1.0);
  return mix(lin * 12.92, 1.055 * pow(lin, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, lin));
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes;
  vec2 p = frag / uRes.y;
  float t = uTime * 0.035;

#ifdef MATTE
  // One color, lit from the top left and falling into shade at the bottom
  // right, with a barely there drift in its tone. Stop 3 is unused.
  float n = noise(p * 1.4 + vec2(t, -t * 0.6)) * 0.65
    + noise(p * 3.1 - vec2(t * 0.4, t * 0.7)) * 0.35;
  vec3 lab = uC0;
  lab.x *= 0.97 + 0.06 * n;
  float key = 1.0 - smoothstep(0.0, 1.25, length((uv - vec2(0.02, 1.02)) * vec2(0.85, 1.25)));
  lab = mix(lab, uC1, key * 0.75);
  float shade = smoothstep(0.45, 1.45, length((uv - vec2(0.0, 1.0)) * vec2(0.8, 1.0)));
  lab = mix(lab, uC2, shade * 0.6);
#else
  // Warp the plane by itself so the shapes fold slowly instead of sliding
  vec2 q = vec2(
    noise(p * 1.1 + vec2(t, 0.0)),
    noise(p * 1.1 + vec2(5.2, 1.3) - t)
  );
  float a = noise(p * 0.8 + q * 1.8 + vec2(t * 0.5, -t * 0.3));
  float b = noise(p * 1.15 - q * 1.4 + vec2(-t * 0.4, t * 0.6) + 3.1);
  float c = noise(p * 0.7 + q * 1.1 + vec2(t * 0.3, t * 0.2) + 7.7);

  vec3 lab = mix(uC0, uC1, smoothstep(0.3, 0.7, a));
  lab = mix(lab, uC2, smoothstep(0.4, 0.75, b));
  lab = mix(lab, uC3, smoothstep(0.45, 0.8, c) * 0.9);
#endif

  vec2 dm = (frag - uPointer) / uRes.y;
  lab = mix(lab, uLight, clamp(0.45 * uHover * exp(-dot(dm, dm) * (5.0 + 6.0 * uFocus)), 0.0, 0.9));

  vec3 col = toRgb(lab);
  col += (hash(floor(frag / uScale)) - 0.5) * uGrain;
  gl_FragColor = vec4(col, 1.0);
}`;

/** Render at the device's pixel density, capped so big panels stay cheap. */
const density = () => Math.min(window.devicePixelRatio || 1, 2);

// Any CSS color (oklch, lab, hex) to OKLab, by painting one pixel.
function parseColor(value: string, fallback: [number, number, number]) {
  const ctx = document.createElement("canvas").getContext("2d");
  let rgb = fallback;
  if (ctx && value) {
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    rgb = [r / 255, g / 255, b / 255];
  }
  const [r, g, b] = rgb.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ] as [number, number, number];
}

/**
 * The shader field behind a panel. Colors come from CSS variables on any
 * ancestor (--field-0 … --field-3 and --field-light), so light and dark
 * palettes are plain Tailwind classes. It pauses off screen, holds still
 * under reduced motion, and follows the pointer inside `area`. An element
 * inside `area` marked `data-field-gather` pulls the light behind itself
 * while it is hovered or focused.
 */
export function Field({
  area,
  reduce,
  variant = "mesh",
  className,
}: {
  area: React.RefObject<HTMLElement | null>;
  reduce: boolean;
  /** mesh: four colors folding through each other. matte: one color
      (--field-0) with a key light (--field-1) and shade (--field-2). */
  variant?: "mesh" | "matte";
  className?: string;
}) {
  const ref = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = ref.current;
    const gl = canvas?.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    if (!canvas || !gl) return;

    const shader = (type: number, source: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      return s;
    };
    const vertex = shader(gl.VERTEX_SHADER, VERTEX);
    const define = variant === "matte" ? "#define MATTE\n" : "";
    const fragment = shader(gl.FRAGMENT_SHADER, define + FRAGMENT);
    const program = gl.createProgram()!;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    const release = () => {
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      release();
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = (name: string) => gl.getUniformLocation(program, name);
    const uRes = u("uRes"),
      uTime = u("uTime"),
      uPointer = u("uPointer"),
      uHover = u("uHover"),
      uFocus = u("uFocus"),
      uLight = u("uLight"),
      uGrain = u("uGrain"),
      uScale = u("uScale");
    const stops = [u("uC0"), u("uC1"), u("uC2"), u("uC3")];
    let ratio = density();

    let box = canvas.getBoundingClientRect();
    const resize = () => {
      box = canvas.getBoundingClientRect();
      ratio = density();
      gl.uniform1f(uScale, ratio);
      canvas.width = Math.max(1, Math.round(box.width * ratio));
      canvas.height = Math.max(1, Math.round(box.height * ratio));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    const paint = () => {
      const style = getComputedStyle(canvas);
      const dark = document.documentElement.classList.contains("dark");
      stops.forEach((stop, i) =>
        gl.uniform3fv(stop, parseColor(style.getPropertyValue(`--field-${i}`).trim(), [0.97, 0.96, 0.94])),
      );
      gl.uniform3fv(uLight, parseColor(style.getPropertyValue("--field-light").trim(), [1, 1, 1]));
      gl.uniform1f(uGrain, dark ? 0.03 : 0.04);
    };

    const target = { x: 0, y: 0, on: 0 };
    const pointer = { x: 0, y: 0, on: 0, focus: 0 };
    // While the main action is hovered or focused, the light gathers
    // behind it: brighter, tighter, and it stays put.
    let gather: { x: number; y: number } | null = null;
    let time = 24;
    let last = 0;
    let frame = 0;
    let visible = false;

    const draw = () => {
      gl.uniform1f(uTime, time);
      gl.uniform2f(uPointer, pointer.x, pointer.y);
      gl.uniform1f(uHover, pointer.on);
      gl.uniform1f(uFocus, pointer.focus);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = last ? Math.min(now - last, 100) / 1000 : 0;
      last = now;
      time += dt;
      const k = 1 - Math.exp(-dt * 3.5);
      const goal = gather ?? target;
      pointer.x += (goal.x - pointer.x) * k;
      pointer.y += (goal.y - pointer.y) * k;
      pointer.on += ((gather ? 1.9 : target.on) - pointer.on) * (1 - Math.exp(-dt * 2.5));
      pointer.focus += ((gather ? 1 : 0) - pointer.focus) * (1 - Math.exp(-dt * 3));
      draw();
    };
    const play = () => {
      if (reduce || !visible || frame) return;
      last = 0;
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      box = canvas.getBoundingClientRect();
      target.x = (event.clientX - box.left) * ratio;
      target.y = (box.bottom - event.clientY) * ratio;
      if (!target.on) {
        pointer.x = target.x;
        pointer.y = target.y;
      }
      target.on = 1;
    };
    const leave = () => {
      target.on = 0;
    };
    const host = area.current;
    host?.addEventListener("pointermove", move);
    host?.addEventListener("pointerleave", leave);

    const anchor = host?.querySelector<HTMLElement>("[data-field-gather]");
    const gatherOn = () => {
      if (!anchor) return;
      box = canvas.getBoundingClientRect();
      const r = anchor.getBoundingClientRect();
      gather = {
        x: (r.left + r.width / 2 - box.left) * ratio,
        y: (box.bottom - (r.top + r.height / 2)) * ratio,
      };
      if (!pointer.on) {
        pointer.x = gather.x;
        pointer.y = gather.y;
      }
      play();
    };
    const gatherOff = () => {
      gather = null;
    };
    anchor?.addEventListener("pointerenter", gatherOn);
    anchor?.addEventListener("pointerleave", gatherOff);
    anchor?.addEventListener("focus", gatherOn);
    anchor?.addEventListener("blur", gatherOff);

    resize();
    paint();
    draw();

    const sizes = new ResizeObserver(() => {
      resize();
      draw();
    });
    sizes.observe(canvas);
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) play();
      else stop();
    });
    seen.observe(canvas);
    const themes = new MutationObserver(() => {
      paint();
      draw();
    });
    themes.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      stop();
      host?.removeEventListener("pointermove", move);
      host?.removeEventListener("pointerleave", leave);
      anchor?.removeEventListener("pointerenter", gatherOn);
      anchor?.removeEventListener("pointerleave", gatherOff);
      anchor?.removeEventListener("focus", gatherOn);
      anchor?.removeEventListener("blur", gatherOff);
      sizes.disconnect();
      seen.disconnect();
      themes.disconnect();
      gl.deleteBuffer(buffer);
      release();
    };
  }, [reduce, area, variant]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 size-full bg-[linear-gradient(135deg,var(--field-0),var(--field-1)_40%,var(--field-2)_70%,var(--field-3))]",
        className,
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Odometer: digits that roll to a new value                          */
/* ------------------------------------------------------------------ */

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * A number whose digits roll like an odometer, up when rising and down when
 * falling. Digits are keyed from the right, so a new leading digit slides
 * in without resetting the others. Each digit is a full 1em box with
 * tabular figures, so nothing around it moves.
 */
export function Odometer({
  value,
  format = (n) => n.toLocaleString("en-US"),
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const text = format(value);
  const chars = text.split("");
  return (
    <span className={cn("inline-flex leading-none tabular-nums", className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="inline-flex">
        {chars.map((char, i) => {
          const key = chars.length - i;
          const digit = DIGITS.indexOf(char);
          if (digit < 0) {
            return (
              <span key={`s${key}`} className="inline-block h-[1em] leading-none">
                {char}
              </span>
            );
          }
          return (
            <span key={`d${key}`} className="relative inline-block h-[1em] overflow-hidden leading-none">
              <span className="invisible">0</span>
              <span
                className="absolute inset-x-0 top-0 flex flex-col transition-transform duration-[650ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                style={{ transform: `translateY(-${digit}em)` }}
              >
                {DIGITS.map((d) => (
                  <span key={d} className="h-[1em] leading-none">
                    {d}
                  </span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Grain and window light: CSS-only surfaces                          */
/* ------------------------------------------------------------------ */

/** Fine paper grain as an SVG noise tile. Static, cheap, any size. */
export const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/**
 * Daylight through blinds falling across a wall: soft diagonal bands of
 * light over a warm color, fading toward the edges, with paper grain.
 * The bands drift a few pixels over half a minute, like a cloud passing.
 * Colors come from --wall (the surface) and --wall-light (the light).
 */
/** Wall tones for WindowLight: a warm plaster by day, dusk in dark mode. */
export const wallTones = {
  plaster: "[--wall:#e4d6c0] [--wall-light:#fffaf0] dark:[--wall:#151519] dark:[--wall-light:#303038]",
} as const;

export function WindowLight({ reduce, className }: { reduce: boolean; className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden bg-(--wall)", className)}>
      <div className="absolute inset-0 [mask-image:radial-gradient(130%_110%_at_68%_10%,black_30%,transparent_80%)]">
        <div
          className={cn(
            "absolute -inset-[30%] rotate-[-28deg] opacity-90 blur-[10px]",
            !reduce && "animate-[cta-window_32s_ease-in-out_infinite_alternate]",
          )}
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent 0 40px, var(--wall-light) 52px 104px, transparent 116px 150px)",
          }}
        />
      </div>
      {/* A soft key light from the top right, where the window is. */}
      <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_85%_0%,color-mix(in_oklab,var(--wall-light)_55%,transparent),transparent_70%)]" />
      <div
        className="absolute inset-0 opacity-[0.08] mix-blend-multiply dark:opacity-[0.12] dark:mix-blend-screen"
        style={{ backgroundImage: GRAIN }}
      />
      <style>{`@keyframes cta-window { from { transform: rotate(-28deg) translateX(0); } to { transform: rotate(-28deg) translateX(28px); } }`}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dither: an ordered-dither print, like a risograph                  */
/* ------------------------------------------------------------------ */

/** Paper and ink for Dither. Kept in the kit so Tailwind always sees them. */
export const ditherTones = {
  riso: "[--dither-paper:#f2ede3] [--dither-ink:#d2582f] [--cta-accent:#b8481f] dark:[--dither-paper:#131315] dark:[--dither-ink:#7a3a22] dark:[--cta-accent:#e8865c]",
} as const;

const BAYER = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54,
  22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29,
  53, 21,
].map((v) => (v + 0.5) / 64);

/**
 * Ink dithered onto paper with an 8x8 Bayer matrix, densest along the
 * right edge (the bottom on narrow panels) and gone before the copy. It
 * develops once, like a print coming up, when it first scrolls into view.
 * Colors come from --dither-paper and --dither-ink.
 */
export function Dither({ reduce, className }: { reduce: boolean; className?: string }) {
  const ref = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const CELL = 2;
    const BAND = 150;
    let develop = reduce ? 1 : 0;
    let frame = 0;

    const paint = () => {
      const box = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(box.width * ratio));
      canvas.height = Math.max(1, Math.round(box.height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const style = getComputedStyle(canvas);
      ctx.fillStyle = style.getPropertyValue("--dither-paper").trim() || "#f2ede3";
      ctx.fillRect(0, 0, box.width, box.height);
      ctx.fillStyle = style.getPropertyValue("--dither-ink").trim() || "#d2582f";
      const wide = box.width >= 900;
      const cols = Math.ceil(box.width / CELL);
      const rows = Math.ceil(box.height / CELL);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const u = x / cols;
          const v = y / rows;
          // Distance into the inked side, bent by two slow waves so the
          // edge is a soft coastline, never a ruler line.
          const across = wide ? v : u;
          const wave = 0.09 * Math.sin(across * 5.1 + 1.3) + 0.05 * Math.sin(across * 13.7 + 0.4);
          // On narrow panels the ink keeps to a band along the bottom edge,
          // below the copy, measured in pixels rather than a share.
          const along = wide ? (u - 0.58) / 0.42 : (y * CELL - (box.height - BAND)) / BAND;
          const t = Math.max(0, Math.min(1, along + wave)) ** 1.35 * develop;
          if (t > BAYER[(y % 8) * 8 + (x % 8)]) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      }
    };

    const run = () => {
      const start = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / 1400);
        develop = 1 - Math.pow(1 - p, 3);
        paint();
        if (p < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };

    paint();
    const seen = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || develop === 1) return;
      seen.disconnect();
      run();
    }, { threshold: 0.3 });
    if (develop < 1) seen.observe(canvas);
    const sizes = new ResizeObserver(() => paint());
    sizes.observe(canvas);
    const themes = new MutationObserver(() => paint());
    themes.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      cancelAnimationFrame(frame);
      seen.disconnect();
      sizes.disconnect();
      themes.disconnect();
    };
  }, [reduce]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 size-full bg-(--dither-paper) [image-rendering:pixelated]", className)}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Sweep: a photo-studio backdrop                                      */
/* ------------------------------------------------------------------ */

/** Sweep colors. Kept in the kit so Tailwind always sees them. */
export const sweepTones = {
  fog: "[--sweep:#d6dfe9] [--sweep-light:#f6f9fc] [--sweep-shade:#b9c6d4] dark:[--sweep:#181d24] dark:[--sweep-light:#2a323d] dark:[--sweep-shade:#0d1014]",
} as const;

/**
 * A seamless studio backdrop: the wall falls into a bright curve about a
 * third of the way down (where an object stands) and then the floor, lit
 * from above the middle, with paper grain. Static, CSS only.
 * Colors come from --sweep, --sweep-light and --sweep-shade.
 */
export function Sweep({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,var(--sweep)_0%,color-mix(in_oklab,var(--sweep)_65%,var(--sweep-light))_26%,var(--sweep-light)_38%,color-mix(in_oklab,var(--sweep)_55%,var(--sweep-light))_52%,var(--sweep)_75%,color-mix(in_oklab,var(--sweep)_80%,var(--sweep-shade))_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_0%,color-mix(in_oklab,var(--sweep-light)_80%,transparent),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_120%,color-mix(in_oklab,var(--sweep-shade)_55%,transparent),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(130%_100%_at_50%_45%,transparent_55%,color-mix(in_oklab,var(--sweep-shade)_45%,transparent)_100%)]" />
      <div
        className="absolute inset-0 opacity-[0.07] mix-blend-multiply dark:opacity-[0.1] dark:mix-blend-screen"
        style={{ backgroundImage: GRAIN }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Paper: a plain sheet with grain                                     */
/* ------------------------------------------------------------------ */

/** Paper colors. Kept in the kit so Tailwind always sees them. */
export const paperTones = {
  warm: "[--paper:#f4f0e7] [--paper-edge:#e8e1d2] [--mark:color-mix(in_oklab,#facc15_45%,transparent)] dark:[--paper:#141413] dark:[--paper-edge:#0c0c0b] dark:[--mark:color-mix(in_oklab,#fcd34d_30%,transparent)]",
} as const;

/** A sheet of paper: flat color, a faint vignette toward the edges, grain. */
export function Paper({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden bg-(--paper)", className)}>
      <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_40%,transparent_55%,var(--paper-edge)_100%)]" />
      <div
        className="absolute inset-0 opacity-[0.09] mix-blend-multiply dark:opacity-[0.1] dark:mix-blend-screen"
        style={{ backgroundImage: GRAIN }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hatch: an ink strip with fine engraved lines                        */
/* ------------------------------------------------------------------ */

/** Hatch colors. Kept in the kit so Tailwind always sees them. */
export const hatchTones = {
  ink: "[--hatch-base:#14213d] [--hatch-line:rgba(255,255,255,0.09)] [--hatch-light:#24365c] dark:[--hatch-base:#101a30] dark:[--hatch-line:rgba(255,255,255,0.07)] dark:[--hatch-light:#1c2b4a]",
} as const;

/**
 * A solid ink surface with fine diagonal lines, like an engraved plate,
 * fading in from the right edge, a soft light on that side and grain.
 * Static, CSS only. Colors come from --hatch-base, --hatch-line, --hatch-light.
 */
export function Hatch({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden bg-(--hatch-base)", className)}>
      <div className="absolute inset-0 bg-[radial-gradient(60%_140%_at_100%_50%,var(--hatch-light),transparent_70%)]" />
      <div
        className="absolute inset-0 [mask-image:linear-gradient(to_left,black,transparent_65%)]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-45deg, var(--hatch-line) 0 1px, transparent 1px 7px)",
        }}
      />
      <div className="absolute inset-0 opacity-[0.12] mix-blend-screen" style={{ backgroundImage: GRAIN }} />
    </div>
  );
}
