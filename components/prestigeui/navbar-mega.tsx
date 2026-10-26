"use client";

import * as React from "react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Boxes,
  ChevronDown,
  Code2,
  FileClock,
  Lock,
  Menu,
  Rocket,
  ShoppingBag,
  Sparkles,
  Users,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/prestigeui/prestige-brand";

// Placeholder links ("#") stay put instead of jumping or changing the URL.
// Real hrefs passed in by you navigate as usual.
const preventPlaceholder = (event: React.MouseEvent<HTMLAnchorElement>) => {
  if (event.currentTarget.getAttribute("href") === "#") event.preventDefault();
};

type MenuItem = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

type NavMenu = {
  label: string;
  items: MenuItem[];
  /** Optional column of plain links shown beside the items. */
  aside?: { title: string; links: { label: string; href: string }[] };
};

type NavLink = { label: string; href: string };

type NavbarMegaProps = {
  brand?: React.ReactNode;
  menus?: NavMenu[];
  links?: NavLink[];
  signInHref?: string;
  ctaLabel?: string;
  ctaHref?: string;
  className?: string;
};

const defaultMenus: NavMenu[] = [
  {
    label: "Product",
    items: [
      {
        title: "Analytics",
        description: "Live dashboards for every metric.",
        href: "#",
        icon: BarChart3,
      },
      {
        title: "Automations",
        description: "Trigger work from any event.",
        href: "#",
        icon: Workflow,
      },
      {
        title: "Integrations",
        description: "Connect the tools you already use.",
        href: "#",
        icon: Boxes,
      },
      {
        title: "Security",
        description: "SSO, audit logs and fine roles.",
        href: "#",
        icon: Lock,
      },
    ],
    aside: {
      title: "Use cases",
      links: [
        { label: "Startups", href: "#" },
        { label: "Agencies", href: "#" },
        { label: "Enterprise", href: "#" },
      ],
    },
  },
  {
    label: "Developers",
    items: [
      {
        title: "Documentation",
        description: "Guides and API reference.",
        href: "#",
        icon: BookOpen,
      },
      {
        title: "API",
        description: "Typed clients for every runtime.",
        href: "#",
        icon: Code2,
      },
      {
        title: "Changelog",
        description: "What shipped this week.",
        href: "#",
        icon: FileClock,
      },
    ],
  },
  {
    label: "Solutions",
    items: [
      {
        title: "Launch faster",
        description: "Templates for a first release.",
        href: "#",
        icon: Rocket,
      },
      {
        title: "Commerce",
        description: "Checkout and catalog flows.",
        href: "#",
        icon: ShoppingBag,
      },
      {
        title: "Teams",
        description: "Shared spaces and permissions.",
        href: "#",
        icon: Users,
      },
      {
        title: "AI features",
        description: "Ship assistants your users trust.",
        href: "#",
        icon: Sparkles,
      },
    ],
  },
];

const defaultLinks: NavLink[] = [
  { label: "Pricing", href: "#" },
  { label: "Blog", href: "#" },
];

// Motion: ease-out for entering, a softer drawer curve for the glide
// between menus, and exits faster than entrances.
const EASE = [0.23, 1, 0.32, 1] as const;
// On-screen movement between menus: a gentle ease-in-out, unhurried.
const GLIDE = { duration: 0.5, ease: [0.65, 0, 0.35, 1] as const };
const OPEN_DELAY = 80;
const CLOSE_DELAY = 160;

// A soft crossfade: the old menu fades in place while the new one settles
// in with a small nudge from the direction of travel, so the panel is never
// empty mid-switch.
const contentVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 6 }),
  center: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.36, delay: 0.08, ease: EASE },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2, ease: "easeOut" as const },
  },
};

// CSS transition for the panel's real width and height, matching GLIDE.
const SIZE_TRANSITION =
  "width 500ms cubic-bezier(0.65, 0, 0.35, 1), height 500ms cubic-bezier(0.65, 0, 0.35, 1)";

// Reports its content's natural size so the panel can animate real width
// and height (no transform scaling, so text never stretches).
function Measure({
  onSize,
  children,
}: {
  onSize: (size: { width: number; height: number }) => void;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const report = () =>
      onSize({ width: node.offsetWidth, height: node.offsetHeight });
    report();
    const observer = new ResizeObserver(report);
    observer.observe(node);
    return () => observer.disconnect();
  }, [onSize]);
  return (
    <div ref={ref} className="w-max">
      {children}
    </div>
  );
}

const press =
  "cursor-pointer transition-[transform,background-color,color,border-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function MenuPanel({ menu }: { menu: NavMenu }) {
  return (
    <div className="flex gap-2 p-2">
      <ul
        className={cn(
          "grid gap-1",
          menu.items.length > 3 ? "w-[480px] grid-cols-2" : "w-[260px] grid-cols-1",
        )}
      >
        {menu.items.map((item) => (
          <li key={item.title}>
            <a onClick={preventPlaceholder}
              href={item.href}
              className="group flex items-start gap-3 p-3 transition-colors duration-150 hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:outline-none"
            >
              <span className="flex size-9 shrink-0 items-center justify-center border border-border bg-background text-muted-foreground transition-colors duration-150 group-hover:text-foreground">
                <item.icon className="size-4" strokeWidth={1.75} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-medium tracking-tight text-foreground">
                  {item.title}
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                  {item.description}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      {menu.aside ? (
        <div className="w-44 border-l border-border py-3 pr-2 pl-5">
          <p className="text-[12px] text-muted-foreground">{menu.aside.title}</p>
          <ul className="mt-3 flex flex-col gap-2.5">
            {menu.aside.links.map((link) => (
              <li key={link.label}>
                <a onClick={preventPlaceholder}
                  href={link.href}
                  className="group inline-flex items-center gap-1 text-[14px] text-foreground/80 transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:underline"
                >
                  {link.label}
                  <ArrowUpRight
                    className="size-3.5 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                    strokeWidth={1.75}
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function NavbarMega({
  brand = "Prestige UI",
  menus = defaultMenus,
  links = defaultLinks,
  signInHref = "#",
  ctaLabel = "Start your project",
  ctaHref = "#",
  className,
}: NavbarMegaProps) {
  const reduce = useReducedMotion();
  const [open, setOpen] = React.useState<number | null>(null);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [mobileSection, setMobileSection] = React.useState<number | null>(null);
  const [offset, setOffset] = React.useState(0);
  const [direction, setDirection] = React.useState(0);
  const [size, setSize] = React.useState<{ width: number; height: number } | null>(null);
  const handleSize = React.useCallback(
    (next: { width: number; height: number }) => setSize(next),
    [],
  );
  const navRef = React.useRef<HTMLDivElement>(null);
  const triggerRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const openTimer = React.useRef<number | undefined>(undefined);
  const closeTimer = React.useRef<number | undefined>(undefined);
  // Whether the open menu came from hovering, so the click that usually
  // follows the hover keeps it open instead of toggling it shut.
  const openedByHover = React.useRef(false);
  const panelId = React.useId();

  const clearTimers = () => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  };

  const show = (index: number) => {
    clearTimers();
    const trigger = triggerRefs.current[index];
    const nav = navRef.current;
    if (trigger && nav) {
      setOffset(trigger.getBoundingClientRect().left - nav.getBoundingClientRect().left);
    }
    // Opening from closed starts at the new menu's own size.
    if (open === null) setSize(null);
    setDirection(open === null ? 0 : Math.sign(index - open));
    setOpen(index);
  };

  // Hover intent: the first menu waits a beat so a pointer passing over the
  // bar does not flash it open. Moving between open menus is immediate.
  // Hover is for mice only: touch fires an emulated hover before the tap,
  // which would open the menu and let the tap's click close it again.
  const hoverTrigger = (event: React.PointerEvent, index: number) => {
    if (event.pointerType !== "mouse") return;
    clearTimers();
    const hover = () => {
      openedByHover.current = true;
      show(index);
    };
    if (open !== null) hover();
    else openTimer.current = window.setTimeout(hover, OPEN_DELAY);
  };

  const pressTrigger = (index: number) => {
    const keepOpen = open === index && openedByHover.current;
    openedByHover.current = false;
    if (keepOpen) clearTimers();
    else if (open === index) setOpen(null);
    else show(index);
  };

  // A grace period lets the pointer travel from a trigger into the panel.
  const scheduleClose = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    clearTimers();
    closeTimer.current = window.setTimeout(() => setOpen(null), CLOSE_DELAY);
  };

  // Touch has no pointer leaving the bar, so a tap or focus outside closes.
  React.useEffect(() => {
    if (open === null) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen((current) => {
        if (current !== null) triggerRefs.current[current]?.focus();
        return null;
      });
      setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(openTimer.current);
      window.clearTimeout(closeTimer.current);
    };
  }, []);

  // Keyboard order: the panel sits after the whole bar in the DOM, so Tab
  // from an open trigger goes into its panel, and Tab out of the panel's last
  // link continues with the next item in the bar.
  const panelRef = React.useRef<HTMLDivElement>(null);
  const panelItems = () =>
    open === null
      ? []
      : [...(panelRef.current?.querySelectorAll<HTMLElement>(`[data-menu="${open}"] :is(a[href], button)`) ?? [])];

  const triggerKey = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== "Tab" || event.shiftKey || open !== index) return;
    const first = panelItems()[0];
    if (!first) return;
    event.preventDefault();
    first.focus();
  };

  const panelKey = (event: React.KeyboardEvent) => {
    if (event.key !== "Tab" || open === null) return;
    const items = panelItems();
    const trigger = triggerRefs.current[open];
    if (!trigger || !items.length) return;
    if (event.shiftKey && document.activeElement === items[0]) {
      event.preventDefault();
      trigger.focus();
    } else if (!event.shiftKey && document.activeElement === items[items.length - 1]) {
      const bar = [...(navRef.current?.querySelectorAll<HTMLElement>("nav :is(a[href], button)") ?? [])];
      const next = bar[bar.indexOf(trigger) + 1];
      if (!next) return;
      event.preventDefault();
      setOpen(null);
      next.focus();
    }
  };

  const activeMenu = open === null ? null : menus[open];

  return (
    <MotionConfig reducedMotion="user">
      <header
        className={cn(
          "sticky top-0 z-50 w-full border-b border-border bg-background/80 font-sans text-foreground backdrop-blur-xl",
          className,
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <a onClick={preventPlaceholder}
              href="#"
              className="flex items-center gap-2 text-[15px] font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <BrandMark className="size-7" />
              {brand}
            </a>

            <div
              ref={navRef}
              className="relative hidden lg:block"
              onPointerLeave={scheduleClose}
              onBlur={(event) => {
                // Only when focus moves somewhere else, e.g. tabbing past the
                // menu; a click on plain panel text blurs with no new target.
                const next = event.relatedTarget;
                if (next && !event.currentTarget.contains(next)) setOpen(null);
              }}
            >
              <nav aria-label="Main" className="flex items-center gap-0.5">
                {menus.map((menu, index) => {
                  const isOpen = open === index;
                  return (
                    <button
                      key={menu.label}
                      ref={(node) => {
                        triggerRefs.current[index] = node;
                      }}
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onPointerEnter={(event) => hoverTrigger(event, index)}
                      onClick={() => pressTrigger(index)}
                      onKeyDown={(event) => triggerKey(event, index)}
                      className={cn(
                        "inline-flex h-9 cursor-pointer items-center gap-1 px-3 text-[14px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isOpen ? "text-foreground" : "text-foreground/70 hover:text-foreground",
                      )}
                    >
                      {menu.label}
                      <ChevronDown
                        aria-hidden
                        className={cn(
                          "size-3.5 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
                          isOpen && "rotate-180",
                        )}
                        strokeWidth={2}
                      />
                    </button>
                  );
                })}
                {links.map((link) => (
                  <a onClick={preventPlaceholder}
                    key={link.label}
                    href={link.href}
                    onPointerEnter={scheduleClose}
                    className="inline-flex h-9 items-center px-3 text-[14px] font-medium text-foreground/70 transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>

              {/* One shared panel. It glides to the active trigger and resizes
                  to fit each menu instead of separate dropdowns popping open. */}
              <AnimatePresence>
                {activeMenu ? (
                  <motion.div
                    ref={panelRef}
                    id={panelId}
                    onPointerEnter={clearTimers}
                    onKeyDown={panelKey}
                    style={{ transformOrigin: "top left" }}
                    initial={{ opacity: 0, y: -4, scale: 0.98, x: offset }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      x: offset,
                      transition: {
                        opacity: { duration: 0.24, ease: EASE },
                        y: { duration: 0.28, ease: EASE },
                        scale: { duration: 0.28, ease: EASE },
                        x: reduce ? { duration: 0 } : GLIDE,
                      },
                    }}
                    exit={{
                      opacity: 0,
                      y: -4,
                      scale: 0.98,
                      transition: { duration: 0.16, ease: "easeOut" },
                    }}
                    className="absolute top-full left-0 pt-3"
                  >
                    <div
                      style={{
                        width: size ? size.width + 2 : undefined,
                        height: size ? size.height + 2 : undefined,
                        transition: reduce ? undefined : SIZE_TRANSITION,
                      }}
                      className="relative overflow-hidden border border-border bg-background shadow-[0_24px_60px_-30px_color-mix(in_oklab,var(--foreground)_30%,transparent)]"
                    >
                      <AnimatePresence
                        mode="popLayout"
                        initial={false}
                        custom={direction}
                      >
                        <motion.div
                          key={activeMenu.label}
                          data-menu={open ?? undefined}
                          custom={direction}
                          variants={contentVariants}
                          initial="enter"
                          animate="center"
                          exit="exit"
                        >
                          <Measure onSize={handleSize}>
                            <MenuPanel menu={activeMenu} />
                          </Measure>
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a onClick={preventPlaceholder}
              href={signInHref}
              className={cn(
                "hidden h-9 items-center border border-border px-3.5 text-[13px] font-medium hover:border-foreground/25 sm:inline-flex",
                press,
              )}
            >
              Sign in
            </a>
            <a onClick={preventPlaceholder}
              href={ctaHref}
              className={cn(
                "hidden h-9 items-center bg-foreground px-3.5 text-[13px] font-medium text-background hover:bg-foreground/90 sm:inline-flex",
                press,
              )}
            >
              {ctaLabel}
            </a>
            <button
              type="button"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((value) => !value)}
              className={cn(
                "inline-flex size-9 items-center justify-center border border-border lg:hidden",
                press,
              )}
            >
              {mobileOpen ? (
                <X className="size-4" strokeWidth={1.75} />
              ) : (
                <Menu className="size-4" strokeWidth={1.75} />
              )}
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {mobileOpen ? (
            <motion.nav
              aria-label="Mobile"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: EASE }}
              className="overflow-hidden border-t border-border lg:hidden"
            >
              <div className="px-4 pb-6 sm:px-6">
                {menus.map((menu, index) => {
                  const expanded = mobileSection === index;
                  return (
                    <div key={menu.label} className="border-b border-border">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setMobileSection(expanded ? null : index)}
                        className="flex w-full cursor-pointer items-center justify-between py-4 text-[15px] font-medium"
                      >
                        {menu.label}
                        <ChevronDown
                          aria-hidden
                          className={cn(
                            "size-4 text-muted-foreground transition-transform duration-200",
                            expanded && "rotate-180",
                          )}
                          strokeWidth={1.75}
                        />
                      </button>
                      <AnimatePresence initial={false}>
                        {expanded ? (
                          <motion.ul
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.24, ease: EASE }}
                            className="overflow-hidden"
                          >
                            {menu.items.map((item) => (
                              <li key={item.title}>
                                <a
                                  href={item.href}
                                  onClick={(event) => {
                                    preventPlaceholder(event);
                                    setMobileOpen(false);
                                  }}
                                  className="flex items-center gap-3 py-2.5 text-[14px] text-foreground/80"
                                >
                                  <item.icon
                                    className="size-4 text-muted-foreground"
                                    strokeWidth={1.75}
                                  />
                                  {item.title}
                                </a>
                              </li>
                            ))}
                            <li className="h-3" aria-hidden />
                          </motion.ul>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  );
                })}
                {links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={(event) => {
                      preventPlaceholder(event);
                      setMobileOpen(false);
                    }}
                    className="block border-b border-border py-4 text-[15px] font-medium"
                  >
                    {link.label}
                  </a>
                ))}
                <div className="mt-6 grid gap-2">
                  <a onClick={preventPlaceholder}
                    href={signInHref}
                    className="inline-flex h-11 items-center justify-center border border-border text-[14px] font-medium"
                  >
                    Sign in
                  </a>
                  <a onClick={preventPlaceholder}
                    href={ctaHref}
                    className="inline-flex h-11 items-center justify-center bg-foreground text-[14px] font-medium text-background"
                  >
                    {ctaLabel}
                  </a>
                </div>
              </div>
            </motion.nav>
          ) : null}
        </AnimatePresence>
      </header>
    </MotionConfig>
  );
}

export { NavbarMega, type NavbarMegaProps, type NavMenu, type MenuItem };
