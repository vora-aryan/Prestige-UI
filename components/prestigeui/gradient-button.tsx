"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface GradientButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const GradientButton = React.forwardRef<HTMLButtonElement, GradientButtonProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "group relative inline-flex h-11 cursor-pointer items-center justify-center overflow-hidden rounded-full p-px transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
          className
        )}
        {...props}
      >
        {/* A light sweep that travels around the border */}
        <span className="absolute inset-[-1000%] animate-[spin_2.4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,var(--border)_0%,var(--foreground)_50%,var(--border)_100%)] opacity-70 transition-opacity group-hover:opacity-100 motion-reduce:animate-none" />

        <span className="relative flex h-full w-full items-center justify-center rounded-full bg-background px-6 text-sm font-medium text-foreground transition-colors group-hover:bg-muted">
          {children}
        </span>
      </button>
    );
  }
);
GradientButton.displayName = "GradientButton";
