"use client";

import * as React from "react";
import { MotionConfig, motion } from "motion/react";
import {
  Activity,
  Bell,
  CalendarClock,
  ChartColumn,
  Command,
  FileUp,
  Globe,
  History,
  KeyRound,
  LayoutDashboard,
  LayoutTemplate,
  LifeBuoy,
  Lock,
  MessageSquare,
  Moon,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Timer,
  UserPlus,
  Users,
  Webhook,
  Braces,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EASE,
  hairline,
  Marquee,
  useHydratedReduce,
} from "@/components/prestigeui/marquee-ui";

export type MarqueeRowsFeature = { label: string; icon: LucideIcon };
export type MarqueeRowsGroup = {
  /** The row's name, shown at its start. */
  label: string;
  features: MarqueeRowsFeature[];
};

const GROUPS: MarqueeRowsGroup[] = [
  {
    label: "Security",
    features: [
      { label: "Single sign-on", icon: KeyRound },
      { label: "Audit log", icon: ScrollText },
      { label: "Roles and permissions", icon: Users },
      { label: "Two-factor sign-in", icon: ShieldCheck },
      { label: "EU or US data residency", icon: Globe },
      { label: "SCIM provisioning", icon: UserPlus },
      { label: "Encryption at rest", icon: Lock },
      { label: "Session timeouts", icon: Timer },
    ],
  },
  {
    label: "Workflow",
    features: [
      { label: "Webhooks", icon: Webhook },
      { label: "REST API", icon: Braces },
      { label: "CSV import", icon: FileUp },
      { label: "Scheduled exports", icon: CalendarClock },
      { label: "Custom fields", icon: SlidersHorizontal },
      { label: "Version history", icon: History },
      { label: "Comments and mentions", icon: MessageSquare },
      { label: "Templates", icon: LayoutTemplate },
    ],
  },
  {
    label: "Insight",
    features: [
      { label: "Usage analytics", icon: ChartColumn },
      { label: "Shared dashboards", icon: LayoutDashboard },
      { label: "Email alerts", icon: Bell },
      { label: "Status page", icon: Activity },
      { label: "Priority support", icon: LifeBuoy },
      { label: "Dark mode", icon: Moon },
      { label: "Keyboard shortcuts", icon: Command },
      { label: "iOS and Android apps", icon: Smartphone },
    ],
  },
];

// Each row runs at its own pace and the middle one runs back, so the three
// never line up into a single sliding sheet.
const LANES = [
  { speed: 30, reverse: false },
  { speed: 24, reverse: true },
  { speed: 36, reverse: false },
];

function Chip({ feature, copy }: { feature: MarqueeRowsFeature; copy: boolean }) {
  const Icon = feature.icon;
  return (
    <li
      aria-hidden={copy || undefined}
      className={cn(
        "group/chip flex h-11 shrink-0 items-center gap-2.5 rounded-[10px] border bg-card pr-4 pl-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-200",
        hairline,
        "hover:border-black/[0.14] dark:hover:border-white/[0.16]",
      )}
    >
      <span className="grid size-8 place-items-center rounded-[7px] bg-foreground/[0.045] text-foreground/60 transition-colors duration-200 group-hover/chip:text-foreground">
        <Icon className="size-4" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="text-[14px] font-medium tracking-[-0.01em] whitespace-nowrap text-foreground/80 transition-colors duration-200 group-hover/chip:text-foreground">
        {feature.label}
      </span>
    </li>
  );
}

export type MarqueeRowsProps = {
  title?: string;
  titleMuted?: string;
  groups?: MarqueeRowsGroup[];
  className?: string;
};

function MarqueeRows({
  title = "Everything you need, already built in.",
  titleMuted = "On every plan, with nothing extra to buy.",
  groups = GROUPS,
  className,
}: MarqueeRowsProps) {
  const reduce = useHydratedReduce();
  const headingId = React.useId();

  return (
    <MotionConfig reducedMotion="user">
      <section
        aria-labelledby={headingId}
        className={cn(
          "relative w-full bg-background px-4 py-20 font-sans text-foreground sm:px-6 lg:px-8 lg:py-28",
          className,
        )}
      >
        <div className="mx-auto max-w-[1200px]">
          <motion.h2
            id={headingId}
            className="mx-auto mb-10 max-w-[40ch] text-center text-[26px] leading-[1.15] font-semibold tracking-[-0.03em] text-balance sm:mb-12 sm:text-[32px]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            {title}{" "}
            <span className="block text-foreground/45">{titleMuted}</span>
          </motion.h2>

          <motion.div
            className={cn(
              "overflow-hidden rounded-[20px] border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)]",
              hairline,
            )}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, delay: 0.08, ease: EASE }}
          >
            {groups.map((group, i) => {
              const lane = LANES[i % LANES.length];
              return (
                <div
                  key={group.label}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-stretch",
                    i > 0 && "border-t",
                    hairline,
                  )}
                >
                  {/* The row's name stays put while its features travel past */}
                  <h3
                    className={cn(
                      "flex shrink-0 items-center gap-2 px-5 pt-5 text-[13px] font-medium text-foreground/55 sm:w-40 sm:border-r sm:px-6 sm:py-0",
                      hairline,
                    )}
                  >
                    <span className="tabular-nums text-foreground/30">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {group.label}
                  </h3>
                  <Marquee
                    speed={lane.speed}
                    reverse={lane.reverse}
                    gap={10}
                    fade={8}
                    className="min-w-0 flex-1 bg-foreground/[0.018] py-4 sm:py-6"
                    reducedClassName="justify-start px-5 sm:px-6"
                  >
                    {(copy) => (
                      <ul className="contents">
                        {group.features.map((feature) => (
                          <Chip key={feature.label} feature={feature} copy={copy} />
                        ))}
                      </ul>
                    )}
                  </Marquee>
                </div>
              );
            })}
          </motion.div>
        </div>
      </section>
    </MotionConfig>
  );
}

export { MarqueeRows };
