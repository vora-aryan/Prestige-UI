"use client";

import * as React from "react";
import { AnimatePresence, MotionConfig, motion, useMotionValueEvent } from "motion/react";
import { cn } from "@/lib/utils";
import {
  EASE,
  Logo,
  MenuGlyph,
  accentVars,
  preventPlaceholder,
  ring,
  surface,
  useDismiss,
  useScrollY,
} from "@/components/prestigeui/navbar-ui";

type NavLink = { label: string; href: string };

type NavbarCondenseProps = {
  brand?: string;
  links?: NavLink[];
  activeHref?: string;
  signInHref?: string;
  ctaLabel?: string;
  ctaHref?: string;
  className?: string;
};

const defaultLinks: NavLink[] = [
  { label: "Product", href: "#product" },
  { label: "Customers", href: "#customers" },
  { label: "Changelog", href: "#changelog" },
  { label: "Pricing", href: "#pricing" },
];

// Hysteresis: condense after 40px, expand again only near the very top, so
// a pointer resting on the threshold never makes the bar flicker.
const CONDENSE_AT = 40;
const EXPAND_AT = 8;

function NavbarCondense({
  brand = "Prestige UI",
  links = defaultLinks,
  activeHref,
  signInHref = "#",
  ctaLabel = "Get started",
  ctaHref = "#",
  className,
}: NavbarCondenseProps) {
  const headerRef = React.useRef<HTMLElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const toggleRef = React.useRef<HTMLButtonElement>(null);
  const { y } = useScrollY(headerRef);
  const [condensed, setCondensed] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(activeHref);
  const panelId = React.useId();

  useMotionValueEvent(y, "change", (value) => {
    if (!condensed && value > CONDENSE_AT) setCondensed(true);
    else if (condensed && value < EXPAND_AT) setCondensed(false);
  });

  useDismiss(open, () => setOpen(false), [panelRef, toggleRef], toggleRef);

  const go = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    preventPlaceholder(event);
    setActive(href);
    setOpen(false);
  };

  return (
    <MotionConfig reducedMotion="user">
      <header
        ref={headerRef}
        className={cn("sticky top-0 z-50 w-full px-3 font-sans text-foreground sm:px-4", accentVars, className)}
      >
        <div
          className={cn(
            "relative mx-auto flex h-14 items-center justify-between gap-4 border transition-[max-width,transform,padding,border-radius,background-color,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            condensed || open
              ? "translate-y-3 max-w-[760px] rounded-2xl border-border bg-background/75 pr-2 pl-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(15,23,42,0.25)] backdrop-blur-xl dark:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.8)]"
              : "translate-y-1 max-w-6xl rounded-none border-transparent bg-transparent px-1 shadow-none",
          )}
        >
          <Logo name={brand} />

          <nav aria-label="Main" className="hidden items-center gap-0.5 md:flex">
            {links.map((link) => {
              const current = active === link.href;
              return (
                <a
                  key={link.label}
                  href={link.href}
                  aria-current={current ? "page" : undefined}
                  onClick={(event) => go(event, link.href)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[13.5px] font-medium transition-colors duration-200 hover:bg-foreground/[0.05] hover:text-foreground",
                    current ? "text-foreground" : "text-foreground/60",
                    ring,
                  )}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5">
            <a
              href={signInHref}
              onClick={preventPlaceholder}
              className={cn(
                "hidden h-9 items-center rounded-lg px-3 text-[13.5px] font-medium text-foreground/70 transition-colors duration-200 hover:text-foreground sm:inline-flex",
                ring,
              )}
            >
              Log in
            </a>
            <a
              href={ctaHref}
              onClick={preventPlaceholder}
              className={cn(
                "inline-flex h-9 items-center rounded-lg bg-foreground px-3.5 text-[13.5px] font-medium text-background shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.97]",
                ring,
              )}
            >
              {ctaLabel}
            </a>
            <button
              ref={toggleRef}
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpen((value) => !value)}
              className={cn(
                "grid size-9 cursor-pointer place-items-center rounded-lg text-foreground/80 transition-colors duration-200 hover:bg-foreground/[0.05] md:hidden",
                ring,
              )}
            >
              <MenuGlyph open={open} />
            </button>
          </div>

          <AnimatePresence>
            {open ? (
              <motion.div
                ref={panelRef}
                id={panelId}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } }}
                exit={{ opacity: 0, y: -4, transition: { duration: 0.15, ease: "easeOut" } }}
                className={cn("absolute inset-x-0 top-full mt-2 rounded-2xl p-2 md:hidden", surface)}
              >
                <nav aria-label="Mobile">
                  {links.map((link, index) => (
                    <motion.a
                      key={link.label}
                      href={link.href}
                      aria-current={active === link.href ? "page" : undefined}
                      onClick={(event) => go(event, link.href)}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: 0.04 + index * 0.035, ease: EASE } }}
                      className={cn(
                        "flex h-11 items-center rounded-lg px-3 text-[15px] font-medium transition-colors hover:bg-foreground/[0.05]",
                        active === link.href ? "text-foreground" : "text-foreground/75",
                        ring,
                      )}
                    >
                      {link.label}
                    </motion.a>
                  ))}
                </nav>
                <div className="mt-2 border-t border-border px-1 pt-3 pb-1">
                  <a
                    href={signInHref}
                    onClick={preventPlaceholder}
                    className={cn(
                      "flex h-10 items-center justify-center rounded-lg border border-border text-[14px] font-medium",
                      ring,
                    )}
                  >
                    Log in
                  </a>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </header>
    </MotionConfig>
  );
}

export { NavbarCondense, type NavbarCondenseProps };
