"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Strong ease-out: responds at once, lands softly. */
export const EASE = [0.16, 1, 0.3, 1] as const;

/** One accent for meaning only. Retint by overriding --footer-accent. */
export const accentVars = "[--footer-accent:#2f6bff] dark:[--footer-accent:#5b8bff]";

/** The focus ring every control in the family shares. */
export const ring =
  "outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--footer-accent)_45%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background";

// Placeholder links ("#") stay put instead of jumping or changing the URL.
// Real hrefs passed in by you navigate as usual.
export const preventPlaceholder = (event: React.MouseEvent<HTMLAnchorElement>) => {
  if (event.currentTarget.getAttribute("href") === "#") event.preventDefault();
};

export type FooterLink = { label: string; href: string; badge?: string; external?: boolean };
export type FooterGroup = { title: string; links: FooterLink[] };

export const defaultGroups: FooterGroup[] = [
  {
    title: "Product",
    links: [
      { label: "Components", href: "#" },
      { label: "Blocks", href: "#" },
      { label: "Templates", href: "#", badge: "New" },
      { label: "Pricing", href: "#" },
      { label: "Changelog", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "#" },
      { label: "Installation", href: "#" },
      { label: "Design guide", href: "#" },
      { label: "Showcase", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
      { label: "License", href: "#" },
    ],
  },
];

function ArrowUpRight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="M5 11 11 5M6 5h5v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A footer link: quiet by default, full ink on hover, optional badge. */
export function FooterAnchor({ link, className }: { link: FooterLink; className?: string }) {
  return (
    <a
      href={link.href}
      onClick={preventPlaceholder}
      {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-sm text-[14px] text-foreground/60 transition-colors duration-150 hover:text-foreground",
        ring,
        className,
      )}
    >
      {link.label}
      {link.external ? (
        <ArrowUpRight className="size-3 opacity-50 transition-[opacity,transform] duration-200 group-hover:translate-x-px group-hover:-translate-y-px group-hover:opacity-100" />
      ) : null}
      {link.badge ? (
        <span className="rounded-full bg-[color-mix(in_oklab,var(--footer-accent)_12%,transparent)] px-1.5 text-[10.5px] leading-[18px] font-medium text-[var(--footer-accent)]">
          {link.badge}
        </span>
      ) : null}
    </a>
  );
}

const socialIcons = {
  X: (
    <path d="M13.6 10.4 20.2 3h-1.9l-5.5 6.2L8.4 3H3.5l7 9.9L3.5 21h1.9l6-6.8 4.8 6.8h4.9l-7.5-10.6Zm-2.4 2.9-.7-1-5.5-7.7h2.4l4.4 6.2.7 1 5.8 8.1h-2.4l-4.7-6.6Z" />
  ),
  GitHub: (
    <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.47-1.1-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.3 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
  ),
  LinkedIn: (
    <path d="M6.5 9.5H4V20h2.5V9.5ZM5.2 4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2ZM20 20h-2.5v-5.4c0-1.6-.6-2.5-1.8-2.5-1 0-1.5.7-1.7 1.4-.1.2-.1.6-.1.9V20h-2.5V9.5H14v1.7c.4-.7 1.3-1.9 3.2-1.9 2.3 0 4 1.5 4 4.8V20Z" />
  ),
  YouTube: (
    <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z" />
  ),
} as const;

export type SocialName = keyof typeof socialIcons;

/** Icon-only social links with real labels and a generous hit area. */
export function SocialLinks({
  names = ["X", "GitHub", "LinkedIn", "YouTube"],
  className,
}: {
  names?: SocialName[];
  className?: string;
}) {
  return (
    <ul className={cn("-mx-1.5 flex items-center", className)}>
      {names.map((name) => (
        <li key={name}>
          <a
            href="#"
            onClick={preventPlaceholder}
            aria-label={name}
            className={cn(
              "grid size-8 place-items-center rounded-full text-foreground/50 transition-colors duration-150 hover:bg-foreground/[0.05] hover:text-foreground",
              ring,
            )}
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
              {socialIcons[name]}
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** The element that actually scrolls this node: a pane, or the window. */
export function scrollParent(node: HTMLElement | null): HTMLElement | Window {
  let el = node?.parentElement ?? null;
  while (el && el !== document.body) {
    if (/(auto|scroll|overlay)/.test(getComputedStyle(el).overflowY)) return el;
    el = el.parentElement;
  }
  return window;
}

/** Smoothly returns whatever scrolls this footer to the top. */
export function scrollToTop(node: HTMLElement | null) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  scrollParent(node).scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
}
