"use client";

import * as React from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EASE,
  Logo,
  MenuGlyph,
  accentVars,
  preventPlaceholder,
  ring,
  useDismiss,
} from "@/components/prestigeui/navbar-ui";

type NavLink = { label: string; href: string };

type NavbarAnnounceProps = {
  announcement?: React.ReactNode;
  announcementHref?: string;
  announcementId?: string;
  brand?: string;
  links?: NavLink[];
  className?: string;
};

const defaultLinks: NavLink[] = [
  { label: "Product", href: "#product" },
  { label: "Pricing", href: "#pricing" },
  { label: "Docs", href: "#docs" },
  { label: "Blog", href: "#blog" },
];

const storageKey = (id: string) => `navbar-announce:${id}`;

function readDismissed(id: string) {
  try {
    return window.localStorage.getItem(storageKey(id)) === "1";
  } catch {
    return false;
  }
}

const subscribeStorage = (callback: () => void) => {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};

function NavbarAnnounce({
  announcement = (
    <>
      <span className="font-medium">Prestige UI 3.0 is here.</span>
      <span className="hidden text-background/70 sm:inline"> Eight new navbars, a faster CLI and live previews.</span>
    </>
  ),
  announcementHref = "#",
  announcementId = "launch-3",
  brand = "Prestige UI",
  links = defaultLinks,
  className,
}: NavbarAnnounceProps) {
  // A dismissal from an earlier visit hides the bar before it can animate;
  // a dismissal right now folds it away.
  const dismissedBefore = React.useSyncExternalStore(
    subscribeStorage,
    () => readDismissed(announcementId),
    () => false,
  );
  const [dismissedNow, setDismissedNow] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState<string>();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const toggleRef = React.useRef<HTMLButtonElement>(null);
  const logoRef = React.useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), [panelRef, toggleRef], toggleRef);

  const dismiss = () => {
    setDismissedNow(true);
    try {
      window.localStorage.setItem(storageKey(announcementId), "1");
    } catch {
      // Storage can be unavailable (private mode); the bar still closes.
    }
    // The dismiss button is about to disappear; keep focus somewhere sane.
    logoRef.current?.querySelector("a")?.focus();
  };

  const go = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    preventPlaceholder(event);
    setActive(href);
    setOpen(false);
  };

  return (
    <MotionConfig reducedMotion="user">
      {/* display: contents, so the bar scrolls away while the nav sticks. */}
      <div className={cn("contents font-sans", accentVars, className)}>
        {dismissedBefore ? null : (
          <AnimatePresence initial={false}>
            {dismissedNow ? null : (
              <motion.div
                role="region"
                aria-label="Announcement"
                exit={{ height: 0, opacity: 0, transition: { duration: 0.32, ease: EASE } }}
                className="w-full overflow-hidden bg-foreground font-sans text-background"
              >
                <div className="relative mx-auto flex h-10 max-w-6xl items-center justify-center px-12 text-[13px]">
                  <a
                    href={announcementHref}
                    onClick={preventPlaceholder}
                    className="group flex min-w-0 items-center gap-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-background/50"
                  >
                    <span className="truncate">{announcement}</span>
                    <span className="inline-flex shrink-0 items-center gap-1 font-medium underline decoration-background/30 underline-offset-[3px] transition-[text-decoration-color] duration-200 group-hover:decoration-background">
                      Read more
                      <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2} />
                    </span>
                  </a>
                  <button
                    type="button"
                    onClick={dismiss}
                    aria-label="Dismiss announcement"
                    className="absolute right-2 grid size-7 cursor-pointer place-items-center rounded-md text-background/60 transition-colors hover:bg-background/10 hover:text-background focus-visible:ring-2 focus-visible:ring-background/50 focus-visible:outline-none sm:right-4"
                  >
                    <X className="size-3.5" strokeWidth={2.25} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 font-sans text-foreground backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
            <div ref={logoRef} className="flex">
              <Logo name={brand} />
            </div>
            <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
              {links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  aria-current={active === link.href ? "page" : undefined}
                  onClick={(event) => go(event, link.href)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[13.5px] font-medium transition-colors duration-150 hover:text-foreground",
                    active === link.href ? "text-foreground" : "text-foreground/60",
                    ring,
                  )}
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-1.5">
              <a
                href="#"
                onClick={preventPlaceholder}
                className={cn(
                  "hidden h-9 items-center rounded-lg px-3 text-[13.5px] font-medium text-foreground/70 transition-colors hover:text-foreground sm:inline-flex",
                  ring,
                )}
              >
                Log in
              </a>
              <a
                href="#"
                onClick={preventPlaceholder}
                className={cn(
                  "inline-flex h-9 items-center rounded-lg bg-foreground px-3.5 text-[13.5px] font-medium text-background shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.97]",
                  ring,
                )}
              >
                Sign up
              </a>
              <button
                ref={toggleRef}
                type="button"
                aria-label={open ? "Close menu" : "Open menu"}
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                className={cn(
                  "grid size-9 cursor-pointer place-items-center rounded-lg text-foreground/80 transition-colors hover:bg-foreground/[0.05] md:hidden",
                  ring,
                )}
              >
                <MenuGlyph open={open} />
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {open ? (
              <motion.div
                ref={panelRef}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1, transition: { duration: 0.3, ease: EASE } }}
                exit={{ height: 0, opacity: 0, transition: { duration: 0.18, ease: "easeOut" } }}
                className="overflow-hidden border-t border-border md:hidden"
              >
                <nav aria-label="Mobile" className="px-4 pt-2 pb-5">
                  {links.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      onClick={(event) => go(event, link.href)}
                      className={cn("flex h-12 items-center border-b border-border text-[15px] font-medium text-foreground/80 last:border-b-0", ring)}
                    >
                      {link.label}
                    </a>
                  ))}
                  <a
                    href="#"
                    onClick={preventPlaceholder}
                    className={cn("mt-3 flex h-11 items-center justify-center rounded-lg border border-border text-[14px] font-medium sm:hidden", ring)}
                  >
                    Log in
                  </a>
                </nav>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </header>
      </div>
    </MotionConfig>
  );
}

export { NavbarAnnounce, type NavbarAnnounceProps };
