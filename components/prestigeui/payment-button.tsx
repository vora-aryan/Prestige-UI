"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";

interface PaymentButtonProps extends HTMLMotionProps<"button"> {
  provider: "apple" | "google";
}

const providerNames = { apple: "Apple Pay", google: "Google Pay" } as const;

export const PaymentButton = React.forwardRef<HTMLButtonElement, PaymentButtonProps>(
  ({ className, provider, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        // Not a submit button by default, so it never posts a form it sits in.
        type="button"
        aria-label={`Pay with ${providerNames[provider]}`}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "inline-flex h-12 w-full max-w-[240px] cursor-pointer items-center justify-center rounded-[4px] px-4 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          provider === "apple" && "bg-black text-white dark:bg-white dark:text-black",
          provider === "google" && "border border-border bg-black text-white dark:bg-white dark:text-black",
          className
        )}
        {...props}
      >
        {provider === "apple" && (
          <span aria-hidden className="flex items-center gap-1.5 font-semibold text-lg">
            <svg className="size-5 mb-0.5 fill-current" viewBox="0 0 24 24">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.09 2.31-.86 3.59-.8 1.51.05 2.7.72 3.4 1.8-3.05 1.73-2.58 5.86.53 7.14-.64 1.54-1.48 2.97-2.6 4.03M12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.4-1.92 4.31-3.74 4.25"/>
            </svg>
            Pay
          </span>
        )}
        {provider === "google" && (
          <span aria-hidden className="flex items-center gap-1.5 font-sans font-medium text-[19px] tracking-tight text-white dark:text-black">
            <svg className="size-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Pay
          </span>
        )}
      </motion.button>
    );
  }
);
PaymentButton.displayName = "PaymentButton";
