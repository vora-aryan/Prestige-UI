"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  textToCopy: string;
  text?: string;
  successDuration?: number;
}

export const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  ({ className, textToCopy, text, successDuration = 1500, children, ...props }, ref) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), successDuration);
      } catch (err) {
        console.error("Failed to copy text: ", err);
      }
    };

    return (
      <button
        ref={ref}
        onClick={handleCopy}
        className={cn(
          "inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          className
        )}
        {...props}
      >
        <span className="relative flex size-4 items-center justify-center">
          <AnimatePresence mode="popLayout" initial={false}>
            {copied ? (
              <motion.span
                key="check"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 flex items-center justify-center text-foreground"
              >
                <Check className="size-full" />
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Copy className="size-full text-muted-foreground" />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        {text && <span>{text}</span>}
        {!text && children && <span>{children}</span>}
      </button>
    );
  }
);
CopyButton.displayName = "CopyButton";
