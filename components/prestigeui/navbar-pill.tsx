"use client";

import * as React from "react";
import { MotionConfig, motion } from "motion/react";
import { cn } from "@/lib/utils";

// Placeholder links ("#") stay put instead of jumping or changing the URL.
// Real hrefs passed in by you navigate as usual.
const preventPlaceholder = (event: React.MouseEvent<HTMLAnchorElement>) => {
  if (event.currentTarget.getAttribute("href") === "#") event.preventDefault();
};

type NavLink = { label: string; href: string };

type NavbarPillProps = {
  className?: string;
  links?: NavLink[];
  activeHref?: string;
};

const defaultLinks: NavLink[] = [
  { label: "Home", href: "#" },
  { label: "About", href: "#" },
  { label: "Company", href: "#" },
  { label: "Contact", href: "#" },
];

const ease = [0.23, 1, 0.32, 1] as const;

const pillSpring = {
  type: "spring" as const,
  stiffness: 300,
  damping: 32,
  mass: 1,
};

function NavbarPill({
  className,
  links = defaultLinks,
  activeHref,
}: NavbarPillProps) {
  // Links are tracked by position, so placeholder hrefs can repeat.
  const [active, setActive] = React.useState(() =>
    Math.max(0, links.findIndex((link) => link.href === activeHref)),
  );
  const [hovered, setHovered] = React.useState<number | null>(null);
  const pillId = React.useId();
  const visual = hovered ?? active;

  return (
    <MotionConfig reducedMotion="user">
      <header
        className={cn(
          "sticky top-0 z-50 flex justify-center px-3 py-5 sm:px-4",
          className,
        )}
      >
        <motion.nav
          initial={{ opacity: 0, y: -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease }}
          aria-label="Primary"
          onMouseLeave={() => setHovered(null)}
          className="relative flex max-w-full items-center rounded-full border border-border bg-muted/70 p-1 dark:bg-black dark:border-white/[0.09]"
        >
          {links.map((link, index) => {
            const isVisual = visual === index;
            const isSelected = active === index;

            return (
              <motion.a
                key={link.label}
                href={link.href}
                aria-current={isSelected ? "page" : undefined}
                onMouseEnter={() => setHovered(index)}
                onFocus={() => setHovered(index)}
                onBlur={() => setHovered(null)}
                onClick={(event) => {
                  preventPlaceholder(event);
                  setActive(index);
                }}
                className={cn(
                  "relative isolate cursor-pointer rounded-full px-3.5 py-2 text-[13px] font-medium whitespace-nowrap transition-colors duration-300 sm:px-6",
                  isVisual
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground/80",
                )}
              >
                {isVisual ? (
                  <motion.span
                    layoutId={pillId}
                    className="absolute inset-0 -z-10 rounded-full bg-background shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(0,0,0,0.06)] dark:bg-white/[0.1] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(0,0,0,0.55)]"
                    transition={pillSpring}
                  />
                ) : null}
                {link.label}
              </motion.a>
            );
          })}
        </motion.nav>
      </header>
    </MotionConfig>
  );
}

export { NavbarPill, type NavbarPillProps };
