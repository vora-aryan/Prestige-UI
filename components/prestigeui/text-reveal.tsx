"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type TextRevealProps = {
  text: string;
  className?: string;
  delay?: number;
  as?: "p" | "h1" | "h2" | "h3" | "h4" | "span";
};

function TextReveal({
  text,
  className,
  delay = 0,
  as: Tag = "p",
}: TextRevealProps) {
  const words = text.split(" ");
  const reduce = useReducedMotion();

  return (
    <Tag className={cn("flex flex-wrap", className)}>
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          initial={reduce ? false : { opacity: 0, y: 14, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{
            duration: 0.55,
            delay: delay + index * 0.045,
            ease: [0.23, 1, 0.32, 1],
          }}
          className="mr-[0.28em] inline-block will-change-transform"
        >
          {word}
        </motion.span>
      ))}
    </Tag>
  );
}

export { TextReveal, type TextRevealProps };
