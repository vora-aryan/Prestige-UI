import { cn } from "@/lib/utils";

/**
 * The Prestige UI mark: a hexagonal P ribbon around a small shaded cube,
 * drawn inline so it needs no image files. Ink in light mode, slate in dark;
 * `tone="ink"` keeps the ink colors for marks that sit on white in any theme.
 */
function BrandMark({ className, tone = "auto" }: { className?: string; tone?: "auto" | "ink" }) {
  const dark = tone === "auto";
  return (
    <svg viewBox="245 214 764 764" className={cn("size-6 shrink-0", className)} aria-hidden>
      <path
        d="M626 222 961 414V772L622 975 519 917V780L628 835 838 712V481L628 357 413 481V866L292 798V414Z"
        strokeWidth="14"
        strokeLinejoin="round"
        className={cn("fill-[#1b1d23] stroke-[#1b1d23]", dark && "dark:fill-[#8fa2c3] dark:stroke-[#8fa2c3]")}
      />
      <path d="M627 478 734 539 627 600 520 539Z" className={cn("fill-[#9497a3]", dark && "dark:fill-[#e6e8f8]")} />
      <path d="M520 539 627 600V720L520 659Z" className={cn("fill-[#565865]", dark && "dark:fill-[#bcc0e0]")} />
      <path d="M627 600 734 539V659L627 720Z" className={cn("fill-[#2c2e36]", dark && "dark:fill-[#a5a8c7]")} />
    </svg>
  );
}

export { BrandMark };
