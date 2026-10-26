"use client";

import * as React from "react";
import { MotionConfig, motion, useInView } from "motion/react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EASE,
  Field,
  PrimaryAction,
  SecondaryAction,
  accentVars,
  useHydratedReduce,
  type CtaAction,
} from "@/components/prestigeui/cta-ui";

type CtaBloomProps = {
  title?: string;
  titleMuted?: string;
  description?: string;
  primary?: CtaAction;
  secondary?: CtaAction;
  /** Short reassurances under the buttons. */
  notes?: string[];
  className?: string;
};

// Pastels that sit with white and black: warm white, sky, apricot, mint.
// Dark mode keeps the same hues, deepened into near-black.
const palette =
  "[--field-0:#fbf8f2] [--field-1:#c3dfe6] [--field-2:#f5d2bb] [--field-3:#c9e2d3] [--field-light:#fffdf8] " +
  "dark:[--field-0:#0e1014] dark:[--field-1:#17283f] dark:[--field-2:#3a2417] dark:[--field-3:#13302a] dark:[--field-light:#3b4a60]";

function CtaBloom({
  title = "Plan, build and ship in one place.",
  titleMuted = "Free for teams of up to ten.",
  description = "Bring your issues over from Jira or Linear in a few clicks, then keep every doc, review and release in sync.",
  primary = { label: "Start for free", href: "#" },
  secondary = { label: "Book a demo", href: "#" },
  notes = ["No credit card", "Set up in two minutes", "Cancel anytime"],
  className,
}: CtaBloomProps) {
  const reduce = useHydratedReduce();
  const uid = React.useId();
  const panel = React.useRef<HTMLDivElement>(null);
  const inView = useInView(panel, { once: true, amount: 0.4 });
  const shown = inView || reduce;

  // One rise per row, 60ms apart, once.
  const rise = (i: number) => ({
    initial: { opacity: 0, y: 10 },
    animate: shown ? { opacity: 1, y: 0 } : undefined,
    transition: { duration: 0.6, ease: EASE, delay: 0.08 + i * 0.06 },
  });

  return (
    <MotionConfig reducedMotion="user">
      <section
        aria-labelledby={`${uid}-title`}
        className={cn("w-full bg-background px-4 py-10 font-sans text-foreground sm:px-6 md:py-14", accentVars, className)}
      >
        <div
          ref={panel}
          className={cn(
            "relative isolate mx-auto max-w-6xl overflow-hidden rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.09)]",
            palette,
          )}
        >
          <Field area={panel} reduce={reduce} className="-z-10" />

          <div className="flex flex-col items-center px-5 py-16 text-center sm:px-12 md:py-20">
            <motion.h2
              id={`${uid}-title`}
              {...rise(0)}
              className="max-w-[20ch] text-[34px] leading-[1.06] font-semibold tracking-[-0.04em] text-balance sm:max-w-3xl sm:text-[48px]"
            >
              {title}
              <span className="block text-foreground/45">{titleMuted}</span>
            </motion.h2>

            <motion.p
              {...rise(1)}
              className="mt-6 max-w-[48ch] text-[15.5px] leading-[1.6] text-pretty text-foreground/65 sm:text-[16.5px]"
            >
              {description}
            </motion.p>

            <motion.div
              {...rise(2)}
              className="mt-9 flex w-full flex-col items-stretch gap-2.5 sm:w-auto sm:flex-row sm:items-center"
            >
              <PrimaryAction action={primary} data-field-gather="" />
              <SecondaryAction action={secondary} />
            </motion.div>

            {notes.length ? (
              <motion.ul
                {...rise(3)}
                className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] text-foreground/60"
              >
                {notes.map((note) => (
                  <li key={note} className="inline-flex items-center gap-1.5">
                    <Check aria-hidden className="size-3.5 text-foreground/45" strokeWidth={2.25} />
                    {note}
                  </li>
                ))}
              </motion.ul>
            ) : null}
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}

export { CtaBloom, type CtaBloomProps };
