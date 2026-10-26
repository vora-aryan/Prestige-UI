"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Download, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface InteractiveButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  action?: () => Promise<void>;
  successDuration?: number;
}

export const InteractiveButton = React.forwardRef<HTMLButtonElement, InteractiveButtonProps>(
  ({ className, action, successDuration = 1500, children, disabled, ...props }, ref) => {
    const [state, setState] = React.useState<"idle" | "loading" | "success">("idle");

    const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
      if (props.onClick) props.onClick(e);
      if (!action) return;

      try {
        setState("loading");
        await action();
        setState("success");
        setTimeout(() => setState("idle"), successDuration);
      } catch (error) {
        setState("idle");
      }
    };

    return (
      <button
        ref={ref}
        disabled={disabled || state !== "idle"}
        onClick={handleClick}
        className={cn(
          "group relative inline-flex h-11 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-md border border-border bg-background px-6 font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none",
          className
        )}
        {...props}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {state === "idle" && (
            <motion.span
              key="idle"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex items-center gap-2"
            >
              <Download className="size-4 transition-transform duration-300 " />
              {children || "Download"}
            </motion.span>
          )}
          {state === "loading" && (
            <motion.span
              key="loading"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex w-full items-center justify-center"
            >
              {/* Animated Progress Bar Fill inside the button */}
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
                className="absolute inset-0 z-0 bg-primary/10"
              />
              <span className="relative z-10 animate-pulse text-sm">Downloading...</span>
            </motion.span>
          )}
          {state === "success" && (
            <motion.span
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-2 text-foreground"
            >
              <Check className="size-5" />
              <span>Complete</span>
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    );
  }
);
InteractiveButton.displayName = "InteractiveButton";
