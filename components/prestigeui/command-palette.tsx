"use client";

import * as React from "react";
import {
  BookOpen,
  ChartNoAxesColumn,
  Download,
  Folder,
  FolderKanban,
  House,
  Inbox,
  Keyboard,
  LifeBuoy,
  Link2,
  Plus,
  Search,
  Settings,
  UserPlus,
} from "lucide-react";
import {
  CommandDialog,
  CommandTrigger,
  EscButton,
  KeyHints,
  NoResults,
  ResultCount,
  ResultSections,
  matchItem,
  resultList,
  searchBar,
  searchInput,
  useCommandShortcut,
  useFocusOnOpen,
  useKeepInView,
  type CommandIcon,
  type ResultSection,
} from "@/components/prestigeui/command-ui";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type CommandItem = {
  id: string;
  label: string;
  icon?: CommandIcon;
  /** A muted note after the label, e.g. the project's team. */
  hint?: string;
  /** Extra words that find this item ("dark" for an appearance setting). */
  keywords?: string[];
  /** Its own shortcut, shown at the right: ["G", "I"], or ["mod", "shift", "C"]. */
  shortcut?: string[];
  href?: string;
  onSelect?: () => void;
};

export type CommandGroup = {
  id: string;
  label: string;
  items: CommandItem[];
  /** Only shown once the person types, e.g. a long list of projects. */
  searchOnly?: boolean;
};

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

const defaultGroups: CommandGroup[] = [
  {
    id: "pages",
    label: "Go to",
    items: [
      { id: "home", label: "Home", icon: House, shortcut: ["G", "H"] },
      { id: "inbox", label: "Inbox", icon: Inbox, shortcut: ["G", "I"], keywords: ["notifications", "mentions"] },
      { id: "projects", label: "Projects", icon: FolderKanban, shortcut: ["G", "P"] },
      { id: "reports", label: "Reports", icon: ChartNoAxesColumn, shortcut: ["G", "R"], keywords: ["analytics", "charts"] },
      { id: "settings", label: "Settings", icon: Settings, shortcut: ["G", "S"], keywords: ["preferences", "account"] },
    ],
  },
  {
    id: "actions",
    label: "Actions",
    items: [
      { id: "new-project", label: "New project", icon: Plus, shortcut: ["C"], keywords: ["create", "add"] },
      { id: "invite", label: "Invite people", icon: UserPlus, keywords: ["team", "members", "add"] },
      { id: "copy-link", label: "Copy link to page", icon: Link2, shortcut: ["mod", "shift", "C"], keywords: ["url", "share"] },
      { id: "export", label: "Export as CSV", icon: Download, keywords: ["download", "spreadsheet"] },
    ],
  },
  {
    id: "projects-list",
    label: "Projects",
    searchOnly: true,
    items: [
      { id: "p-q4", label: "Q4 launch plan", icon: Folder, hint: "Marketing" },
      { id: "p-mobile", label: "Mobile app redesign", icon: Folder, hint: "Design" },
      { id: "p-pricing", label: "Pricing page refresh", icon: Folder, hint: "Growth" },
      { id: "p-onboarding", label: "Onboarding emails", icon: Folder, hint: "Lifecycle" },
      { id: "p-sso", label: "SSO for enterprise", icon: Folder, hint: "Platform" },
    ],
  },
  {
    id: "help",
    label: "Help",
    searchOnly: true,
    items: [
      { id: "shortcuts", label: "Keyboard shortcuts", icon: Keyboard, shortcut: ["?"], keywords: ["keys", "hotkeys"] },
      { id: "docs", label: "Documentation", icon: BookOpen, keywords: ["guide", "help"] },
      { id: "support", label: "Contact support", icon: LifeBuoy, keywords: ["help", "chat", "email"] },
    ],
  },
];

const RECENT_LIMIT = 3;

/* ------------------------------------------------------------------ */
/*  Results                                                            */
/* ------------------------------------------------------------------ */

type Row = { item: CommandItem; group: CommandGroup; marks: number[]; key: string };
type Section = { id: string; label: string; rows: Row[] };

/**
 * What the list shows. With no query: recent items, then every group that
 * is not search-only. While typing: matches only, best first, with each
 * group placed by its best match.
 */
function buildSections(groups: CommandGroup[], recent: string[], query: string): Section[] {
  if (!query.trim()) {
    const sections: Section[] = [];
    const recentRows = recent.flatMap((id) => {
      for (const group of groups) {
        const item = group.items.find((entry) => entry.id === id);
        if (item) return [{ item, group, marks: [], key: `recent-${item.id}` }];
      }
      return [];
    });
    if (recentRows.length) sections.push({ id: "recent", label: "Recent", rows: recentRows });
    for (const group of groups) {
      if (group.searchOnly) continue;
      sections.push({
        id: group.id,
        label: group.label,
        rows: group.items.map((item) => ({ item, group, marks: [], key: item.id })),
      });
    }
    return sections;
  }

  const ranked = groups
    .map((group) => {
      const rows = group.items
        .map((item) => ({ item, match: matchItem(item.label, item.keywords, query) }))
        .filter((entry) => entry.match !== null)
        .sort((a, b) => b.match!.score - a.match!.score);
      return {
        best: rows[0]?.match!.score ?? -Infinity,
        section: {
          id: group.id,
          label: group.label,
          rows: rows.map(({ item, match }) => ({ item, group, marks: match!.marks, key: item.id })),
        },
      };
    })
    .filter((entry) => entry.section.rows.length > 0)
    .sort((a, b) => b.best - a.best);
  return ranked.map((entry) => entry.section);
}

/* ------------------------------------------------------------------ */
/*  Command palette                                                    */
/* ------------------------------------------------------------------ */

export type CommandPaletteProps = {
  /** What the palette searches: groups of pages and actions. */
  groups?: CommandGroup[];
  /** Called when an item is chosen, after its own onSelect. */
  onSelect?: (item: CommandItem, group: CommandGroup) => void;
  /** Ids shown under Recent at first. Choosing an item moves it to the top. */
  defaultRecent?: string[];
  /** Control the palette. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** ⌘K / Ctrl+K opens and closes it. */
  shortcut?: boolean;
  /** Show the search button that opens it. Pass false to open it your own way. */
  trigger?: boolean;
  placeholder?: string;
  /** Open over this element instead of the whole window, e.g. a preview frame. */
  container?: HTMLElement | null;
  /** Classes for the search button. */
  className?: string;
};

export function CommandPalette({
  groups = defaultGroups,
  onSelect,
  defaultRecent = ["reports", "p-q4"],
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  shortcut = true,
  trigger = true,
  placeholder = "Search pages, projects and actions",
  container,
  className,
}: CommandPaletteProps) {
  const [openState, setOpenState] = React.useState(defaultOpen);
  const open = openProp ?? openState;
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [recent, setRecent] = React.useState(defaultRecent);
  const input = React.useRef<HTMLInputElement>(null);
  const list = React.useRef<HTMLDivElement>(null);
  const button = React.useRef<HTMLButtonElement>(null);
  const returnFocus = React.useRef<HTMLElement | null>(null);
  const listId = React.useId();

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (next) {
        returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      } else {
        setQuery("");
        setActive(0);
      }
      setOpenState(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const toggle = React.useCallback(() => setOpen(!open), [open, setOpen]);
  useCommandShortcut(shortcut, toggle, container);

  const close = React.useCallback(() => {
    setOpen(false);
    const target = returnFocus.current?.isConnected ? returnFocus.current : button.current;
    target?.focus({ preventScroll: true });
  }, [setOpen]);

  useFocusOnOpen(open, input, container);

  const sections = buildSections(groups, recent, query);
  const rows = sections.flatMap((section) => section.rows);
  const chosen = Math.min(active, Math.max(0, rows.length - 1));
  const searching = query.trim().length > 0;

  useKeepInView(list, chosen, `${open}:${query}`);

  const run = (row: Row) => {
    row.item.onSelect?.();
    onSelect?.(row.item, row.group);
    setRecent((ids) => [row.item.id, ...ids.filter((id) => id !== row.item.id)].slice(0, RECENT_LIMIT));
    close();
    if (row.item.href && row.item.href !== "#") window.location.assign(row.item.href);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const count = rows.length;
    if (event.key === "ArrowDown" || (event.ctrlKey && event.key === "n")) {
      event.preventDefault();
      if (count) setActive((chosen + 1) % count);
    } else if (event.key === "ArrowUp" || (event.ctrlKey && event.key === "p")) {
      event.preventDefault();
      if (count) setActive((chosen - 1 + count) % count);
    } else if (event.key === "Home" && !query) {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End" && !query) {
      event.preventDefault();
      setActive(Math.max(0, count - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (rows[chosen]) run(rows[chosen]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      // The first Escape clears what was typed; the next one closes.
      if (query) {
        setQuery("");
        setActive(0);
      } else close();
    }
  };

  const activeRow = rows[chosen];
  // What the shared list draws: icons, marks and shortcuts per row.
  const shown: ResultSection[] = sections.map((section) => ({
    id: section.id,
    label: section.label,
    rows: section.rows.map((row) => {
      const Icon = row.item.icon;
      return {
        key: row.key,
        label: row.item.label,
        icon: Icon ? <Icon className="size-4" strokeWidth={1.75} /> : undefined,
        hint: row.item.hint,
        marks: row.marks,
        shortcut: row.item.shortcut,
      };
    }),
  }));

  return (
    <>
      {trigger ? <CommandTrigger ref={button} open={open} onOpen={() => setOpen(true)} shortcut={shortcut} className={className} /> : null}

      <CommandDialog open={open} onClose={close} container={container} label="Command palette">
        <div className={searchBar}>
          <Search aria-hidden className="size-[18px] shrink-0 text-foreground/45" strokeWidth={1.8} />
          <input
            ref={input}
            value={query}
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeRow ? `${listId}-${activeRow.key}` : undefined}
            aria-label="Search"
            autoComplete="off"
            spellCheck={false}
            placeholder={placeholder}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            className={searchInput}
          />
          <EscButton onClick={close} />
        </div>

        <div ref={list} id={listId} role="listbox" aria-label="Results" className={resultList}>
          {rows.length === 0 ? (
            <NoResults query={query} tip="Try a page, a project or an action." />
          ) : (
            <ResultSections
              sections={shown}
              chosen={chosen}
              onChoose={setActive}
              onRun={(i) => run(rows[i])}
              searching={searching}
              listId={listId}
            />
          )}
        </div>

        <KeyHints
          hints={[
            { keys: ["↑", "↓"], label: "Move" },
            { keys: ["↵"], label: "Open" },
          ]}
        >
          <ResultCount count={rows.length} searching={searching} />
        </KeyHints>
      </CommandDialog>
    </>
  );
}
