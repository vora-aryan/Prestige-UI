"use client";

import * as React from "react";
import { MotionConfig, motion } from "motion/react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ClaudeMark,
  EASE,
  GeminiMark,
  GrokMark,
  MenuLabel,
  OpenAIMark,
  Popover,
  aiVars,
  ring,
  thinScroll,
} from "@/components/prestigeui/ai-ui";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Icon = React.ComponentType<{ className?: string; strokeWidth?: number }>;

type PickerModel = {
  id: string;
  label: string;
  /** A shorter name for the trigger on small screens. */
  shortLabel?: string;
  /** Models are grouped by provider, in the order they first appear. */
  provider: string;
  /** The provider's mark, drawn in the text color. */
  icon?: Icon;
  description?: string;
  /** Relative ratings from 1 to 5, compared within your own list. */
  intelligence?: number;
  speed?: number;
  cost?: number;
  /** The context window, as it should read ("200K tokens"). */
  context?: string;
  /** What it accepts or can do: "Images", "PDFs", "Tools". */
  capabilities?: string[];
  /** On a plan the user doesn't have. Picking it calls onUpgrade. */
  locked?: boolean;
};

type ModelPickerProps = {
  models?: PickerModel[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /** Called when a locked model is picked. */
  onUpgrade?: (model: PickerModel) => void;
  /** The tag on locked models. */
  lockedLabel?: string;
  /** The button in the detail pane of a locked model. */
  upgradeLabel?: string;
  /** Which edge of the trigger the panel lines up with. */
  align?: "start" | "center" | "end";
  className?: string;
};

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

const defaultModels: PickerModel[] = [
  {
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    shortLabel: "Sonnet 5.5",
    provider: "Anthropic",
    icon: ClaudeMark,
    description: "Fast and capable for everyday work: writing, analysis and code.",
    intelligence: 4,
    speed: 4,
    cost: 3,
    context: "200K tokens",
    capabilities: ["Images", "PDFs", "Tools", "Reasoning"],
  },
  {
    id: "claude-opus-5-5",
    label: "Claude Opus 5.5",
    shortLabel: "Opus 5.5",
    provider: "Anthropic",
    icon: ClaudeMark,
    description: "The most capable Claude, for long, complex tasks that need care.",
    intelligence: 5,
    speed: 2,
    cost: 5,
    context: "200K tokens",
    capabilities: ["Images", "PDFs", "Tools", "Reasoning"],
    locked: true,
  },
  {
    id: "gpt-6-sol",
    label: "GPT-6 Sol",
    provider: "OpenAI",
    icon: OpenAIMark,
    description: "Strong at coding and professional work, with adjustable reasoning.",
    intelligence: 5,
    speed: 3,
    cost: 4,
    context: "400K tokens",
    capabilities: ["Images", "PDFs", "Tools", "Reasoning"],
    locked: true,
  },
  {
    id: "gpt-6-luna",
    label: "GPT-6 Luna",
    provider: "OpenAI",
    icon: OpenAIMark,
    description: "Fast and affordable for short questions and simple drafts.",
    intelligence: 3,
    speed: 5,
    cost: 1,
    context: "400K tokens",
    capabilities: ["Images", "Tools"],
  },
  {
    id: "gemini-4-argon",
    label: "Gemini 4 Argon",
    shortLabel: "Argon",
    provider: "Google",
    icon: GeminiMark,
    description: "Reads very long inputs, such as whole codebases or hours of video.",
    intelligence: 5,
    speed: 3,
    cost: 3,
    context: "1M tokens",
    capabilities: ["Images", "PDFs", "Video", "Audio", "Tools", "Reasoning"],
  },
  {
    id: "gemini-3-8-flash",
    label: "Gemini 3.8 Flash",
    shortLabel: "3.8 Flash",
    provider: "Google",
    icon: GeminiMark,
    description: "Quick answers at low cost, with the same long context.",
    intelligence: 3,
    speed: 5,
    cost: 1,
    context: "1M tokens",
    capabilities: ["Images", "PDFs", "Audio", "Tools"],
  },
  {
    id: "grok-4-7",
    label: "Grok 4.7",
    provider: "xAI",
    icon: GrokMark,
    description: "Good at coding and agent tasks that chain many tool calls.",
    intelligence: 4,
    speed: 4,
    cost: 3,
    context: "256K tokens",
    capabilities: ["Images", "Tools", "Reasoning"],
  },
];

/* ------------------------------------------------------------------ */
/*  Parts                                                              */
/* ------------------------------------------------------------------ */

/** A rating out of five as five short bars: ink for the value, faint after. */
function Scale({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[12.5px] text-foreground/50">{label}</dt>
      <dd role="img" aria-label={`${label}: ${v} of 5`} className="flex gap-[3px]">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn("h-1.5 w-3.5 rounded-full", i < v ? "bg-foreground/80" : "bg-foreground/[0.1]")}
          />
        ))}
      </dd>
    </div>
  );
}

function Details({
  model,
  lockedLabel,
  upgradeLabel,
  onUpgrade,
}: {
  model: PickerModel;
  lockedLabel: string;
  upgradeLabel: string;
  onUpgrade: () => void;
}) {
  const Mark = model.icon;
  return (
    <motion.div
      key={model.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: EASE }}
      className="flex h-full flex-col"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-[10px] ring-1 ring-foreground/[0.09] ring-inset">
          {Mark ? <Mark className="size-4" /> : null}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[14px] leading-5 font-semibold tracking-[-0.01em]">{model.label}</p>
          <p className="truncate text-[12.5px] leading-[18px] text-foreground/50">{model.provider}</p>
        </div>
      </div>

      {model.description ? (
        <p className="mt-3 line-clamp-3 text-[13px] leading-[1.5] text-pretty text-foreground/60">
          {model.description}
        </p>
      ) : null}

      <dl className="mt-4 space-y-2.5">
        {model.intelligence != null ? <Scale label="Intelligence" value={model.intelligence} /> : null}
        {model.speed != null ? <Scale label="Speed" value={model.speed} /> : null}
        {model.cost != null ? <Scale label="Cost" value={model.cost} /> : null}
        {model.context ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[12.5px] text-foreground/50">Context</dt>
            <dd className="text-[12.5px] font-medium text-foreground/80 tabular-nums">{model.context}</dd>
          </div>
        ) : null}
      </dl>

      {model.capabilities?.length ? (
        <ul aria-label="Works with" className="mt-4 flex flex-wrap gap-1.5">
          {model.capabilities.map((item) => (
            <li
              key={item}
              className="rounded-[6px] px-1.5 py-0.5 text-[12px] leading-4 text-foreground/65 ring-1 ring-foreground/[0.1] ring-inset"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : null}

      {model.locked ? (
        <div className="mt-auto pt-4">
          <p className="text-[12.5px] leading-[1.5] text-foreground/50">Included with {lockedLabel}.</p>
          <button
            type="button"
            onClick={onUpgrade}
            className={cn(
              "mt-2 flex h-8 w-full cursor-pointer items-center justify-center rounded-full bg-foreground text-[13px] font-medium text-background transition-[background-color,scale] duration-150 hover:bg-foreground/90 active:scale-[0.98]",
              ring,
            )}
          >
            {upgradeLabel}
          </button>
        </div>
      ) : null}
    </motion.div>
  );
}

/** Scroll a list just enough to show one of its rows. */
function reveal(list: HTMLElement | null, row: HTMLElement | null) {
  if (!list || !row) return;
  const top = row.offsetTop - 6;
  const bottom = row.offsetTop + row.offsetHeight + 6;
  if (top < list.scrollTop) list.scrollTop = top;
  else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
}

/* ------------------------------------------------------------------ */
/*  Model picker                                                       */
/* ------------------------------------------------------------------ */

function ModelPicker({
  models = defaultModels,
  value,
  defaultValue,
  onValueChange,
  onUpgrade,
  lockedLabel = "Pro",
  upgradeLabel = `Upgrade to ${lockedLabel}`,
  align = "start",
  className,
}: ModelPickerProps) {
  const baseId = React.useId();
  const [inner, setInner] = React.useState(defaultValue ?? models.find((m) => !m.locked)?.id ?? models[0]?.id);
  const selectedId = value ?? inner;
  const selected = models.find((m) => m.id === selectedId) ?? models[0];

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeId, setActiveId] = React.useState(selected?.id);

  const trigger = React.useRef<HTMLButtonElement>(null);
  const input = React.useRef<HTMLInputElement>(null);
  const list = React.useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const shown = q
    ? models.filter((m) =>
        [m.label, m.provider, m.description ?? "", ...(m.capabilities ?? [])].join(" ").toLowerCase().includes(q),
      )
    : models;
  const groups: { provider: string; items: PickerModel[] }[] = [];
  for (const m of shown) {
    const group = groups.find((g) => g.provider === m.provider);
    if (group) group.items.push(m);
    else groups.push({ provider: m.provider, items: [m] });
  }
  // The flat order follows the groups, so arrow keys move down the screen.
  const flat = groups.flatMap((g) => g.items);
  const active = flat.find((m) => m.id === activeId) ?? flat[0];

  const optionId = (id: string) => `${baseId}-${id}`;

  const show = () => {
    setQuery("");
    setActiveId(selected?.id);
    setOpen(true);
  };

  const close = React.useCallback((refocus = false) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }, []);
  const onOutside = React.useCallback(() => close(false), [close]);

  React.useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      input.current?.focus({ preventScroll: true });
      reveal(list.current, list.current?.querySelector<HTMLElement>("[aria-selected=true]") ?? null);
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const pick = (model: PickerModel) => {
    if (model.locked) {
      close(true);
      onUpgrade?.(model);
      return;
    }
    if (value === undefined) setInner(model.id);
    onValueChange?.(model.id);
    close(true);
  };

  const move = (step: number) => {
    if (!flat.length) return;
    const index = active ? flat.indexOf(active) : -1;
    const next = flat[(index + step + flat.length) % flat.length];
    setActiveId(next.id);
    reveal(list.current, document.getElementById(optionId(next.id)));
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      move(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (active) pick(active);
    } else if (event.key === "Escape") {
      event.preventDefault();
      if (query) setQuery("");
      else close(true);
    } else if (event.key === "Tab") {
      close(false);
    }
  };

  const Mark = selected?.icon;

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("inline-flex font-sans text-foreground", aiVars, className)}>
        <button
          ref={trigger}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Model: ${selected?.label}`}
          onClick={() => (open ? close(false) : show())}
          className={cn(
            "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full pr-2.5 pl-3 text-[13.5px] font-medium text-foreground/80 ring-1 ring-foreground/[0.1] ring-inset transition-[background-color,color] duration-150 hover:bg-foreground/[0.04] hover:text-foreground aria-expanded:bg-foreground/[0.05] aria-expanded:text-foreground",
            ring,
          )}
        >
          {Mark ? <Mark className="size-4 shrink-0" /> : null}
          <span className="max-w-[180px] truncate">
            <span className="sm:hidden">{selected?.shortLabel ?? selected?.label}</span>
            <span className="hidden sm:inline">{selected?.label}</span>
          </span>
          <ChevronDown
            className={cn("size-3.5 text-foreground/45 transition-transform duration-200", open && "rotate-180")}
            strokeWidth={2}
          />
        </button>

        <Popover
          open={open}
          onClose={onOutside}
          anchor={trigger}
          align={align}
          role="presentation"
          className="w-[min(360px,calc(100vw-16px))] p-0 sm:w-[592px]"
        >
          <div className="flex min-h-0">
            <div className="flex w-full min-w-0 flex-col sm:w-[328px] sm:shrink-0">
              <label className="flex h-11 shrink-0 items-center gap-2.5 border-b border-foreground/[0.07] px-4">
                <Search className="size-4 shrink-0 text-foreground/45" strokeWidth={1.9} />
                <input
                  ref={input}
                  role="combobox"
                  aria-expanded
                  aria-controls={`${baseId}-list`}
                  aria-activedescendant={active ? optionId(active.id) : undefined}
                  aria-label="Search models"
                  placeholder="Search models"
                  autoComplete="off"
                  spellCheck={false}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    if (list.current) list.current.scrollTop = 0;
                  }}
                  onKeyDown={onKeyDown}
                  className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-foreground/40"
                />
              </label>

              {/* A fixed height, so filtering never resizes the panel */}
              <div
                ref={list}
                id={`${baseId}-list`}
                role="listbox"
                aria-label="Models"
                className={cn(
                  "relative h-[min(392px,calc(var(--pop-max)-44px))] overflow-y-auto overscroll-contain p-1.5",
                  thinScroll,
                )}
              >
                {groups.map((group) => (
                  <div key={group.provider} role="group" aria-label={group.provider}>
                    <div aria-hidden>
                      <MenuLabel>{group.provider}</MenuLabel>
                    </div>
                    {group.items.map((m) => {
                      const RowMark = m.icon;
                      const isSelected = m.id === selected?.id;
                      return (
                        <div
                          key={m.id}
                          id={optionId(m.id)}
                          role="option"
                          aria-selected={isSelected}
                          // Pointer moves, not enters: rows scrolling under a resting
                          // cursor must not steal the keyboard's place.
                          onPointerMove={() => m.id !== active?.id && setActiveId(m.id)}
                          onPointerDown={(event) => event.preventDefault()}
                          onClick={() => pick(m)}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-[10px] px-2.5 py-2 transition-colors duration-150",
                            m.id === active?.id && "bg-foreground/[0.05]",
                          )}
                        >
                          {RowMark ? <RowMark className="size-4 shrink-0 text-foreground/75" /> : null}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] leading-5 font-medium">{m.label}</span>
                            {m.description ? (
                              <span className="line-clamp-2 block text-[12.5px] leading-[18px] text-pretty text-foreground/50 sm:hidden">
                                {m.description}
                              </span>
                            ) : null}
                          </span>
                          {m.locked ? (
                            <span className="shrink-0 rounded-[6px] px-1.5 py-0.5 text-[11.5px] leading-4 font-medium text-foreground/55 ring-1 ring-foreground/[0.1] ring-inset">
                              {lockedLabel}
                            </span>
                          ) : (
                            <Check
                              aria-hidden
                              className={cn("size-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
                              strokeWidth={2.25}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
                {!flat.length ? (
                  <p className="px-6 pt-12 text-center text-[13px] text-pretty text-foreground/50">
                    No models match &ldquo;{query.trim()}&rdquo;.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="hidden w-[264px] shrink-0 border-l border-foreground/[0.07] p-4 sm:block">
              {active ? (
                <Details
                  model={active}
                  lockedLabel={lockedLabel}
                  upgradeLabel={upgradeLabel}
                  onUpgrade={() => pick(active)}
                />
              ) : null}
            </div>
          </div>
        </Popover>
      </div>
    </MotionConfig>
  );
}

export { ModelPicker, defaultModels, type ModelPickerProps, type PickerModel };
