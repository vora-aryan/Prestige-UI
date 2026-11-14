"use client";

import * as React from "react";
import { Mail, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProfileCardProps {
  name: string;
  role: string;
  photo: { src: string; alt?: string };
  /** Two or three sentences, shown when the card opens. */
  bio?: string;
  location?: string;
  links?: { x?: string; linkedin?: string; github?: string; email?: string };
  className?: string;
}

// Height of the name block that shows at rest. The rest of the text waits
// below the card's edge and rises over the photo when the card opens.
const HEAD = 84;

const ICONS = {
  x: {
    label: "X",
    d: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  },
  linkedin: {
    label: "LinkedIn",
    d: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  },
  github: {
    label: "GitHub",
    d: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.255 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
  },
} as const;

/*
 * The "open" state: hover, keyboard focus (focus-visible, so a tap's focus
 * doesn't count) and a tap all use the same classes. Written out in full so
 * Tailwind can see them.
 */
const OPEN = {
  photo:
    "group-hover/profile:scale-[1.06] group-focus-visible/profile:scale-[1.06] group-has-[:focus-visible]/profile:scale-[1.06] group-data-[open]/profile:scale-[1.06]",
  show: "group-hover/profile:opacity-100 group-focus-visible/profile:opacity-100 group-has-[:focus-visible]/profile:opacity-100 group-data-[open]/profile:opacity-100",
  rise: "group-hover/profile:translate-y-0 group-focus-visible/profile:translate-y-0 group-has-[:focus-visible]/profile:translate-y-0 group-data-[open]/profile:translate-y-0",
};

export function ProfileCard({ name, role, photo, bio, location, links = {}, className }: ProfileCardProps) {
  // Hover and keyboard focus open the card with CSS; a tap toggles it,
  // since touch screens have no hover.
  const [tapped, setTapped] = React.useState(false);
  const socials = (["x", "linkedin", "github"] as const).filter((k) => links[k]);
  const glass = "bg-white/[0.14] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)] backdrop-blur-md";

  return (
    <div
      role="group"
      aria-label={`${name}, ${role}`}
      data-open={tapped || undefined}
      tabIndex={0}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a")) return;
        if ((event.nativeEvent as PointerEvent).pointerType === "mouse") return;
        setTapped((v) => !v);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setTapped(false);
      }}
      className={cn(
        "group/profile relative isolate aspect-[4/5] w-full min-w-0 overflow-clip rounded-lg bg-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_18px_40px_-24px_rgba(0,0,0,0.45)] outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_18px_40px_-24px_rgba(0,0,0,0.8)]",
        className,
      )}
      style={{ ["--head" as string]: `${HEAD}px` }}
    >
      {/* Photo, anchored near the top where faces sit. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.src}
        alt={photo.alt ?? ""}
        loading="lazy"
        draggable={false}
        className={cn(
          "absolute inset-0 -z-10 size-full origin-top object-cover object-[center_22%] transition-[scale] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
          OPEN.photo,
        )}
      />

      {/* A soft scrim for the name at rest; a deeper one fades in under the bio. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(10,10,12,0.78)_0%,rgba(10,10,12,0.35)_28%,transparent_52%)]"
      />
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(10,10,12,0.92)_0%,rgba(10,10,12,0.72)_45%,rgba(10,10,12,0.15)_80%)] opacity-0 transition-opacity duration-500 motion-reduce:transition-none",
          OPEN.show,
        )}
      />

      {/* Inner edge so the photo reads as a crafted surface. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1),inset_0_1px_0_rgba(255,255,255,0.12)]"
      />

      {location && (
        <span className="absolute top-3 left-3 inline-flex h-7 items-center gap-1 rounded-md bg-black/35 px-2 text-[12px] font-medium text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)] backdrop-blur-md">
          <MapPin className="size-3.5" strokeWidth={2} />
          {location}
        </span>
      )}

      {/* Text block: only the name shows at rest; it all rises on open. */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 translate-y-[calc(100%-var(--head))] px-5 pb-5 transition-[translate] duration-[550ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
          OPEN.rise,
        )}
      >
        <div className="flex flex-col justify-end pb-0.5" style={{ height: HEAD - 20 }}>
          <p className="truncate text-[18px] leading-tight font-medium tracking-[-0.015em] text-white">{name}</p>
          <p className="mt-1 truncate text-[13px] text-white/70">{role}</p>
        </div>

        <div className="pt-3">
          {bio && (
            <p
              className={cn(
                "line-clamp-4 text-[13.5px] leading-relaxed text-pretty text-white/85 opacity-0 transition-opacity delay-100 duration-[400ms] motion-reduce:transition-none",
                OPEN.show,
              )}
            >
              {bio}
            </p>
          )}
          <div className="mt-4 flex items-center gap-1.5">
            {socials.map((key, i) => (
              <a
                key={key}
                href={links[key]}
                target="_blank"
                rel="noreferrer"
                aria-label={`${name} on ${ICONS[key].label}`}
                className={cn(
                  "grid size-9 translate-y-1.5 place-items-center rounded-md opacity-0 transition-[opacity,translate,background-color] duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] outline-none hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white/70",
                  glass,
                  OPEN.show,
                  OPEN.rise,
                )}
                style={{ transitionDelay: `${160 + i * 45}ms` }}
              >
                <svg viewBox="0 0 24 24" className="size-[15px]" aria-hidden>
                  <path d={ICONS[key].d} fill="currentColor" />
                </svg>
              </a>
            ))}
            {links.email && (
              <a
                href={`mailto:${links.email}`}
                className={cn(
                  "ml-auto inline-flex h-9 translate-y-1.5 items-center gap-1.5 rounded-md bg-white px-3 text-[13px] font-medium text-neutral-900 opacity-0 transition-[opacity,translate,background-color] duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] outline-none hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white/70",
                  OPEN.show,
                  OPEN.rise,
                )}
                style={{ transitionDelay: `${160 + socials.length * 45}ms` }}
              >
                <Mail className="size-3.5" strokeWidth={2} />
                Say hi
                <span className="sr-only"> to {name}</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
