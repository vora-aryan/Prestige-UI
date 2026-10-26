import * as React from "react";
import { cn } from "@/lib/utils";

type ShineButtonProps = React.ComponentProps<"button">;

function ShineButton({ className, children, ...props }: ShineButtonProps) {
  return (
    <button
      className={cn(
        "group relative inline-flex h-11 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-foreground px-6 text-sm font-medium text-background transition-transform duration-200 active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="relative z-10">{children}</span>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-hover:animate-shine-sweep dark:via-white/20"
      />
    </button>
  );
}

export { ShineButton, type ShineButtonProps };
