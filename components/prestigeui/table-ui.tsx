"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Columns3, Minus, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EASE,
  Select,
  popShadow,
  ring,
  settingsVars,
  thinScroll,
  useAnchoredLayer,
  useDismiss,
  useIsClient,
} from "@/components/prestigeui/settings-ui";

/*
 * Shared kit for the Data Table family: a table driven by column
 * definitions (sort, selection, reserved height), view tabs with counts,
 * search, filter popovers that count what each choice would show, a columns
 * menu, pagination, the bar for selected rows and CSV export.
 */

export { EASE };

/** An even in-out curve for things that travel, like a group folding; the house ease-out would snap. */
const TRAVEL = [0.65, 0, 0.35, 1] as const;

/** Monochrome, like the settings pages: value carries state, red means a problem. */
export const tableVars = settingsVars;

/* ------------------------------------------------------------------ */
/*  Columns, sorting and paging                                        */
/* ------------------------------------------------------------------ */

/** Container widths at which a column joins the table, as the table's own container query. */
export type Breakpoint = "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";

const breakpointPx: Record<Breakpoint, number> = { md: 448, lg: 512, xl: 576, "2xl": 672, "3xl": 768, "4xl": 896, "5xl": 1024 };

// Whole class names, so Tailwind can see them.
const showFromClass: Record<Breakpoint, string> = {
  md: "hidden @md/table:table-cell",
  lg: "hidden @lg/table:table-cell",
  xl: "hidden @xl/table:table-cell",
  "2xl": "hidden @2xl/table:table-cell",
  "3xl": "hidden @3xl/table:table-cell",
  "4xl": "hidden @4xl/table:table-cell",
  "5xl": "hidden @5xl/table:table-cell",
};

export type Column<T> = {
  id: string;
  /** The header, said once above the column. */
  header: string;
  cell: (row: T) => React.ReactNode;
  /** A fixed width in px, padding included. */
  width?: number;
  /**
   * For a column without a fixed width: the narrowest it may get. Columns
   * share the spare room, and when there isn't enough the table scrolls
   * sideways instead of letting cells run into each other.
   */
  minWidth?: number;
  /** Hidden until the table is this wide, e.g. a description on phones. */
  showFrom?: Breakpoint;
  /** What the column sorts by. Leave it out for columns that don't sort. */
  sortValue?: (row: T) => string | number;
  /** Numbers align to the end so their digits line up. */
  align?: "start" | "end";
  /** Extra classes for the header and cells, e.g. more space before the column. */
  className?: string;
  /** Can be turned off from the Columns menu. */
  hideable?: boolean;
  /** The detail behind a cell, shown on hover (an exact date, an email). */
  title?: (row: T) => string | undefined;
};

export type Sort = { id: string; desc: boolean };

export type TableGroup<T> = {
  id: string;
  label: React.ReactNode;
  /** What to show in each column of the header row, by column id. */
  summary?: Partial<Record<string, React.ReactNode>>;
  rows: T[];
  collapsed: boolean;
  onToggle: () => void;
};

export function sortRows<T>(rows: T[], columns: Column<T>[], sort: Sort | null) {
  const column = sort ? columns.find((entry) => entry.id === sort.id) : undefined;
  if (!sort || !column?.sortValue) return rows;
  const value = column.sortValue;
  const sign = sort.desc ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    if (typeof x === "number" && typeof y === "number") return (x - y) * sign;
    return String(x).localeCompare(String(y), undefined, { sensitivity: "base" }) * sign;
  });
}

export function pageOf<T>(rows: T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, page), pages);
  return { rows: rows.slice((current - 1) * size, current * size), page: current, pages };
}

/* ------------------------------------------------------------------ */
/*  Checkbox                                                           */
/* ------------------------------------------------------------------ */

/** A square checkbox with a mixed state for "some rows on this page". */
export function TableCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean | "mixed";
  onChange: (next: boolean, event: React.MouseEvent) => void;
  label: string;
}) {
  const on = checked !== false;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(event) => onChange(checked !== true, event)}
      // Shift-clicks select ranges; keep them from selecting text.
      onMouseDown={(event) => {
        if (event.shiftKey) event.preventDefault();
      }}
      className={cn(
        "relative grid size-[18px] shrink-0 cursor-pointer place-items-center rounded-[5px] transition-[background-color,box-shadow] duration-150",
        on
          ? "bg-foreground"
          : "shadow-[inset_0_0_0_1.5px_color-mix(in_oklab,var(--foreground)_28%,transparent)] hover:shadow-[inset_0_0_0_1.5px_color-mix(in_oklab,var(--foreground)_50%,transparent)]",
        ring,
      )}
    >
      <Check
        aria-hidden
        className={cn("absolute size-3 text-background transition-[opacity,scale] duration-150", checked === true ? "scale-100 opacity-100" : "scale-75 opacity-0")}
        strokeWidth={3}
      />
      <Minus
        aria-hidden
        className={cn("absolute size-3 text-background transition-[opacity,scale] duration-150", checked === "mixed" ? "scale-100 opacity-100" : "scale-75 opacity-0")}
        strokeWidth={3}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  The table                                                          */
/* ------------------------------------------------------------------ */

/**
 * A row is 44px plus its hairline (32px when compact). The body keeps room
 * for a full page, so short pages and empty results never move the footer.
 */
export const ROW_PITCH = 45;
const COMPACT_PITCH = 33;
const HEADER_HEIGHT = 41;
const COMPACT_HEADER = 33;
const CHECK_WIDTH = 44;

/** The table's width, once it is on screen. */
function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/**
 * The scrollbar of a table with a fixed height. It floats over the rows, under
 * the header, because a real one takes width as it appears and would nudge
 * every column. Browsers that keep a real one (Firefox) simply use that.
 */
function ScrollThumb({
  viewport,
  offset,
}: {
  viewport: React.RefObject<HTMLDivElement | null>;
  /** The header's height: the thumb travels below it. */
  offset: number;
}) {
  const thumb = React.useRef<HTMLSpanElement>(null);
  const geometry = React.useRef({ travel: 0, range: 0 });

  React.useEffect(() => {
    const node = viewport.current;
    const bar = thumb.current;
    if (!node || !bar) return;
    const sync = () => {
      const range = node.scrollHeight - node.clientHeight;
      if (range <= 1 || node.offsetWidth > node.clientWidth) {
        bar.style.display = "none";
        return;
      }
      const track = node.clientHeight - offset;
      const size = Math.max(32, (node.clientHeight / node.scrollHeight) * track);
      const travel = track - size;
      geometry.current = { travel, range };
      bar.style.display = "";
      bar.style.height = `${size}px`;
      bar.style.transform = `translateY(${offset + (node.scrollTop / range) * travel}px)`;
    };
    sync();
    node.addEventListener("scroll", sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    return () => {
      node.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [viewport, offset]);

  const onPointerDown = (event: React.PointerEvent<HTMLSpanElement>) => {
    const node = viewport.current;
    if (!node) return;
    event.preventDefault();
    const handle = event.currentTarget;
    const startY = event.clientY;
    const startTop = node.scrollTop;
    const { travel, range } = geometry.current;
    handle.setPointerCapture(event.pointerId);
    const move = (next: PointerEvent) => {
      if (travel > 0) node.scrollTop = startTop + ((next.clientY - startY) / travel) * range;
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  };

  return (
    <span
      ref={thumb}
      aria-hidden
      onPointerDown={onPointerDown}
      style={{ display: "none" }}
      className="group/thumb absolute top-0 right-0 z-20 flex w-3 touch-none justify-center py-0.5 will-change-transform"
    >
      <span className="w-1.5 rounded-full bg-foreground/20 transition-colors duration-150 group-hover/thumb:bg-foreground/35 group-active/thumb:bg-foreground/35" />
    </span>
  );
}

export function DataTable<T>({
  label,
  columns,
  rows,
  getRowId,
  sort,
  onSortChange,
  selected,
  onSelectedChange,
  reserveRows,
  visibleRows,
  bodyKey,
  empty,
  rowClassName,
  footer,
  density = "comfortable",
  onRowClick,
  activeRowId,
  groups,
  gridlines = false,
  className,
}: {
  /** Names the table for screen readers, e.g. "Payments". */
  label: string;
  /** The visible columns, in order. */
  columns: Column<T>[];
  /** The rows on this page. */
  rows: T[];
  getRowId: (row: T) => string;
  sort?: Sort | null;
  onSortChange?: (sort: Sort) => void;
  /** Selected ids. Leave out for a table without checkboxes. */
  selected?: Set<string>;
  onSelectedChange?: (next: Set<string>) => void;
  /** Rows of height to keep, usually the page size. */
  reserveRows?: number;
  /** Keeps the table this many rows tall, whatever the page size. Rows past it scroll under a pinned header. */
  visibleRows?: number;
  /** Changes when the query changes; the body fades in fresh. */
  bodyKey?: string;
  /** Shown in the body when there are no rows. */
  empty?: React.ReactNode;
  rowClassName?: (row: T) => string | undefined;
  /** A strip at the foot of the table card. */
  footer?: React.ReactNode;
  /** Called when a row is clicked anywhere outside its own controls, e.g. to open it in a panel. */
  onRowClick?: (row: T) => void;
  /** The row that is open elsewhere (a side panel): tinted, with an ink edge on its left. */
  activeRowId?: string | null;
  /**
   * Rows under group headers. Each header has a label in the first column
   * and a summary per column (e.g. a subtotal under the amounts); a click
   * folds the group. When given, `rows` is used only for selection.
   */
  groups?: TableGroup<T>[];
  /** Compact rows are 32px instead of 44px, for dense, spreadsheet-like work. */
  density?: "comfortable" | "compact";
  /** Hairlines between columns too, so every cell reads as its own box. */
  gridlines?: boolean;
  className?: string;
}) {
  const compact = density === "compact";
  const reduceMotion = useReducedMotion();
  const pitch = compact ? COMPACT_PITCH : ROW_PITCH;
  const headerHeight = compact ? COMPACT_HEADER : HEADER_HEIGHT;
  const selectable = Boolean(selected && onSelectedChange);
  const anchor = React.useRef<string | null>(null);
  const card = React.useRef<HTMLDivElement>(null);
  const viewport = React.useRef<HTMLDivElement>(null);
  const [sidewaysBar, setSidewaysBar] = React.useState(0);
  const width = useWidth(card);
  const ids = rows.map(getRowId);
  const picked = ids.filter((id) => selected?.has(id)).length;
  const pageState: boolean | "mixed" = picked === 0 ? false : picked === ids.length ? true : "mixed";

  // The table never gets narrower than its columns need; past that it scrolls.
  const shown = columns.filter((column) => !column.showFrom || width >= breakpointPx[column.showFrom]);
  // Hidden columns don't count: a row spanning them would give them width.
  const span = shown.length + (selectable ? 1 : 0);
  const needed = (selectable ? CHECK_WIDTH : 0) + shown.reduce((sum, column) => sum + (column.width ?? column.minWidth ?? 120), 0);
  const scrolls = width > 0 && needed > width;
  // Where the table sits in its scroll, so each edge can say there's more past it.
  const [scrollLeft, setScrollLeft] = React.useState(0);
  const moreLeft = scrolls && scrollLeft > 1;
  const moreRight = scrolls && scrollLeft + width < needed - 1;

  const toggleRow = (id: string, next: boolean, event: React.MouseEvent) => {
    if (!selected || !onSelectedChange) return;
    const out = new Set(selected);
    const from = anchor.current ? ids.indexOf(anchor.current) : -1;
    const to = ids.indexOf(id);
    // Shift-click sets every row between the last click and this one.
    const range = event.shiftKey && from !== -1 ? ids.slice(Math.min(from, to), Math.max(from, to) + 1) : [id];
    for (const each of range) {
      if (next) out.add(each);
      else out.delete(each);
    }
    anchor.current = id;
    onSelectedChange(out);
  };

  const togglePage = (next: boolean) => {
    if (!selected || !onSelectedChange) return;
    const out = new Set(selected);
    for (const id of ids) {
      if (next) out.add(id);
      else out.delete(id);
    }
    anchor.current = null;
    onSelectedChange(out);
  };

  const cellClass = (column: Column<T>, index: number) =>
    cn(
      "px-3",
      column.align === "end" ? "text-right" : "text-left",
      !selectable && index === 0 && "pl-5",
      index === columns.length - 1 && "pr-4",
      column.showFrom && showFromClass[column.showFrom],
      column.className,
    );

  const renderRow = (row: T, fold?: { last: boolean }) => {
    const id = getRowId(row);
    const on = selected?.has(id) ?? false;
    if (fold) return renderFoldingRow(row, fold.last);
    return (
      <tr
        key={id}
        aria-selected={selectable ? on : undefined}
        aria-current={activeRowId === id ? "true" : undefined}
        onClick={
          onRowClick
            ? (event) => {
                // Checkboxes and menus in the row keep their own clicks.
                if ((event.target as HTMLElement).closest("[role=checkbox], [aria-haspopup]")) return;
                onRowClick(row);
              }
            : undefined
        }
        className={cn(
          "transition-colors duration-150 [&:not(:last-child)>td]:border-b [&>td]:border-foreground/[0.06]",
          gridlines && "[&>td:not(:last-child)]:border-r",
          on || activeRowId === id ? "bg-foreground/[0.045]" : "hover:bg-foreground/[0.02]",
          onRowClick && "cursor-pointer",
          activeRowId === id && "[&>td:first-child]:shadow-[inset_2px_0_0_var(--foreground)]",
          rowClassName?.(row),
        )}
      >
        {selectable ? (
          <td className={cn("pr-1 pl-4 align-middle", compact ? "h-8" : "h-11")}>
            <TableCheckbox checked={on} onChange={(next, event) => toggleRow(id, next, event)} label={`Select row ${id}`} />
          </td>
        ) : null}
        {columns.map((column, index) => (
          <td
            key={column.id}
            title={column.title?.(row)}
            className={cn(
              "align-middle leading-5 whitespace-nowrap",
              compact ? "h-8 py-1.5" : "h-11 py-2.5",
              column.align === "end" && "tabular-nums",
              cellClass(column, index),
            )}
          >
            {column.cell(row)}
          </td>
        ))}
      </tr>
    );
  };

  /*
   * A row inside a group. Table rows can't animate their height, so each
   * cell's content sits in a box that does, carrying the row's padding and
   * hairline too. The row then folds to exactly nothing, and what's below
   * glides up with it instead of jumping when it's gone.
   */
  // One value per row drives its cells: --fold for height (on the even travel
  // curve) and --fade for opacity. Animating the row, not each cell, keeps a
  // long group cheap enough to open without dropping frames.
  const rowHeight = (compact ? COMPACT_PITCH : ROW_PITCH) - 1;
  const fold = {
    open: {
      "--fold": 1,
      "--fade": 1,
      transition: reduceMotion
        ? { duration: 0 }
        : { "--fold": { duration: 0.34, ease: TRAVEL }, "--fade": { duration: 0.24, delay: 0.08, ease: EASE } },
    },
    folded: {
      "--fold": 0,
      "--fade": 0,
      // The fade runs with the fold, so a closing group never leaves a blank band behind.
      transition: reduceMotion ? { duration: 0 } : { "--fold": { duration: 0.28, ease: TRAVEL }, "--fade": { duration: 0.28, ease: TRAVEL } },
    },
  };

  const renderFoldingRow = (row: T, last: boolean) => {
    const id = getRowId(row);
    const on = selected?.has(id) ?? false;
    const boxStyle: React.CSSProperties = {
      height: `calc(var(--fold) * ${rowHeight + (last ? 0 : 1)}px)`,
      opacity: "var(--fade)",
    };
    const box = (index: number, column?: Column<T>) =>
      cn(
        "overflow-hidden leading-5 whitespace-nowrap",
        // The hairline is an inset shadow, not a border: a border keeps at least 1px
        // of height, so a folded row would linger; a shadow lets it reach exactly nothing.
        !last && "shadow-[inset_0_-1px_0_color-mix(in_oklab,var(--foreground)_6%,transparent)]",
        gridlines && index < columns.length - 1 + (selectable ? 1 : 0) && "border-r border-foreground/[0.06]",
        column
          ? cn(
              "px-3",
              column.align === "end" && "text-right tabular-nums",
              !selectable && index === 0 && "pl-5",
              index === columns.length - 1 + (selectable ? 1 : 0) && "pr-4",
              column.className,
            )
          : "pr-1 pl-4",
      );
    return (
      <motion.tr
        key={id}
        initial="folded"
        animate="open"
        exit="folded"
        variants={fold}
        aria-selected={selectable ? on : undefined}
        aria-current={activeRowId === id ? "true" : undefined}
        onClick={
          onRowClick
            ? (event) => {
                if ((event.target as HTMLElement).closest("[role=checkbox], [aria-haspopup]")) return;
                onRowClick(row);
              }
            : undefined
        }
        className={cn(
          "transition-colors duration-150",
          on || activeRowId === id ? "bg-foreground/[0.045]" : "hover:bg-foreground/[0.02]",
          onRowClick && "cursor-pointer",
          rowClassName?.(row),
        )}
      >
        {selectable ? (
          <td className="p-0 align-top">
            <div style={boxStyle} className={box(0)}>
              <div style={{ height: rowHeight }} className="flex items-center">
                <TableCheckbox checked={on} onChange={(next, event) => toggleRow(id, next, event)} label={`Select row ${id}`} />
              </div>
            </div>
          </td>
        ) : null}
        {columns.map((column, index) => (
          <td key={column.id} title={column.title?.(row)} className={cn("p-0 align-top", column.showFrom && showFromClass[column.showFrom])}>
            {/* The content keeps its height; the box's edge slides over it, like a curtain. */}
            <div style={boxStyle} className={box(index + (selectable ? 1 : 0), column)}>
              <div style={{ height: rowHeight }} className={cn("flex items-center", column.align === "end" && "justify-end")}>
                {column.cell(row)}
              </div>
            </div>
          </td>
        ))}
      </motion.tr>
    );
  };

  // A sideways scrollbar takes height from the rows, so the view grows by it.
  React.useEffect(() => {
    const node = viewport.current;
    if (!visibleRows || !node) return;
    const observer = new ResizeObserver(() => setSidewaysBar(node.offsetHeight - node.clientHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, [visibleRows]);

  // A new page, sort or filter starts from its first row.
  React.useEffect(() => {
    if (visibleRows && viewport.current) viewport.current.scrollTop = 0;
  }, [bodyKey, visibleRows]);

  return (
    <div
      ref={card}
      className={cn(
        "@container/table overflow-hidden rounded-[var(--r-panel,14px)] border border-foreground/[0.09]",
        className,
      )}
    >
      <div className="relative">
        <div
          ref={viewport}
          onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}
          className={
            visibleRows
              ? "overflow-auto [scrollbar-color:auto] [scrollbar-width:auto] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-foreground/20 [&::-webkit-scrollbar]:h-1.5! [&::-webkit-scrollbar]:w-0!"
              : "overflow-x-auto overflow-y-hidden [scrollbar-color:color-mix(in_oklab,var(--foreground)_20%,transparent)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-foreground/20 [&::-webkit-scrollbar-track]:bg-transparent"
          }
          style={
            visibleRows
              ? { height: headerHeight + visibleRows * pitch - 1 + sidewaysBar }
              : reserveRows
                ? { minHeight: headerHeight + reserveRows * pitch - 1 }
                : undefined
          }
        >
          <table
            aria-label={label}
            style={scrolls ? { minWidth: needed } : undefined}
            className="w-full table-fixed border-separate border-spacing-0 text-[13.5px]"
          >
            <thead>
              {/* The header is its own band: tinted, with medium labels, so it never reads as a row. */}
              <tr
                className={cn(
                  compact ? "[&>th]:h-8" : "[&>th]:h-10",
                  gridlines && "[&>th:not(:last-child)]:border-r [&>th:not(:last-child)]:border-r-foreground/[0.07]",
                  "[&>th]:border-b [&>th]:border-foreground/[0.08] [&>th]:bg-foreground/[0.035] [&>th]:text-[12.5px] [&>th]:font-medium [&>th]:whitespace-nowrap [&>th]:text-foreground/55",
                  // Pinned, the band has to hide the rows passing under it: the same tint, made solid.
                  visibleRows &&
                    "[&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-background [&>th]:bg-[linear-gradient(color-mix(in_oklab,var(--foreground)_3.5%,transparent),color-mix(in_oklab,var(--foreground)_3.5%,transparent))]",
                )}
              >
                {selectable ? (
                  <th scope="col" style={{ width: CHECK_WIDTH }} className="pr-1 pl-4 text-left">
                    <TableCheckbox
                      checked={pageState}
                      onChange={(next) => togglePage(next)}
                      label={pageState === true ? "Deselect the rows on this page" : "Select the rows on this page"}
                    />
                  </th>
                ) : null}
                {columns.map((column, index) => {
                  const active = sort?.id === column.id;
                  return (
                    <th
                      key={column.id}
                      scope="col"
                      aria-sort={active ? (sort!.desc ? "descending" : "ascending") : undefined}
                      style={column.width ? { width: column.width } : undefined}
                      className={cellClass(column, index)}
                    >
                      {column.sortValue && onSortChange ? (
                        <SortButton
                          label={column.header}
                          align={column.align}
                          state={active ? (sort!.desc ? "desc" : "asc") : null}
                          // A new column starts with the order people want first: biggest, newest.
                          onClick={() => onSortChange({ id: column.id, desc: active ? !sort!.desc : true })}
                        />
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <motion.tbody
              key={bodyKey}
              initial={bodyKey ? { opacity: 0.35 } : false}
              animate={{ opacity: 1, transition: { duration: 0.28, ease: EASE } }}
            >
              {rows.length === 0 && !groups?.some((group) => group.rows.length) ? (
                <tr>
                  <td colSpan={span} style={reserveRows ? { height: reserveRows * pitch - 1 } : undefined} className="px-5 py-10 text-center">
                    {empty}
                  </td>
                </tr>
              ) : groups ? (
                <AnimatePresence initial={false}>
                  {groups.flatMap((group, groupIndex) => [
                    <tr
                      key={`group:${group.id}`}
                      onClick={group.onToggle}
                      className={cn(
                        "cursor-pointer bg-foreground/[0.02] transition-colors duration-150 hover:bg-foreground/[0.04] [&:not(:last-child)>td]:border-b [&>td]:border-foreground/[0.07]",
                        gridlines && "[&>td:not(:last-child)]:border-r",
                      )}
                    >
                      {selectable ? <td className={compact ? "h-8" : "h-10"} /> : null}
                      {columns.map((column, index) => (
                        <td
                          key={column.id}
                          className={cn(
                            "align-middle whitespace-nowrap",
                            compact ? "h-8 py-1" : "h-10 py-1.5",
                            column.align === "end" && "tabular-nums",
                            cellClass(column, index),
                            // The label may run on over the empty cells beside it.
                            index === 0 && "relative z-[1] overflow-visible",
                          )}
                        >
                          {index === 0 ? (
                            <button
                              type="button"
                              aria-expanded={!group.collapsed}
                              onClick={(event) => {
                                event.stopPropagation();
                                group.onToggle();
                              }}
                              className={cn("-ml-1.5 inline-flex h-7 cursor-pointer items-center gap-2 rounded-[7px] pr-1.5 pl-1 text-[13.5px] font-medium", ring)}
                            >
                              <ChevronRight
                                aria-hidden
                                className={cn("size-4 shrink-0 text-foreground/45 transition-transform duration-200 ease-[cubic-bezier(.16,1,.3,1)]", !group.collapsed && "rotate-90")}
                                strokeWidth={2}
                              />
                              {group.label}
                            </button>
                          ) : (
                            group.summary?.[column.id] ?? null
                          )}
                        </td>
                      ))}
                    </tr>,
                    ...(group.collapsed
                      ? []
                      : group.rows.map((row, index) =>
                          renderRow(row, { last: groupIndex === groups.length - 1 && index === group.rows.length - 1 }),
                        )),
                  ])}
                </AnimatePresence>
              ) : (
                rows.map((row) => renderRow(row))
              )}
            </motion.tbody>
          </table>
        </div>
        {visibleRows ? <ScrollThumb viewport={viewport} offset={headerHeight} /> : null}
        {/* The whole table scrolls as one; a soft shadow on each edge that hides more, like a page edge. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-6 bg-[linear-gradient(to_right,rgba(0,0,0,0.07),transparent)] transition-opacity duration-200 dark:bg-[linear-gradient(to_right,rgba(0,0,0,0.55),transparent)]",
            moreLeft ? "opacity-100" : "opacity-0",
          )}
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-6 bg-[linear-gradient(to_left,rgba(0,0,0,0.07),transparent)] transition-opacity duration-200 dark:bg-[linear-gradient(to_left,rgba(0,0,0,0.55),transparent)]",
            moreRight ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
      {footer ? (
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-foreground/[0.07] px-4 py-2 text-[13px] text-foreground/55">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  The virtual table                                                  */
/* ------------------------------------------------------------------ */

/** Rows drawn past each edge of the view, so a fast scroll never shows a blank band. */
const OVERSCAN = 8;

export type VisibleRange = {
  /** The first row in view, counting from 1. */
  first: number;
  /** The last row in view. */
  last: number;
};

/**
 * A table for tens of thousands of rows. It scrolls inside a box of fixed
 * height under a header that stays put, and draws only the rows in view
 * plus a few past each edge; spacer rows above and below keep the scrollbar
 * true to the full length. Every row has the same height, so any row's place
 * is a multiplication, not a measurement.
 *
 * Arrow keys, Page Up/Down, Home and End move a highlight through the rows,
 * scrolling it into view; Enter opens the highlighted row.
 */
export function VirtualDataTable<T>({
  label,
  columns,
  rows,
  getRowId,
  sort,
  onSortChange,
  height = 560,
  density = "compact",
  bodyKey,
  empty,
  footer,
  onRowOpen,
  rowClassName,
  className,
}: {
  /** Names the table for screen readers, e.g. "Requests". */
  label: string;
  columns: Column<T>[];
  /** Every row, in order. Only the ones in view are drawn. */
  rows: T[];
  getRowId: (row: T) => string;
  sort?: Sort | null;
  onSortChange?: (sort: Sort) => void;
  /** The scroll box's height in px, header included. */
  height?: number;
  density?: "comfortable" | "compact";
  /** Changes when the query changes; the list goes back to the top and fades in fresh. */
  bodyKey?: string;
  /** Shown in the box when there are no rows. */
  empty?: React.ReactNode;
  /** A strip at the foot of the card. It's told which rows are in view. */
  footer?: (range: VisibleRange) => React.ReactNode;
  /** Called on a click or Enter, e.g. to open the row in a panel. */
  onRowOpen?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  className?: string;
}) {
  const compact = density === "compact";
  const pitch = compact ? COMPACT_PITCH : ROW_PITCH;
  const headerHeight = compact ? COMPACT_HEADER : HEADER_HEIGHT;
  const id = React.useId();
  const card = React.useRef<HTMLDivElement>(null);
  const viewport = React.useRef<HTMLDivElement>(null);
  const width = useWidth(card);

  // The first row in view, and whether more of the table hides past each side.
  // Both only change when a row or an edge is crossed, so scrolling re-renders rarely.
  const [first, setFirst] = React.useState(0);
  const [edges, setEdges] = React.useState({ left: false, right: false });
  const [activeId, setActiveId] = React.useState<string | null>(null);

  // A new query starts again at the top.
  const [shownKey, setShownKey] = React.useState(bodyKey);
  if (bodyKey !== shownKey) {
    setShownKey(bodyKey);
    setFirst(0);
  }
  React.useEffect(() => {
    if (viewport.current) viewport.current.scrollTop = 0;
  }, [bodyKey]);

  const shown = columns.filter((column) => !column.showFrom || width >= breakpointPx[column.showFrom]);
  const needed = shown.reduce((sum, column) => sum + (column.width ?? column.minWidth ?? 120), 0);
  const scrolls = width > 0 && needed > width;

  const inView = Math.ceil((height - headerHeight) / pitch);
  const top = Math.min(first, Math.max(0, rows.length - 1));
  const start = Math.max(0, top - OVERSCAN);
  const end = Math.min(rows.length, top + inView + OVERSCAN);
  const range: VisibleRange = { first: rows.length ? top + 1 : 0, last: Math.min(rows.length, top + inView) };

  const onScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    setFirst(Math.floor(node.scrollTop / pitch));
    const left = node.scrollLeft > 1;
    const right = node.scrollLeft + node.clientWidth < node.scrollWidth - 1;
    setEdges((current) => (current.left === left && current.right === right ? current : { left, right }));
  };

  /** Scrolls just enough to bring a row out from under the header or the bottom edge. */
  const reveal = (index: number) => {
    const node = viewport.current;
    if (!node) return;
    const rowTop = index * pitch;
    if (rowTop < node.scrollTop) node.scrollTop = rowTop;
    else if (headerHeight + rowTop + pitch > node.scrollTop + node.clientHeight) node.scrollTop = headerHeight + rowTop + pitch - node.clientHeight;
  };

  const activeIndex = activeId ? rows.findIndex((row) => getRowId(row) === activeId) : -1;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!rows.length) return;
    if (event.key === "Enter" && activeIndex !== -1) {
      event.preventDefault();
      onRowOpen?.(rows[activeIndex]);
      return;
    }
    if (event.key === "Escape" && activeId) {
      event.preventDefault();
      setActiveId(null);
      return;
    }
    const page = Math.max(1, inView - 1);
    // With nothing highlighted yet, the first move lands on the top row in view.
    const from = activeIndex === -1 ? top - 1 : activeIndex;
    const steps: Record<string, number> = {
      ArrowDown: from + 1,
      ArrowUp: activeIndex === -1 ? top : from - 1,
      PageDown: from + page,
      PageUp: from - page,
      Home: 0,
      End: rows.length - 1,
    };
    if (!(event.key in steps)) return;
    event.preventDefault();
    const next = Math.min(rows.length - 1, Math.max(0, steps[event.key]));
    setActiveId(getRowId(rows[next]));
    reveal(next);
  };

  const cellClass = (column: Column<T>, index: number) => virtualCellClass(column, index, columns.length);

  // Rows keep one open handler for good, so scrolling redraws only the rows that come into view.
  const latest = React.useRef(onRowOpen);
  React.useEffect(() => {
    latest.current = onRowOpen;
  }, [onRowOpen]);
  const open = React.useCallback((row: unknown, rowId: string) => {
    setActiveId(rowId);
    latest.current?.(row as T);
  }, []);

  // Spacers span only the columns on screen: spanning hidden ones would make empty columns that take width.
  const spacer = (rowsHigh: number, key: string) =>
    rowsHigh > 0 ? (
      <tr key={key} aria-hidden style={{ height: rowsHigh * pitch }}>
        <td colSpan={Math.max(1, shown.length)} className="p-0" />
      </tr>
    ) : null;

  return (
    <div
      ref={card}
      className={cn(
        "@container/table overflow-hidden rounded-[var(--r-panel,14px)] border border-foreground/[0.09] transition-shadow duration-150",
        // The list takes keys, so it shows the same soft ring as any control when focused.
        "has-[table:focus-visible]:shadow-[0_0_0_3px_color-mix(in_oklab,var(--foreground)_10%,transparent)]",
        className,
      )}
    >
      <div className="relative">
        <div
          ref={viewport}
          onScroll={onScroll}
          style={{ height }}
          className="overflow-auto [scrollbar-color:color-mix(in_oklab,var(--foreground)_20%,transparent)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:size-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-foreground/20 [&::-webkit-scrollbar-track]:bg-transparent"
        >
          <table
            role="grid"
            aria-label={label}
            aria-readonly
            aria-rowcount={rows.length + 1}
            aria-activedescendant={activeIndex !== -1 ? `${id}-row-${activeIndex}` : undefined}
            tabIndex={0}
            onKeyDown={onKeyDown}
            style={scrolls ? { minWidth: needed } : undefined}
            className="w-full table-fixed border-separate border-spacing-0 text-[13.5px] outline-none"
          >
            <thead>
              {/* The header stays at the top while the rows pass under it, so it needs an opaque fill under its tint. */}
              <tr
                aria-rowindex={1}
                className={cn(
                  compact ? "[&>th]:h-[33px]" : "[&>th]:h-[41px]",
                  "[&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:border-b [&>th]:border-foreground/[0.08] [&>th]:bg-background [&>th]:bg-[linear-gradient(color-mix(in_oklab,var(--foreground)_3.5%,transparent),color-mix(in_oklab,var(--foreground)_3.5%,transparent))]",
                  "[&>th]:text-[12.5px] [&>th]:font-medium [&>th]:whitespace-nowrap [&>th]:text-foreground/55",
                )}
              >
                {columns.map((column, index) => {
                  const active = sort?.id === column.id;
                  return (
                    <th
                      key={column.id}
                      scope="col"
                      aria-sort={active ? (sort!.desc ? "descending" : "ascending") : undefined}
                      style={column.width ? { width: column.width } : undefined}
                      className={cellClass(column, index)}
                    >
                      {column.sortValue && onSortChange ? (
                        <SortButton
                          label={column.header}
                          align={column.align}
                          state={active ? (sort!.desc ? "desc" : "asc") : null}
                          onClick={() => onSortChange({ id: column.id, desc: active ? !sort!.desc : true })}
                        />
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <motion.tbody key={bodyKey} initial={bodyKey ? { opacity: 0.35 } : false} animate={{ opacity: 1, transition: { duration: 0.28, ease: EASE } }}>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(1, shown.length)} style={{ height: height - headerHeight }} className="px-5 text-center">
                    {empty}
                  </td>
                </tr>
              ) : (
                <>
                  {spacer(start, "above")}
                  {rows.slice(start, end).map((row, offset) => {
                    const index = start + offset;
                    const rowId = getRowId(row);
                    return (
                      <VirtualRow
                        key={rowId}
                        row={row}
                        rowId={rowId}
                        index={index}
                        domId={`${id}-row-${index}`}
                        active={rowId === activeId}
                        last={index === rows.length - 1}
                        columns={columns}
                        compact={compact}
                        clickable={Boolean(onRowOpen)}
                        extraClass={rowClassName?.(row)}
                        onOpen={open}
                      />
                    );
                  })}
                  {spacer(rows.length - end, "below")}
                </>
              )}
            </motion.tbody>
          </table>
        </div>
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-6 bg-[linear-gradient(to_right,rgba(0,0,0,0.07),transparent)] transition-opacity duration-200 dark:bg-[linear-gradient(to_right,rgba(0,0,0,0.55),transparent)]",
            scrolls && edges.left ? "opacity-100" : "opacity-0",
          )}
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-6 bg-[linear-gradient(to_left,rgba(0,0,0,0.07),transparent)] transition-opacity duration-200 dark:bg-[linear-gradient(to_left,rgba(0,0,0,0.55),transparent)]",
            // Before the first scroll, the right edge hides more whenever the table is wider than its box.
            scrolls && (edges.right || (!edges.left && !edges.right)) ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
      {footer ? (
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-foreground/[0.07] px-4 py-2 text-[13px] text-foreground/55">
          {footer(range)}
        </div>
      ) : null}
    </div>
  );
}

function virtualCellClass<T>(column: Column<T>, index: number, count: number) {
  return cn(
    "px-3",
    column.align === "end" ? "text-right" : "text-left",
    index === 0 && "pl-5",
    index === count - 1 && "pr-5",
    column.showFrom && showFromClass[column.showFrom],
    column.className,
  );
}

type VirtualRowProps<T> = {
  row: T;
  rowId: string;
  index: number;
  domId: string;
  active: boolean;
  last: boolean;
  columns: Column<T>[];
  compact: boolean;
  clickable: boolean;
  extraClass?: string;
  onOpen: (row: unknown, rowId: string) => void;
};

/** One drawn row. Memoized, so rows already on screen skip the render when the window moves. */
const VirtualRow = React.memo(function VirtualRow<T>({ row, rowId, index, domId, active, last, columns, compact, clickable, extraClass, onOpen }: VirtualRowProps<T>) {
  return (
    <tr
      id={domId}
      aria-rowindex={index + 2}
      aria-selected={active}
      onClick={() => onOpen(row, rowId)}
      className={cn(
        "transition-colors duration-150 [&>td]:border-foreground/[0.06]",
        // The last row's hairline would double the card's own edge.
        !last && "[&>td]:border-b",
        active ? "bg-foreground/[0.045] [&>td:first-child]:shadow-[inset_2px_0_0_var(--foreground)]" : "hover:bg-foreground/[0.02]",
        clickable && "cursor-pointer",
        extraClass,
      )}
    >
      {columns.map((column, columnIndex) => (
        <td
          key={column.id}
          title={column.title?.(row)}
          className={cn(
            // No vertical padding: the cell's height is the row's, so a 22px badge can't stretch it
            // and every row stays exactly one pitch tall, which the scroll math depends on.
            // A cell's height counts its hairline, so it is set to the full pitch.
            "overflow-hidden py-0 align-middle leading-5 text-ellipsis whitespace-nowrap",
            compact ? "h-[33px]" : "h-[45px]",
            column.align === "end" && "tabular-nums",
            virtualCellClass(column, columnIndex, columns.length),
          )}
        >
          {column.cell(row)}
        </td>
      ))}
    </tr>
  );
}) as <T>(props: VirtualRowProps<T>) => React.ReactElement;

/* ------------------------------------------------------------------ */
/*  Status badge                                                       */
/* ------------------------------------------------------------------ */

/**
 * Each tone is one color: the text uses it, the fill is a 12% mix of it.
 * Deep, muted hues that sit on white, each lifted for dark mode.
 */
const badgeTone = {
  /** Done, as expected. */
  success: "[--badge:#2b7a4b] dark:[--badge:#6fcf97]",
  /** Settled and informational, e.g. money sent back. */
  info: "[--badge:#2f68b0] dark:[--badge:#86b4ee]",
  /** Waiting on someone. */
  warning: "[--badge:#a8620f] dark:[--badge:#f2b56b]",
  /** Went wrong. */
  danger: "[--badge:#c23b33] dark:[--badge:#f0716a]",
  /** In progress or unknown. */
  neutral: "[--badge:color-mix(in_oklab,var(--foreground)_65%,transparent)]",
};

/** A status in one shape for every state; the tone and icon tell them apart. */
export function StatusBadge({
  tone,
  icon,
  compact = false,
  children,
}: {
  tone: keyof typeof badgeTone;
  /** A 12px icon, or a spinner while something is in progress. */
  icon?: React.ReactNode;
  /** Only the icon, in a 22px square, for narrow screens. The label stays for screen readers and on hover. */
  compact?: boolean;
  children: string;
}) {
  return (
    <span
      title={compact ? children : undefined}
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center rounded-[6px] text-[12px] leading-none font-medium whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0",
        compact ? "w-[22px] justify-center" : "gap-1 pr-2 pl-1.5",
        "bg-[color-mix(in_oklab,var(--badge)_12%,transparent)] text-(--badge)",
        badgeTone[tone],
      )}
    >
      {icon}
      <span className={cn(compact && "sr-only")}>{children}</span>
    </span>
  );
}

/** A header that sorts. The arrow's box is always there, so labels never move. */
function SortButton({
  label,
  align,
  state,
  onClick,
}: {
  label: string;
  align?: "start" | "end";
  state: "asc" | "desc" | null;
  onClick: () => void;
}) {
  const Arrow = state === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group -mx-1.5 inline-flex h-7 cursor-pointer items-center gap-1 rounded-[7px] px-1.5 transition-colors duration-150 hover:text-foreground",
        align === "end" && "flex-row-reverse",
        state ? "text-foreground" : "",
        ring,
      )}
    >
      {label}
      <Arrow
        aria-hidden
        className={cn("size-3.5 transition-opacity duration-150", state ? "opacity-70" : "opacity-0 group-hover:opacity-35")}
        strokeWidth={2}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  View tabs                                                          */
/* ------------------------------------------------------------------ */

export type View = { id: string; label: string; count?: number };

/** Saved views with what each one holds: square boxes in a track, and a pill that glides to the open one. */
export function ViewTabs({
  label,
  views,
  value,
  onChange,
  controls,
}: {
  label: string;
  views: View[];
  value: string;
  onChange: (id: string) => void;
  /** The id of the table these views filter. */
  controls?: string;
}) {
  const id = React.useId();
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[var(--r-control,10px)] bg-foreground/[0.05] p-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      onKeyDown={(event) => {
        const index = views.findIndex((view) => view.id === value);
        const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        const next = (index + step + views.length) % views.length;
        onChange(views[next].id);
        refs.current[next]?.focus();
      }}
    >
      {views.map((view, i) => {
        const on = view.id === value;
        return (
          <button
            key={view.id}
            ref={(node) => {
              refs.current[i] = node;
            }}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={controls}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(view.id)}
            className={cn(
              "relative flex h-8 shrink-0 cursor-pointer items-center rounded-[var(--r-item,8px)] px-3 text-[13.5px] font-medium whitespace-nowrap",
              // Labels change color over the pill's glide, so they never vanish mid-travel.
              "transition-colors duration-300",
              on ? "text-foreground" : "text-foreground/55 hover:text-foreground/85",
              ring,
            )}
          >
            {on ? (
              <motion.span
                layoutId={`${id}-pill`}
                transition={{ type: "spring", bounce: 0, duration: 0.42 }}
                className="absolute inset-0 rounded-[var(--r-item,8px)] bg-(--st-pop) shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.06)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
              />
            ) : null}
            <span className="relative z-10 flex items-center gap-1.5">
              {view.label}
              {view.count === undefined ? null : (
                <span className={cn("tabular-nums transition-colors duration-300", on ? "text-foreground/45" : "text-foreground/35")}>
                  {view.count.toLocaleString("en-US")}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Search                                                             */
/* ------------------------------------------------------------------ */

/** A search field. "/" jumps to it from anywhere on the page; Escape clears it. */
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  const input = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      const field = input.current;
      // Only the search that is on screen answers.
      if (!field || field.getBoundingClientRect().bottom < 0 || field.getBoundingClientRect().top > window.innerHeight) return;
      event.preventDefault();
      field.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <label
      className={cn(
        "group relative flex h-9 items-center rounded-[var(--r-control,10px)] border border-foreground/[0.12] bg-background transition-[border-color,box-shadow] duration-150 hover:border-foreground/25 focus-within:border-foreground/40 focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--foreground)_10%,transparent)] dark:bg-white/[0.02]",
        className,
      )}
    >
      <Search aria-hidden className="ml-3 size-4 shrink-0 text-foreground/40" strokeWidth={1.8} />
      <input
        ref={input}
        type="search"
        value={value}
        aria-label={label}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault();
            onChange("");
          }
        }}
        className="h-full min-w-0 flex-1 bg-transparent px-2 text-[14px] text-foreground outline-none placeholder:text-foreground/40 [&::-webkit-search-cancel-button]:hidden"
      />
      <span className="mr-2 grid size-5 shrink-0 place-items-center">
        <kbd
          aria-hidden
          className={cn(
            // Touch screens have no "/" to press.
            "col-start-1 row-start-1 grid size-5 place-items-center rounded-[5px] font-sans text-[11.5px] text-foreground/45 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--foreground)_14%,transparent)] transition-opacity duration-150 group-focus-within:opacity-0 [@media(pointer:coarse)]:hidden",
            value && "opacity-0",
          )}
        >
          /
        </kbd>
        <button
          type="button"
          aria-label="Clear search"
          tabIndex={value ? 0 : -1}
          onClick={() => {
            onChange("");
            input.current?.focus();
          }}
          className={cn(
            "col-start-1 row-start-1 grid size-5 cursor-pointer place-items-center rounded-[5px] text-foreground/45 transition-opacity duration-150 hover:bg-foreground/[0.06] hover:text-foreground",
            value ? "opacity-100" : "pointer-events-none opacity-0",
            ring,
          )}
        >
          <X className="size-3.5" strokeWidth={2} />
        </button>
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Popovers: filters and columns                                      */
/* ------------------------------------------------------------------ */

function usePopover({ minWidth, align }: { minWidth: number; align: "start" | "end" }) {
  const [open, setOpen] = React.useState(false);
  const button = React.useRef<HTMLButtonElement>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus({ preventScroll: true });
  }, []);
  useAnchoredLayer(open, () => button.current, () => panel.current, { minWidth, align, width: "auto" });
  useDismiss(open, [panel, button], () => close(false));
  React.useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>("[role^=menuitem]")?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [open]);
  return { open, setOpen, button, panel, close };
}

function PopoverPanel({
  open,
  panel,
  close,
  label,
  children,
  footer,
}: {
  open: boolean;
  panel: React.RefObject<HTMLDivElement | null>;
  close: (refocus?: boolean) => void;
  label: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const isClient = useIsClient();
  if (!isClient) return null;
  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={panel}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.18, ease: EASE } }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          onKeyDown={(event) => {
            const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[role^=menuitem]"));
            const index = items.indexOf(document.activeElement as HTMLElement);
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const step = event.key === "ArrowDown" ? 1 : -1;
              items[(index + step + items.length) % items.length]?.focus();
            } else if (event.key === "Escape" || event.key === "Tab") {
              if (event.key === "Escape") event.preventDefault();
              close(event.key === "Escape");
            }
          }}
          className={cn("fixed z-[1000] overflow-hidden rounded-[var(--r-panel,14px)] bg-(--st-pop) font-sans text-foreground", tableVars, popShadow)}
        >
          <div role="menu" aria-label={label} className={cn("max-h-[300px] overflow-y-auto p-1.5", thinScroll)}>
            {children}
          </div>
          {footer ? <div className="border-t border-foreground/[0.07] p-1.5">{footer}</div> : null}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

function CheckRow({
  checked,
  radio,
  label,
  count,
  onToggle,
}: {
  checked: boolean;
  radio?: boolean;
  label: string;
  count?: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role={radio ? "menuitemradio" : "menuitemcheckbox"}
      aria-checked={checked}
      onClick={onToggle}
      className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-[var(--r-item,9px)] px-2.5 text-left text-[13.5px] outline-none hover:bg-foreground/[0.05] focus-visible:bg-foreground/[0.05]"
    >
      {radio ? (
        <Check aria-hidden className={cn("size-4 shrink-0", checked ? "text-foreground/75" : "text-transparent")} strokeWidth={2} />
      ) : (
        <span
          aria-hidden
          className={cn(
            "grid size-4 shrink-0 place-items-center rounded-[4px] transition-[background-color,box-shadow] duration-150",
            checked ? "bg-foreground" : "shadow-[inset_0_0_0_1.5px_color-mix(in_oklab,var(--foreground)_28%,transparent)]",
          )}
        >
          <Check className={cn("size-2.5 text-background transition-opacity duration-150", !checked && "opacity-0")} strokeWidth={3.2} />
        </span>
      )}
      <span className="min-w-0 flex-1 whitespace-nowrap">{label}</span>
      {count !== undefined ? (
        <span className={cn("shrink-0 pl-4 text-[12.5px] tabular-nums", count === 0 ? "text-foreground/30" : "text-foreground/45")}>
          {count.toLocaleString("en-US")}
        </span>
      ) : null}
    </button>
  );
}

export type FilterOption = { value: string; label: string; count?: number };

/**
 * A filter on one field. Empty, it is a quiet dashed button; set, it reads
 * as a sentence ("Method Visa, Amex") with its own clear button. Each choice
 * shows how many rows it would add, given the other filters.
 */
export function FilterButton({
  label,
  options,
  value,
  onChange,
  multiple = true,
  clearValue,
}: {
  label: string;
  options: FilterOption[];
  /** Chosen values. For a single choice, one value. */
  value: string[];
  onChange: (value: string[]) => void;
  multiple?: boolean;
  /** For a single choice: the value that means "no filter", e.g. "any". */
  clearValue?: string;
}) {
  const { open, setOpen, button, panel, close } = usePopover({ minWidth: 220, align: "start" });
  const active = multiple ? value.length > 0 : Boolean(value[0] && value[0] !== clearValue);
  const names = options.filter((option) => value.includes(option.value)).map((option) => option.label);
  const summary = names.length > 2 ? `${names.length} selected` : names.join(", ");

  return (
    <>
      <div
        className={cn(
          "inline-flex h-9 shrink-0 items-center rounded-[var(--r-control,10px)] transition-[box-shadow,background-color] duration-150",
          active
            ? "bg-background shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)] dark:bg-transparent dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]"
            : "border border-dashed border-foreground/20 hover:border-foreground/35",
        )}
      >
        <button
          ref={button}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={active ? `${label}: ${summary}` : `Filter by ${label.toLowerCase()}`}
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "inline-flex h-full cursor-pointer items-center gap-1.5 rounded-[var(--r-control,10px)] text-[13.5px] font-medium whitespace-nowrap transition-colors duration-150",
            active ? "pr-1 pl-3 text-foreground" : "px-3 text-foreground/60 hover:text-foreground",
            ring,
          )}
        >
          {active ? null : <Plus aria-hidden className="-ml-0.5 size-3.5" strokeWidth={2} />}
          {label}
          {active ? (
            <>
              <span aria-hidden className="mx-0.5 h-4 w-px bg-foreground/[0.12]" />
              <span className="font-normal text-foreground/70">{summary}</span>
            </>
          ) : null}
        </button>
        {active ? (
          <button
            type="button"
            aria-label={`Clear ${label.toLowerCase()} filter`}
            onClick={() => onChange(multiple ? [] : clearValue ? [clearValue] : [])}
            className={cn(
              "mr-1 grid size-7 cursor-pointer place-items-center rounded-[var(--r-item,8px)] text-foreground/45 transition-colors duration-150 hover:bg-foreground/[0.06] hover:text-foreground",
              ring,
            )}
          >
            <X className="size-3.5" strokeWidth={2} />
          </button>
        ) : null}
      </div>
      <PopoverPanel
        open={open}
        panel={panel}
        close={close}
        label={label}
        footer={
          multiple && value.length > 0 ? (
            <button
              type="button"
              onClick={() => onChange([])}
              className="flex h-8 w-full cursor-pointer items-center justify-center rounded-[var(--r-item,9px)] text-[13px] text-foreground/60 outline-none hover:bg-foreground/[0.05] hover:text-foreground focus-visible:bg-foreground/[0.05]"
            >
              Clear filter
            </button>
          ) : null
        }
      >
        {options.map((option) => {
          const checked = value.includes(option.value);
          return (
            <CheckRow
              key={option.value}
              radio={!multiple}
              checked={checked}
              label={option.label}
              count={option.count}
              onToggle={() => {
                if (!multiple) {
                  onChange([option.value]);
                  close();
                  return;
                }
                onChange(checked ? value.filter((each) => each !== option.value) : [...value, option.value]);
              }}
            />
          );
        })}
      </PopoverPanel>
    </>
  );
}

/** Turns optional columns on and off. */
export function ColumnsMenu({
  columns,
  hidden,
  onChange,
}: {
  columns: { id: string; header: string }[];
  hidden: string[];
  onChange: (hidden: string[]) => void;
}) {
  const { open, setOpen, button, panel, close } = usePopover({ minWidth: 200, align: "end" });
  return (
    <>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-[var(--r-control,10px)] px-3 text-[13.5px] font-medium text-foreground/70 transition-colors duration-150 hover:bg-foreground/[0.05] hover:text-foreground aria-expanded:bg-foreground/[0.05] aria-expanded:text-foreground",
          ring,
        )}
      >
        <Columns3 aria-hidden className="size-4" strokeWidth={1.8} />
        Columns
      </button>
      <PopoverPanel open={open} panel={panel} close={close} label="Columns">
        {columns.map((column) => {
          const shown = !hidden.includes(column.id);
          return (
            <CheckRow
              key={column.id}
              checked={shown}
              label={column.header}
              onToggle={() => onChange(shown ? [...hidden, column.id] : hidden.filter((id) => id !== column.id))}
            />
          );
        })}
      </PopoverPanel>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Pagination                                                         */
/* ------------------------------------------------------------------ */

function PageButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-8 cursor-pointer place-items-center rounded-[var(--r-item,9px)] text-foreground/70 transition-[background-color,color,opacity,transform] duration-150 hover:bg-foreground/[0.06] hover:text-foreground active:scale-[0.96] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent disabled:active:scale-100",
        ring,
      )}
    >
      {children}
    </button>
  );
}

/** Rows per page, the page you're on, and the way to the next one. */
export function Pagination({
  page,
  pages,
  onPageChange,
  pageSize,
  pageSizes = [10, 25, 50],
  onPageSizeChange,
}: {
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  pageSizes?: number[];
  onPageSizeChange?: (size: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 sm:gap-5">
      {onPageSizeChange ? (
        <div className="hidden items-center gap-2 sm:flex">
          <span className="whitespace-nowrap">Rows per page</span>
          <Select
            label="Rows per page"
            value={String(pageSize)}
            options={pageSizes.map((size) => ({ value: String(size), label: String(size) }))}
            onChange={(next) => onPageSizeChange(Number(next))}
            className="h-8 w-[72px] rounded-[var(--r-item,9px)] px-2.5 text-[13px] tabular-nums"
          />
        </div>
      ) : null}
      <span
        // Wide enough for "Page 25 of 25", so the page size control holds still.
        className={cn("text-right whitespace-nowrap text-foreground/70 tabular-nums", onPageSizeChange && "sm:min-w-[92px]")}
        aria-live="polite"
      >
        Page {page} of {pages}
      </span>
      <div className="flex items-center gap-1">
        <PageButton label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="size-4" strokeWidth={2} />
        </PageButton>
        <PageButton label="Next page" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="size-4" strokeWidth={2} />
        </PageButton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Bar for selected rows                                              */
/* ------------------------------------------------------------------ */

/**
 * Rises under the table while rows are selected. Its space is always kept,
 * so nothing on the page moves when it comes and goes.
 */
export function SelectionBar({
  count,
  summary,
  extra,
  actions,
  onClear,
}: {
  count: number;
  /** The figure that matters for the selection, e.g. its total. */
  summary?: React.ReactNode;
  /** A quiet link beside the count, e.g. "Select all 31". */
  extra?: React.ReactNode;
  actions: React.ReactNode;
  onClear: () => void;
}) {
  return (
    <div className="pointer-events-none sticky bottom-0 z-20 flex justify-center pt-5 pb-5">
      <AnimatePresence>
        {count > 0 ? (
          <motion.div
            key="bar"
            role="region"
            aria-label="Selected rows"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE } }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.18, ease: EASE } }}
            className={cn("pointer-events-auto flex h-12 max-w-full items-center gap-2 rounded-[var(--r-panel,14px)] bg-(--st-pop) pr-2 pl-1.5", tableVars, popShadow)}
          >
            <button
              type="button"
              aria-label="Clear selection"
              onClick={onClear}
              className={cn(
                "grid size-8 shrink-0 cursor-pointer place-items-center rounded-[var(--r-item,9px)] text-foreground/50 transition-colors duration-150 hover:bg-foreground/[0.06] hover:text-foreground",
                ring,
              )}
            >
              <X className="size-4" strokeWidth={2} />
            </button>
            <span className="text-[13.5px] whitespace-nowrap tabular-nums" aria-live="polite">
              <span className="font-medium">{count.toLocaleString("en-US")} selected</span>
              {summary ? <span className="text-foreground/55"> · {summary}</span> : null}
            </span>
            {extra}
            <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-foreground/[0.1]" />
            <div className="flex items-center gap-1.5">{actions}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CSV                                                                */
/* ------------------------------------------------------------------ */

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: (string | number)[][]) {
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export function downloadFile(name: string, text: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
