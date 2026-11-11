"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ImageUp, MailCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Badge,
  Button,
  EASE,
  SaveBar,
  Segmented,
  Select,
  SettingsPage,
  SettingsRow,
  SettingsSection,
  Spinner,
  inputClass,
  ring,
  useSaveState,
} from "@/components/prestigeui/settings-ui";

/* ------------------------------------------------------------------ */
/*  Types and defaults                                                 */
/* ------------------------------------------------------------------ */

export type DateFormat = "MMM d, yyyy" | "dd/MM/yyyy" | "yyyy-MM-dd";

export type ProfileValues = {
  name: string;
  username: string;
  /** A URL for the photo, or null for initials. */
  avatar: string | null;
  language: string;
  /** An IANA time zone, e.g. "Europe/Lisbon". */
  timeZone: string;
  dateFormat: DateFormat;
  weekStart: "monday" | "sunday";
};

const defaultValues: ProfileValues = {
  name: "Lena Ortiz",
  username: "lena",
  avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&crop=faces&w=160&h=160&q=80",
  language: "en-US",
  timeZone: "Europe/Lisbon",
  dateFormat: "MMM d, yyyy",
  weekStart: "monday",
};

const languages = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "de-DE", label: "Deutsch" },
  { value: "es-ES", label: "Español" },
  { value: "fr-FR", label: "Français" },
  { value: "ja-JP", label: "日本語" },
];

const zones: { value: string; city: string }[] = [
  { value: "America/Los_Angeles", city: "Los Angeles" },
  { value: "America/Chicago", city: "Chicago" },
  { value: "America/New_York", city: "New York" },
  { value: "America/Sao_Paulo", city: "São Paulo" },
  { value: "Europe/London", city: "London" },
  { value: "Europe/Lisbon", city: "Lisbon" },
  { value: "Europe/Berlin", city: "Berlin" },
  { value: "Asia/Dubai", city: "Dubai" },
  { value: "Asia/Kolkata", city: "Mumbai" },
  { value: "Asia/Singapore", city: "Singapore" },
  { value: "Asia/Tokyo", city: "Tokyo" },
  { value: "Australia/Sydney", city: "Sydney" },
];

const MAX_PHOTO = 4 * 1024 * 1024;
const USERNAME = /^[a-z0-9](?:[a-z0-9-]{1,18}[a-z0-9])$/;

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/** A stand-in for your API: these names are already taken. */
const takenNames = new Set(["admin", "lenao", "marcus", "priya", "support", "team"]);
const sampleCheck = async (username: string) => {
  await sleep(500);
  return !takenNames.has(username);
};

/* ------------------------------------------------------------------ */
/*  Time                                                               */
/* ------------------------------------------------------------------ */

function subscribeMinute(callback: () => void) {
  const timer = window.setInterval(callback, 15_000);
  return () => window.clearInterval(timer);
}

/** The current minute on the client; 0 on the server, where no clock is shown. */
function useMinute() {
  return React.useSyncExternalStore(subscribeMinute, () => Math.floor(Date.now() / 60_000), () => 0);
}

// Some browsers still report a zone's old name.
const zoneAliases: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon",
  "Europe/Kiev": "Europe/Kyiv",
};

/** The device's time zone on the client, by its current name. */
function useDeviceZone() {
  return React.useSyncExternalStore(
    () => () => {},
    () => {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return zoneAliases[zone] ?? zone;
    },
    () => null,
  );
}

function clock(minute: number, timeZone: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { timeZone, hour: "numeric", minute: "2-digit" }).format(minute * 60_000);
}

function offset(minute: number, timeZone: string) {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
    .formatToParts(minute * 60_000)
    .find((entry) => entry.type === "timeZoneName");
  return part?.value ?? "";
}

function formatDate(date: Date, format: DateFormat, timeZone: string, locale: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  if (format === "dd/MM/yyyy") return `${parts.day}/${parts.month}/${parts.year}`;
  if (format === "yyyy-MM-dd") return `${parts.year}-${parts.month}-${parts.day}`;
  return new Intl.DateTimeFormat(locale, { timeZone, month: "short", day: "numeric", year: "numeric" }).format(date);
}

/* ------------------------------------------------------------------ */
/*  Photo                                                              */
/* ------------------------------------------------------------------ */

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function PhotoField({
  name,
  avatar,
  onPick,
  onRemove,
  error,
}: {
  name: string;
  avatar: string | null;
  onPick: (file: File) => void;
  onRemove: () => void;
  error: string | null;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);

  return (
    <div
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const file = event.dataTransfer.files[0];
        if (file) onPick(file);
      }}
      className="flex items-center gap-4"
    >
      {/* Drop a file on the photo, or anywhere in this row. */}
      <span
        className={cn(
          "relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-foreground/[0.07] text-[17px] font-semibold text-foreground/65 outline-offset-2 transition-[outline-color] duration-150",
          over ? "outline-2 outline-dashed outline-foreground/45" : "outline-2 outline-transparent",
        )}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="size-full object-cover" draggable={false} />
        ) : (
          initials(name)
        )}
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 grid place-items-center bg-background/80 text-foreground transition-opacity duration-150",
            over ? "opacity-100" : "opacity-0",
          )}
        >
          <ImageUp className="size-5" strokeWidth={1.8} />
        </span>
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => input.current?.click()}>Upload photo</Button>
        {avatar ? (
          <Button variant="ghost" onClick={onRemove}>
            Remove
          </Button>
        ) : null}
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-label="Upload photo"
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onPick(file);
            event.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Email                                                              */
/* ------------------------------------------------------------------ */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_AFTER = 30;

function subscribeSecond(callback: () => void) {
  const timer = window.setInterval(callback, 1000);
  return () => window.clearInterval(timer);
}

function EmailField({ email, onChange }: { email: string; onChange: (email: string) => Promise<void> | void }) {
  const [mode, setMode] = React.useState<"view" | "edit" | "sending">("view");
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<{ email: string; sentAt: number } | null>(null);
  const field = React.useRef<HTMLInputElement>(null);
  const id = React.useId();
  const second = React.useSyncExternalStore(subscribeSecond, () => Math.floor(Date.now() / 1000), () => 0);
  const wait = pending && second ? Math.max(0, RESEND_AFTER - (second - Math.floor(pending.sentAt / 1000))) : 0;

  const send = async (address: string) => {
    setMode("sending");
    try {
      await onChange(address);
    } catch {
      // Back to the form with the address kept, so it can be sent again.
      setMode("edit");
      setError("The link didn't send. Try again.");
      return;
    }
    setPending({ email: address, sentAt: Date.now() });
    setMode("view");
    setValue("");
  };

  const submit = () => {
    const address = value.trim().toLowerCase();
    if (!EMAIL.test(address)) {
      setError("Enter an email like name@company.com.");
      field.current?.focus();
      return;
    }
    if (address === email) {
      setError("That's already your email.");
      return;
    }
    setError(null);
    void send(address);
  };

  return (
    <div className="grid">
      <AnimatePresence initial={false} mode="popLayout">
        {mode === "view" ? (
          <motion.div
            key="view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.22, ease: EASE } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            className="col-start-1 row-start-1"
          >
            <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2">
              <span className="min-w-0 truncate text-[14px]">{email}</span>
              <Badge>
                <Check aria-hidden className="size-3" strokeWidth={2.4} />
                Verified
              </Badge>
              <Button
                className="sm:ml-auto"
                onClick={() => {
                  setMode("edit");
                  setError(null);
                  requestAnimationFrame(() => field.current?.focus());
                }}
              >
                Change email
              </Button>
            </div>
            {pending ? (
              <div className="mt-3 flex gap-3 rounded-[12px] bg-foreground/[0.035] px-3.5 py-3">
                <MailCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-foreground/60" strokeWidth={1.8} />
                <div className="min-w-0 flex-1 text-[13px] leading-5">
                  <p className="text-foreground">
                    Confirm <span className="font-medium">{pending.email}</span>
                  </p>
                  <p className="text-foreground/55">
                    We sent a link there. Until you open it, {email} stays your sign-in email.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <button
                      type="button"
                      disabled={wait > 0}
                      onClick={() => void send(pending.email)}
                      className={cn(
                        "cursor-pointer rounded-sm font-medium text-foreground underline decoration-foreground/25 underline-offset-[3px] hover:decoration-foreground disabled:cursor-default disabled:text-foreground/45 disabled:no-underline",
                        ring,
                      )}
                    >
                      <span className="tabular-nums">{wait > 0 ? `Resend in ${wait}s` : "Resend link"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPending(null)}
                      className={cn("cursor-pointer rounded-sm text-foreground/55 hover:text-foreground", ring)}
                    >
                      Cancel change
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </motion.div>
        ) : (
          <motion.form
            key="edit"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.22, ease: EASE } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            className="col-start-1 row-start-1"
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={field}
                id={id}
                type="email"
                inputMode="email"
                autoComplete="email"
                spellCheck={false}
                value={value}
                placeholder="New email address"
                aria-label="New email address"
                aria-invalid={error ? true : undefined}
                aria-describedby={`${id}-message`}
                onChange={(event) => {
                  setValue(event.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setMode("view");
                  }
                }}
                className={cn(inputClass(Boolean(error)), "min-w-0 flex-1 basis-[220px]")}
              />
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setMode("view")} disabled={mode === "sending"}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" busy={mode === "sending"}>
                  Send link
                </Button>
              </div>
            </div>
            <p id={`${id}-message`} aria-live="polite" className={cn("mt-1.5 min-h-[18px] text-[12.5px] leading-[18px]", error ? "text-(--st-danger)" : "text-foreground/55")}>
              {error ?? "We'll send a link to confirm it's yours."}
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Profile settings                                                   */
/* ------------------------------------------------------------------ */

export type SettingsProfileProps = {
  /** The saved profile. Edits stay a draft until Save. */
  defaultValues?: Partial<ProfileValues>;
  /** The verified sign-in email. */
  email?: string;
  /** Saves the draft. A new photo arrives as a File; throw to keep the changes unsaved. */
  onSave?: (values: ProfileValues, photo: File | null) => Promise<void> | void;
  /** Resolves true when a username is free. Defaults to a sample check. */
  checkUsername?: (username: string) => Promise<boolean>;
  /** Sends a confirmation link to a new email. The old one stays until it is confirmed. */
  onChangeEmail?: (email: string) => Promise<void> | void;
  className?: string;
};

type UsernameStatus = "same" | "invalid" | "checking" | "available" | "taken" | "unknown";

export function SettingsProfile({
  defaultValues: initial,
  email = "lena@prestigeui.com",
  onSave,
  checkUsername = sampleCheck,
  onChangeEmail = () => sleep(700),
  className,
}: SettingsProfileProps) {
  const [saved, setSaved] = React.useState<ProfileValues>(() => ({ ...defaultValues, ...initial }));
  const [draft, setDraft] = React.useState<ProfileValues>(saved);
  const [photo, setPhoto] = React.useState<File | null>(null);
  const [photoError, setPhotoError] = React.useState<string | null>(null);
  const [touchedName, setTouchedName] = React.useState(false);
  // The last username the server answered for, and its answer.
  // free is null when the check itself failed: no verdict, and saving isn't held up.
  const [checked, setChecked] = React.useState<{ username: string; free: boolean | null } | null>(null);
  const previews = React.useRef<string[]>([]);
  const minute = useMinute();
  const deviceZone = useDeviceZone();
  const ids = { name: React.useId(), username: React.useId(), language: React.useId(), zone: React.useId() };

  const set = <K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) => setDraft((current) => ({ ...current, [key]: value }));

  // Photo previews are object URLs; free them when the page goes.
  React.useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  /* Username ---------------------------------------------------------- */

  const username = draft.username;
  const usernameProblem =
    username.length < 3 || username.length > 20
      ? "Use 3 to 20 characters."
      : !USERNAME.test(username)
        ? "Use lowercase letters, numbers and hyphens, not at the start or end."
        : null;
  const status: UsernameStatus =
    username === saved.username
      ? "same"
      : usernameProblem
        ? "invalid"
        : checked?.username === username
          ? checked.free === null
            ? "unknown"
            : checked.free
              ? "available"
              : "taken"
          : "checking";

  // Ask the server once the person pauses typing.
  React.useEffect(() => {
    if (status !== "checking") return;
    let live = true;
    const timer = window.setTimeout(async () => {
      let free: boolean | null;
      try {
        free = await checkUsername(username);
      } catch {
        free = null;
      }
      if (live) setChecked({ username, free });
    }, 350);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [status, username, checkUsername]);

  const suggestion = (() => {
    const fromName = draft.name.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (fromName && fromName !== username && USERNAME.test(fromName) && !takenNames.has(fromName)) return fromName;
    return `${username.slice(0, 18)}-2`;
  })();

  /* Saving -------------------------------------------------------------- */

  const nameError = draft.name.trim() ? null : "Add your name so your team knows who you are.";
  const invalid = (nameError ? 1 : 0) + (status === "invalid" || status === "taken" ? 1 : 0);

  const persist = React.useCallback(
    async (values: ProfileValues) => {
      if (onSave) await onSave(values, photo);
      else await sleep(800);
    },
    [onSave, photo],
  );
  const commit = React.useCallback((values: ProfileValues) => {
    setSaved(values);
    setPhoto(null);
  }, []);
  const { state, save } = useSaveState(saved, draft, persist, commit);

  const discard = () => {
    setDraft(saved);
    setPhoto(null);
    setPhotoError(null);
    setTouchedName(false);
  };

  /* Region -------------------------------------------------------------- */

  const zoneOptions = (deviceZone && !zones.some((zone) => zone.value === deviceZone)
    ? [...zones, { value: deviceZone, city: deviceZone.split("/").pop()!.replace(/_/g, " ") }]
    : zones
  ).map((zone) => ({
    value: zone.value,
    label: minute ? `${zone.city} (${offset(minute, zone.value)})` : zone.city,
    detail: minute ? clock(minute, zone.value, draft.language) : undefined,
  }));

  const sampleDay = minute ? new Date(minute * 60_000) : new Date(Date.UTC(2026, 9, 30, 12));
  const dateOptions = (["MMM d, yyyy", "dd/MM/yyyy", "yyyy-MM-dd"] as const).map((format) => ({
    value: format,
    label: formatDate(sampleDay, format, draft.timeZone, draft.language),
  }));
  const zoneCity = zoneOptions.find((zone) => zone.value === draft.timeZone)?.label.replace(/ \(.*\)$/, "") ?? draft.timeZone;

  return (
    <SettingsPage
      title="Profile"
      description="How you appear to your team, and how dates and times show for you."
      className={className}
    >
      <SettingsSection title="Your profile">
        <SettingsRow
          label="Photo"
          description="A square image at least 256 px. PNG, JPG, GIF or WebP up to 4 MB."
          message="You can also drop an image on your photo."
          error={photoError}
        >
          <PhotoField
            name={draft.name}
            avatar={draft.avatar}
            error={photoError}
            onPick={(file) => {
              if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) {
                setPhotoError(`${file.name} isn't an image we can use. Try a PNG or JPG.`);
                return;
              }
              if (file.size > MAX_PHOTO) {
                setPhotoError(`That photo is ${(file.size / 1024 / 1024).toFixed(1)} MB. Use one under 4 MB.`);
                return;
              }
              const url = URL.createObjectURL(file);
              previews.current.push(url);
              setPhotoError(null);
              setPhoto(file);
              set("avatar", url);
            }}
            onRemove={() => {
              setPhotoError(null);
              setPhoto(null);
              set("avatar", null);
            }}
          />
        </SettingsRow>

        <SettingsRow
          label="Name"
          htmlFor={ids.name}
          message="Shown on your profile, in comments and in mentions."
          error={touchedName ? nameError : null}
        >
          <input
            id={ids.name}
            value={draft.name}
            autoComplete="name"
            aria-invalid={touchedName && nameError ? true : undefined}
            aria-describedby={`${ids.name}-message`}
            onChange={(event) => set("name", event.target.value)}
            onBlur={() => setTouchedName(true)}
            className={inputClass(Boolean(touchedName && nameError))}
          />
        </SettingsRow>

        <SettingsRow
          label="Username"
          description="Your profile link, and how teammates @mention you."
          htmlFor={ids.username}
          error={status === "invalid" ? usernameProblem : null}
          message={
            status === "checking" ? (
              <>
                <Spinner className="size-3" />
                Checking prestigeui.com/{username}
              </>
            ) : status === "available" ? (
              <>
                <Check aria-hidden className="size-3.5 text-foreground" strokeWidth={2.4} />
                <span className="text-foreground">{username} is available</span>
              </>
            ) : status === "taken" ? (
              <span className="truncate">
                <span className="text-(--st-danger)">Someone already has {username}.</span>{" "}
                <button
                  type="button"
                  onClick={() => set("username", suggestion)}
                  className={cn("cursor-pointer rounded-sm font-medium text-foreground underline decoration-foreground/25 underline-offset-[3px] hover:decoration-foreground", ring)}
                >
                  Use {suggestion}
                </button>
              </span>
            ) : (
              "Changing it updates your profile link."
            )
          }
        >
          <div
            className={cn(
              inputClass(status === "invalid" || status === "taken"),
              "flex items-center px-0 focus-within:border-foreground/40 focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--foreground)_10%,transparent)]",
            )}
          >
            <span aria-hidden className="shrink-0 pl-3 text-foreground/40">
              prestigeui.com/
            </span>
            <input
              id={ids.username}
              value={username}
              autoComplete="username"
              spellCheck={false}
              aria-invalid={status === "invalid" || status === "taken" ? true : undefined}
              aria-describedby={`${ids.username}-message`}
              onChange={(event) => set("username", event.target.value.toLowerCase().replace(/\s+/g, "-"))}
              className="h-full min-w-0 flex-1 bg-transparent pr-3 outline-none"
            />
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Email" description="Where sign-in links and account notices go.">
        <SettingsRow label="Email address">
          <EmailField email={email} onChange={onChangeEmail} />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Region and format">
        <SettingsRow label="Language" htmlFor={ids.language}>
          <Select id={ids.language} label="Language" value={draft.language} options={languages} onChange={(value) => set("language", value)} />
        </SettingsRow>
        <SettingsRow
          label="Time zone"
          htmlFor={ids.zone}
          message={
            deviceZone && deviceZone !== draft.timeZone ? (
              <span className="truncate">
                Your device is set to {zoneOptions.find((zone) => zone.value === deviceZone)?.label.replace(/ \(.*\)$/, "") ?? deviceZone}.{" "}
                <button
                  type="button"
                  onClick={() => set("timeZone", deviceZone)}
                  className={cn("cursor-pointer rounded-sm font-medium text-foreground underline decoration-foreground/25 underline-offset-[3px] hover:decoration-foreground", ring)}
                >
                  Use it
                </button>
              </span>
            ) : (
              "Reminders and due dates follow this time zone."
            )
          }
        >
          <Select id={ids.zone} label="Time zone" value={draft.timeZone} options={zoneOptions} onChange={(value) => set("timeZone", value)} searchable />
        </SettingsRow>
        <SettingsRow
          label="Date format"
          message={minute ? <span className="truncate tabular-nums">Today shows as {formatDate(sampleDay, draft.dateFormat, draft.timeZone, draft.language)}, {clock(minute, draft.timeZone, draft.language)} in {zoneCity}.</span> : null}
        >
          <Segmented label="Date format" value={draft.dateFormat} options={dateOptions} onChange={(value) => set("dateFormat", value)} />
        </SettingsRow>
        <SettingsRow label="Week starts on" description="For calendars and weekly reports.">
          <Segmented
            label="Week starts on"
            value={draft.weekStart}
            options={[
              { value: "monday", label: "Monday" },
              { value: "sunday", label: "Sunday" },
            ]}
            onChange={(value) => set("weekStart", value)}
          />
        </SettingsRow>
      </SettingsSection>

      <SaveBar
        state={state}
        invalid={invalid}
        waiting={status === "checking" ? "Checking the username" : null}
        onSave={() => void save()}
        onDiscard={discard}
        className="-mt-6"
      />
    </SettingsPage>
  );
}
