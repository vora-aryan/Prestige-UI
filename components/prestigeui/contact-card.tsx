"use client";

import * as React from "react";
import { animate, motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "motion/react";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ContactCardProps {
  /** Full name, printed on the front. */
  name: string;
  /** Role or title, under the name. */
  role?: string;
  /** Company, used in the saved contact. Default "Prestige UI". */
  company?: string;
  email?: string;
  /** Phone number as people should read it, e.g. "+49 30 1234 5678". */
  phone?: string;
  /** Website without the protocol, e.g. "prestigeui.com". */
  website?: string;
  /** City or "Remote". */
  location?: string;
  /** Your brand, top left of the front. Default: the Prestige mark and wordmark. */
  brand?: React.ReactNode;
  /** Card stock. Default "paper". */
  tone?: "paper" | "ink";
  /** Controlled side: true shows the back. */
  flipped?: boolean;
  /** Fires when the card asks to turn over. */
  onFlippedChange?: (flipped: boolean) => void;
  className?: string;
}

const FLIP_SPRING = { stiffness: 140, damping: 19, mass: 0.9 };
const TILT_SPRING = { stiffness: 170, damping: 20, mass: 0.6 };
const MAX_TILT = 5;

/* ------------------------------------------------------------------ */
/*  QR code: a small real encoder (byte mode, error correction M)       */
/* ------------------------------------------------------------------ */

const ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26];
const BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16];

function rawModules(ver: number) {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const align = Math.floor(ver / 7) + 2;
    result -= (25 * align - 10) * align - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}
const dataCodewords = (ver: number) => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver] * BLOCKS[ver];

function gfMul(x: number, y: number) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree: number) {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]) {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => (result[i] ^= gfMul(coef, factor)));
  }
  return result;
}

function encodeQr(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text));
  let ver = 1;
  for (; ver <= 20; ver++) {
    const countBits = ver < 10 ? 8 : 16;
    if (4 + countBits + bytes.length * 8 <= dataCodewords(ver) * 8) break;
  }
  if (ver > 20) throw new Error("ContactCard: contact details too long for the QR code");
  const size = ver * 4 + 17;

  // Data bits: byte mode, length, bytes, terminator, padding.
  const bits: number[] = [];
  const push = (value: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach((b) => push(b, 8));
  const capacity = dataCodewords(ver) * 8;
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));

  // Error correction, split into blocks and interleaved.
  const numBlocks = BLOCKS[ver];
  const eccLen = ECC_PER_BLOCK[ver];
  const raw = Math.floor(rawModules(ver) / 8);
  const shortBlocks = numBlocks - (raw % numBlocks);
  const shortLen = Math.floor(raw / numBlocks);
  const divisor = rsDivisor(eccLen);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < shortBlocks ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, divisor);
    if (i < shortBlocks) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const codewords: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortLen - eccLen || j >= shortBlocks) codewords.push(block[i]);
    });
  }

  // Function patterns.
  const modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, dark: boolean) => {
    modules[y][x] = dark;
    fixed[y][x] = true;
  };
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ]) {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, dist !== 2 && dist !== 4);
      }
  }
  if (ver > 1) {
    const count = Math.floor(ver / 7) + 2;
    const step = Math.ceil((ver * 4 + 4) / (count * 2 - 2)) * 2;
    const pos = [6];
    for (let p = size - 7; pos.length < count; p -= step) pos.splice(1, 0, p);
    pos.forEach((y, i) =>
      pos.forEach((x, j) => {
        if ((i === 0 && j === 0) || (i === 0 && j === count - 1) || (i === count - 1 && j === 0)) return;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) set(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }),
    );
  }
  const drawFormat = (mask: number) => {
    const formatData = (0 << 3) | mask; // error correction M = 0
    let rem = formatData;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const f = ((formatData << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((f >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  drawFormat(0);
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const v = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((v >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, dark);
      set(b, a, dark);
    }
  }

  // Codewords, in the zigzag order.
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!fixed[y][x] && i < codewords.length * 8) {
          modules[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
          i++;
        }
      }
    }
  }

  // Masks: try all eight, keep the easiest to scan.
  const maskAt = (m: number, x: number, y: number) =>
    [
      (x + y) % 2 === 0,
      y % 2 === 0,
      x % 3 === 0,
      (x + y) % 3 === 0,
      (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
      ((x * y) % 2) + ((x * y) % 3) === 0,
      (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
      (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
    ][m];
  const applyMask = (m: number) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fixed[y][x] && maskAt(m, x, y)) modules[y][x] = !modules[y][x];
  };
  const penalty = () => {
    let score = 0;
    for (let y = 0; y < size; y++) {
      for (let run = 1, x = 1; x <= size; x++) {
        if (x < size && modules[y][x] === modules[y][x - 1]) run++;
        else {
          if (run >= 5) score += run - 2;
          run = 1;
        }
      }
    }
    for (let x = 0; x < size; x++) {
      for (let run = 1, y = 1; y <= size; y++) {
        if (y < size && modules[y][x] === modules[y - 1][x]) run++;
        else {
          if (run >= 5) score += run - 2;
          run = 1;
        }
      }
    }
    let dark = 0;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        if (modules[y][x]) dark++;
        if (x < size - 1 && y < size - 1) {
          const c = modules[y][x];
          if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) score += 3;
        }
      }
    score += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
    return score;
  };
  let best = 0;
  let bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(m);
    drawFormat(m);
    const s = penalty();
    if (s < bestScore) {
      bestScore = s;
      best = m;
    }
    applyMask(m);
  }
  applyMask(best);
  drawFormat(best);
  return modules;
}

function vcard({ name, role, company, email, phone, website }: ContactCardProps) {
  const esc = (v: string) => v.replace(/([,;\\])/g, "\\$1");
  const parts = name.trim().split(/\s+/);
  const last = parts.length > 1 ? parts.pop() : "";
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${esc(last ?? "")};${esc(parts.join(" "))}`,
    `FN:${esc(name)}`,
    company && `ORG:${esc(company)}`,
    role && `TITLE:${esc(role)}`,
    phone && `TEL;TYPE=WORK:${phone.replace(/[^\d+]/g, "")}`,
    email && `EMAIL:${email}`,
    website && `URL:https://${website}`,
    "END:VCARD",
  ]
    .filter(Boolean)
    .join("\n");
}

function QrCode({ value, className, style }: { value: string; className?: string; style?: React.CSSProperties }) {
  const d = React.useMemo(() => {
    const m = encodeQr(value);
    let path = "";
    m.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) path += `M${x} ${y}h1v1h-1z`;
      }),
    );
    return { path, size: m.length };
  }, [value]);
  const quiet = 2;
  return (
    <svg
      viewBox={`${-quiet} ${-quiet} ${d.size + quiet * 2} ${d.size + quiet * 2}`}
      className={className}
      style={style}
      shapeRendering="crispEdges"
      aria-hidden
    >
      <path d={d.path} fill="currentColor" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */

const PAPER_GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>',
)}")`;

const TONES = {
  paper: {
    stock: "linear-gradient(160deg, #fbfaf6 0%, #f3f1ea 100%)",
    grain: 0.09,
    ink: "#18181b",
    muted: "rgba(24,24,27,0.52)",
    line: "rgba(24,24,27,0.1)",
    edge: "rgba(255,255,255,0.9)",
    qrTile: "transparent",
  },
  ink: {
    stock: "linear-gradient(160deg, #232427 0%, #161618 100%)",
    grain: 0.14,
    ink: "rgba(255,255,255,0.92)",
    muted: "rgba(255,255,255,0.5)",
    line: "rgba(255,255,255,0.1)",
    edge: "rgba(255,255,255,0.14)",
    qrTile: "#f6f5f0",
  },
} as const;

function subscribeReduced(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

export function ContactCard(props: ContactCardProps) {
  const {
    name,
    role = "Founder",
    company = "Prestige UI",
    email,
    phone,
    website,
    location,
    brand,
    tone = "paper",
    flipped: flippedProp,
    onFlippedChange,
    className,
  } = props;
  const t = TONES[tone];
  const [flippedState, setFlippedState] = React.useState(false);
  const flipped = flippedProp ?? flippedState;
  const setFlipped = (next: boolean) => {
    if (flippedProp === undefined) setFlippedState(next);
    onFlippedChange?.(next);
  };
  const reduce = React.useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  const frontButton = React.useRef<HTMLButtonElement>(null);
  const backButton = React.useRef<HTMLButtonElement>(null);
  const turnedByKey = React.useRef(false);

  // The turn: a spring on the angle, with the card lifting toward you
  // halfway through and each face darkening as it goes edge-on.
  const angle = useMotionValue(flipped ? 180 : 0);
  React.useEffect(() => {
    const controls = animate(angle, flipped ? 180 : 0, reduce ? { duration: 0 } : { type: "spring", ...FLIP_SPRING });
    return () => controls.stop();
  }, [flipped, reduce, angle]);
  const turn = useTransform(angle, (a) => Math.abs(Math.sin((a * Math.PI) / 180)));
  const lift = useTransform(turn, [0, 1], [1, 1.06]);
  const shade = useTransform(turn, [0, 1], [0, 0.32]);
  const shadowY = useTransform(turn, [0, 1], [20, 42]);
  const shadowBlur = useTransform(turn, [0, 1], [36, 64]);
  const shadow = useMotionTemplate`0 ${shadowY}px ${shadowBlur}px -22px rgba(0,0,0,0.42), 0 2px 6px -2px rgba(0,0,0,0.12)`;

  // A small tilt toward the pointer, so the card feels held.
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const tiltY = useTransform(useSpring(px, TILT_SPRING), [0, 1], [-MAX_TILT, MAX_TILT]);
  const tiltX = useTransform(useSpring(py, TILT_SPRING), [0, 1], [MAX_TILT, -MAX_TILT]);
  const rotateY = useTransform([angle, tiltY], ([a, ty]: number[]) => a + ty);

  // Keyboard users keep their place: focus follows to the turn button on
  // the side that comes up.
  React.useEffect(() => {
    if (!turnedByKey.current) return;
    turnedByKey.current = false;
    (flipped ? backButton : frontButton).current?.focus({ preventScroll: true });
  }, [flipped]);

  const flipFrom = (event: React.MouseEvent | React.KeyboardEvent, next: boolean) => {
    if ("detail" in event && event.detail === 0) turnedByKey.current = true;
    if ("key" in event) turnedByKey.current = true;
    setFlipped(next);
  };

  const onCardClick = (event: React.MouseEvent) => {
    // A click on the card itself turns it; links and buttons keep their job.
    if ((event.target as HTMLElement).closest("a, button")) return;
    if (window.getSelection()?.toString()) return;
    setFlipped(!flipped);
  };

  const rows = [
    email && { label: "Email", value: email, href: `mailto:${email}` },
    phone && { label: "Phone", value: phone, href: `tel:${phone.replace(/[^\d+]/g, "")}` },
    website && { label: "Website", value: website, href: `https://${website}` },
    location && { label: "Based in", value: location },
  ].filter(Boolean) as { label: string; value: string; href?: string }[];

  const face = "absolute inset-0 overflow-hidden [backface-visibility:hidden] [-webkit-backface-visibility:hidden]";
  const faceStyle = {
    background: t.stock,
    borderRadius: "1.9% / 3.01%",
    color: t.ink,
    boxShadow: `inset 0 1px 0 ${t.edge}, inset 0 0 0 1px ${t.line}`,
  };
  const grain = (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 mix-blend-multiply"
      style={{ backgroundImage: PAPER_GRAIN, opacity: t.grain, ...(tone === "ink" && { mixBlendMode: "screen" }) }}
    />
  );
  const shading = (
    <motion.div aria-hidden className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: reduce ? 0 : shade }} />
  );

  return (
    <div
      className={cn("w-[420px] max-w-full select-none [container-type:inline-size] [perspective:1200px]", className)}
      onPointerMove={(event) => {
        if (reduce || event.pointerType !== "mouse") return;
        const r = event.currentTarget.getBoundingClientRect();
        px.set((event.clientX - r.left) / r.width);
        py.set((event.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => {
        px.set(0.5);
        py.set(0.5);
      }}
    >
      <motion.div
        className="relative aspect-[85/55] w-full cursor-pointer [transform-style:preserve-3d]"
        style={{
          rotateY: reduce ? (flipped ? 180 : 0) : rotateY,
          rotateX: reduce ? 0 : tiltX,
          scale: reduce ? 1 : lift,
          borderRadius: "1.9% / 3.01%",
          boxShadow: reduce ? "0 20px 36px -22px rgba(0,0,0,0.42)" : shadow,
        }}
        onClick={onCardClick}
      >
        {/* Front */}
        <section
          aria-label={`${name}, ${role}`}
          className={face}
          style={faceStyle}
          inert={flipped}
          aria-hidden={flipped}
        >
          {grain}
          <div className="relative flex h-full flex-col justify-between" style={{ padding: "7cqw 7.5cqw" }}>
            <div className="flex items-start justify-between" style={{ gap: "4cqw" }}>
              <div className="flex items-center font-medium" style={{ fontSize: "3.9cqw", gap: "1.8cqw", letterSpacing: "-0.01em" }}>
                {brand ?? <DefaultBrand />}
              </div>
              {(website || location) && (
                <span className="truncate" style={{ fontSize: "2.9cqw", color: t.muted, marginTop: "0.6cqw" }}>
                  {website ?? location}
                </span>
              )}
            </div>
            <div className="flex items-end justify-between" style={{ gap: "4cqw" }}>
              <div className="min-w-0">
                <div className="font-medium" style={{ fontSize: "6.4cqw", letterSpacing: "-0.025em", lineHeight: 1.05 }}>
                  {name}
                </div>
                <div style={{ fontSize: "3.4cqw", color: t.muted, marginTop: "1.4cqw" }}>{role}</div>
              </div>
              <TurnButton ref={frontButton} label="Contact" tone={t} onClick={(e) => flipFrom(e, true)} />
            </div>
          </div>
          {shading}
        </section>

        {/* Back */}
        <section
          aria-label={`Contact details for ${name}`}
          className={face}
          style={{ ...faceStyle, transform: "rotateY(180deg)" }}
          inert={!flipped}
          aria-hidden={!flipped}
        >
          {grain}
          <div className="relative grid h-full grid-cols-[1fr_auto]" style={{ padding: "6.5cqw 7.5cqw", gap: "6cqw" }}>
            <dl className="flex min-w-0 flex-col justify-between">
              {rows.map((row) => (
                <div key={row.label} className="min-w-0">
                  <dt style={{ fontSize: "2.6cqw", color: t.muted }}>{row.label}</dt>
                  <dd className="truncate font-medium" style={{ fontSize: "3.5cqw", marginTop: "0.5cqw", letterSpacing: "-0.005em" }}>
                    {row.href ? (
                      <a
                        href={row.href}
                        className="underline decoration-transparent underline-offset-[0.2em] transition-[text-decoration-color] duration-200 hover:decoration-current focus-visible:decoration-current focus-visible:outline-none"
                        {...(row.href.startsWith("https") && { target: "_blank", rel: "noreferrer" })}
                      >
                        {row.value}
                      </a>
                    ) : (
                      row.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-col items-end justify-between">
              <div className="flex flex-col items-center" style={{ gap: "1.6cqw" }}>
                <div
                  style={{
                    background: t.qrTile,
                    // Dark modules on a light ground in every tone: phones read that reliably.
                    color: tone === "ink" ? "#18181b" : t.ink,
                    borderRadius: "1.2cqw",
                    padding: tone === "ink" ? "1.2cqw" : 0,
                  }}
                >
                  <QrCode value={vcard({ ...props, role, company })} className="block" style={{ width: "26cqw", height: "26cqw" }} />
                </div>
                <span style={{ fontSize: "2.4cqw", color: t.muted }}>Scan to save contact</span>
              </div>
              <TurnButton ref={backButton} label="Front" tone={t} onClick={(e) => flipFrom(e, false)} />
            </div>
          </div>
          {shading}
        </section>
      </motion.div>
    </div>
  );
}

const TurnButton = React.forwardRef<
  HTMLButtonElement,
  { label: string; tone: (typeof TONES)[keyof typeof TONES]; onClick: (e: React.MouseEvent) => void }
>(function TurnButton({ label, tone, onClick }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className="group inline-flex shrink-0 items-center font-medium transition-[background-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      style={{
        fontSize: "2.9cqw",
        gap: "1.2cqw",
        height: "7.4cqw",
        padding: "0 2.4cqw",
        borderRadius: "1.2cqw",
        color: tone.ink,
        boxShadow: `inset 0 0 0 1px ${tone.line}`,
      }}
      aria-label={label === "Contact" ? "Turn over for contact details" : "Turn back to the front"}
    >
      {label}
      <span
        className="inline-flex transition-[rotate] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:rotate-90"
        style={{ width: "3cqw", height: "3cqw" }}
      >
        <RotateCw className="size-full" strokeWidth={2} />
      </span>
    </button>
  );
});

/** The Prestige mark and wordmark, shaded from the card's own ink. */
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
