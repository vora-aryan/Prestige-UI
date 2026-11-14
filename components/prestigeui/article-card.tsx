import * as React from "react";
import { cn } from "@/lib/utils";

export interface ArticleCardProps {
  /** Where the card goes. */
  href: string;
  title: string;
  /** Two or three lines that make someone want to read on. */
  excerpt?: string;
  /** Cover image. */
  image?: { src: string; alt: string };
  /** Small label, e.g. "Engineering" or "Changelog". */
  category?: string;
  /** e.g. "6 min read". */
  readingTime?: string;
  author?: { name: string; avatar?: string };
  /** Display date, e.g. "Nov 12, 2026". Pass `dateTime` for the machine-readable value. */
  date?: string;
  dateTime?: string;
  className?: string;
}

/**
 * An article card that lays itself out by the space it is given, not the
 * screen: stacked when narrow, image beside the text from 512px wide, and a
 * featured layout with a larger title from 768px. Pure CSS, no client code.
 */
export function ArticleCard({
  href,
  title,
  excerpt,
  image,
  category,
  readingTime,
  author,
  date,
  dateTime,
  className,
}: ArticleCardProps) {
  const kicker = [category, readingTime].filter(Boolean);
  return (
    <article className={cn("@container min-w-0", className)}>
      <a
        href={href}
        className="group flex h-full flex-col overflow-clip rounded-lg bg-background shadow-[0_0_0_1px_rgba(0,0,0,0.07),0_1px_2px_rgba(0,0,0,0.04)] transition-shadow duration-200 outline-none hover:shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_10px_28px_-14px_rgba(0,0,0,0.2)] focus-visible:ring-2 focus-visible:ring-foreground/25 @lg:flex-row dark:bg-[#17171b] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.14),inset_0_1px_0_rgba(255,255,255,0.05)] dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]"
      >
        {image && (
          <div className="relative aspect-[16/10] shrink-0 overflow-clip bg-foreground/[0.05] @lg:aspect-auto @lg:min-h-[220px] @lg:w-[44%] @3xl:min-h-[340px] @3xl:w-[52%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.src}
              alt={image.alt}
              loading="lazy"
              draggable={false}
              className="absolute inset-0 size-full object-cover transition-[scale] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col p-5 @lg:p-6 @3xl:justify-center @3xl:p-10">
          {kicker.length > 0 && (
            <p className="flex items-center gap-2 text-[12px] text-muted-foreground @3xl:text-[13px]">
              {kicker.map((k, i) => (
                <React.Fragment key={k}>
                  {i > 0 && <span aria-hidden className="size-[3px] rounded-full bg-current opacity-50" />}
                  <span>{k}</span>
                </React.Fragment>
              ))}
            </p>
          )}

          <h3 className="mt-2.5 text-[17px] leading-snug font-medium tracking-[-0.01em] text-balance text-foreground @lg:text-[19px] @3xl:mt-3 @3xl:text-[28px] @3xl:leading-[1.15] @3xl:tracking-[-0.025em]">
            {/* The underline draws in on hover, and follows the title across lines. */}
            <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-[position:0_100%] bg-no-repeat pb-px transition-[background-size] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:bg-[length:100%_1px] group-focus-visible:bg-[length:100%_1px] [box-decoration-break:clone]">
              {title}
            </span>
          </h3>

          {excerpt && (
            <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-pretty text-muted-foreground @3xl:mt-3 @3xl:line-clamp-4 @3xl:text-[15px]">
              {excerpt}
            </p>
          )}

          {(author || date) && (
            <div className="mt-auto flex items-center gap-2.5 pt-5 text-[13px] @3xl:mt-0 @3xl:pt-8">
              {author?.avatar && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={author.avatar}
                  alt=""
                  loading="lazy"
                  className="size-6 shrink-0 rounded-full object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.06)]"
                />
              )}
              {author && <span className="truncate font-medium text-foreground">{author.name}</span>}
              {author && date && <span aria-hidden className="size-[3px] shrink-0 rounded-full bg-muted-foreground/50" />}
              {date && (
                <time dateTime={dateTime} className="shrink-0 text-muted-foreground tabular-nums">
                  {date}
                </time>
              )}
            </div>
          )}
        </div>
      </a>
    </article>
  );
}
