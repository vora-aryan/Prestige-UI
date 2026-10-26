"use client";

import * as React from "react";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { ArrowLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AuthButton,
  AuthShell,
  AuthTitle,
  Divider,
  EMAIL,
  EASE,
  EmailInput,
  Field,
  SocialRow,
  Steps,
  SuccessMark,
  TextButton,
  formatSeconds,
  inputClass,
  preventPlaceholder,
  ring,
  useCountdown,
  AuthError,
  failureOf,
  useMissingHandlers,
} from "@/components/prestigeui/auth-ui";

type AuthOtpProps = {
  /**
   * Sends the code. Resolve when the email is on its way; throw an
   * AuthError to show its message (under the email, or under the code for
   * a resend).
   */
  onSendCode?: (email: string) => Promise<void>;
  /**
   * Checks a code. Resolve true when it is valid and false when it isn't;
   * throw an AuthError to show a different message under the code.
   */
  onVerify?: (email: string, code: string) => Promise<boolean>;
  length?: number;
  resendAfter?: number;
  className?: string;
};

type Step = "email" | "code" | "done";


function CodeInput({
  length,
  value,
  onChange,
  onComplete,
  invalid,
  disabled,
}: {
  length: number;
  value: string;
  onChange: (value: string) => void;
  onComplete: (value: string) => void;
  invalid: boolean;
  disabled: boolean;
}) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const controls = useAnimationControls();
  const reduce = useReducedMotion();
  const half = Math.ceil(length / 2);

  React.useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  // A short, damped shake on a wrong code: the same "no" a head makes.
  React.useEffect(() => {
    if (!invalid || reduce) return;
    controls.start({ x: [0, -6, 5, -3, 2, 0], transition: { duration: 0.36, ease: "easeOut" } });
  }, [invalid, reduce, controls]);

  const setAt = (index: number, digit: string) => {
    const chars = value.padEnd(length, " ").split("");
    chars[index] = digit;
    const next = chars.join("").trimEnd();
    onChange(next);
    if (next.replace(/\s/g, "").length === length) onComplete(next);
  };

  const fill = (from: number, digits: string) => {
    const clean = digits.replace(/\D/g, "").slice(0, length - from);
    if (!clean) return;
    const chars = value.padEnd(length, " ").split("");
    clean.split("").forEach((digit, offset) => (chars[from + offset] = digit));
    const next = chars.join("").trimEnd();
    onChange(next);
    refs.current[Math.min(from + clean.length, length - 1)]?.focus();
    if (next.replace(/\s/g, "").length === length) onComplete(next);
  };

  return (
    <motion.div
      animate={controls}
      role="group"
      aria-label={`${length}-digit code`}
      className="flex items-center justify-between gap-2"
    >
      {Array.from({ length }, (_, index) => {
        const char = value[index]?.trim() ?? "";
        return (
          <React.Fragment key={index}>
            {index === half ? <span aria-hidden className="h-px w-3 shrink-0 bg-foreground/25" /> : null}
            <input
              ref={(node) => {
                refs.current[index] = node;
              }}
              value={char}
              disabled={disabled}
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              aria-label={`Digit ${index + 1}`}
              aria-invalid={invalid}
              maxLength={length}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => {
                const typed = event.target.value.replace(/\D/g, "");
                if (!typed) return setAt(index, " ");
                // Autofill and fast typing can land several digits at once.
                if (typed.length > 1) return fill(index, typed);
                setAt(index, typed);
                refs.current[index + 1]?.focus();
              }}
              onPaste={(event) => {
                event.preventDefault();
                fill(index, event.clipboardData.getData("text"));
              }}
              onKeyDown={(event) => {
                if (event.key === "Backspace" && !char && index > 0) {
                  event.preventDefault();
                  setAt(index - 1, " ");
                  refs.current[index - 1]?.focus();
                } else if (event.key === "ArrowLeft" && index > 0) {
                  event.preventDefault();
                  refs.current[index - 1]?.focus();
                } else if (event.key === "ArrowRight" && index < length - 1) {
                  event.preventDefault();
                  refs.current[index + 1]?.focus();
                }
              }}
              className={cn(
                inputClass(invalid),
                "h-12 w-0 min-w-0 flex-1 px-0 text-center text-[18px] font-medium tabular-nums caret-[var(--auth-accent)]",
                char && !invalid && "border-foreground/25",
              )}
            />
          </React.Fragment>
        );
      })}
    </motion.div>
  );
}

function AuthOtp({
  onSendCode,
  onVerify,
  length = 6,
  resendAfter = 30,
  className,
}: AuthOtpProps) {
  const [step, setStep] = React.useState<Step>("email");
  const [direction, setDirection] = React.useState(1);
  const [email, setEmail] = React.useState("");
  const [emailError, setEmailError] = React.useState("");
  const [code, setCode] = React.useState("");
  const [codeError, setCodeError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [resent, setResent] = React.useState(false);
  const [shakeKey, setShakeKey] = React.useState(0);
  const countdown = useCountdown(resendAfter);
  const emailId = React.useId();
  useMissingHandlers("AuthOtp", { onSendCode, onVerify });

  const go = (next: Step, dir: number) => {
    setDirection(dir);
    setStep(next);
  };

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!EMAIL.test(email.trim())) return setEmailError("Enter an email like you@company.com.");
    setBusy(true);
    try {
      if (!onSendCode) throw new AuthError("Email codes aren’t available yet.");
      await onSendCode(email.trim());
    } catch (error) {
      setEmailError(failureOf(error).message);
      setBusy(false);
      return;
    }
    setBusy(false);
    setCode("");
    setCodeError("");
    countdown.start();
    go("code", 1);
  };

  const verify = async (value: string) => {
    if (busy) return;
    setBusy(true);
    setCodeError("");
    let message = "That code didn’t work. Check the latest email and try again.";
    try {
      if (!onVerify) throw new AuthError("Checking codes isn’t available yet.");
      if (await onVerify(email.trim(), value)) {
        setBusy(false);
        return go("done", 1);
      }
    } catch (error) {
      message = failureOf(error).message;
    }
    setBusy(false);
    setCodeError(message);
    setShakeKey((n) => n + 1);
    setCode("");
  };

  const resend = async () => {
    setCodeError("");
    try {
      if (!onSendCode) throw new AuthError("Email codes aren’t available yet.");
      await onSendCode(email.trim());
    } catch (error) {
      setCodeError(failureOf(error).message);
      return;
    }
    setResent(true);
    countdown.start();
    window.setTimeout(() => setResent(false), 2400);
  };

  return (
    <AuthShell
      legal={step === "email"}
      className={className}
      aside={
        <>
          New here?{" "}
          <a href="#" onClick={preventPlaceholder} className={cn("rounded-sm font-medium text-foreground hover:underline", ring)}>
            Create an account
          </a>
        </>
      }
    >
      <Steps step={step} direction={direction}>
        {step === "email" ? (
          <form noValidate onSubmit={send}>
            <AuthTitle title="Sign in to Prestige UI">We’ll email you a 6-digit code. No password to remember.</AuthTitle>
            <div className="mt-6">
              <SocialRow />
            </div>
            <Divider>or use email</Divider>
            <Field id={emailId} label="Email" error={emailError}>
              <EmailInput
                id={emailId}
                autoComplete="email"
                value={email}
                aria-describedby={`${emailId}-message`}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (emailError) setEmailError("");
                }}
                placeholder="you@company.com"
                invalid={Boolean(emailError)}
              />
            </Field>
            <AuthButton type="submit" busy={busy} busyLabel="Sending code" className="mt-2">
              Send code
            </AuthButton>
          </form>
        ) : step === "code" ? (
          <div>
            <button
              type="button"
              onClick={() => go("email", -1)}
              className={cn(
                "-ml-1 mb-5 inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg px-1 text-[13px] text-foreground/60 transition-colors hover:text-foreground",
                ring,
              )}
            >
              <ArrowLeft className="size-3.5" strokeWidth={2} />
              Back
            </button>
            <AuthTitle title="Check your email">
              Enter the code we sent to <span className="font-medium text-foreground">{email.trim()}</span>.
            </AuthTitle>
            <div className="mt-6">
              <CodeInput
                key={shakeKey}
                length={length}
                value={code}
                onChange={(value) => {
                  setCode(value);
                  if (codeError) setCodeError("");
                }}
                onComplete={verify}
                invalid={Boolean(codeError)}
                disabled={busy}
              />
              <p aria-live="polite" className="mt-3 grid min-h-10 text-[12.5px] leading-5">
                <motion.span
                  key={codeError || (busy ? "busy" : "idle")}
                  initial={{ opacity: 0, y: -3 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE } }}
                  className={cn(codeError ? "text-[#c23b33] dark:text-[#f0716a]" : "text-foreground/50")}
                >
                  {codeError || (busy ? "Checking your code…" : "Paste the whole code, or type it. It expires in 10 minutes.")}
                </motion.span>
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-4 text-[13px] text-foreground/60">
              <span>Didn’t get it?</span>
              {resent ? (
                <motion.span
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="inline-flex items-center gap-1.5 font-medium text-foreground"
                >
                  <Check className="size-3.5 text-[var(--auth-accent)]" strokeWidth={2.5} />
                  New code sent
                </motion.span>
              ) : countdown.left > 0 ? (
                <span className="tabular-nums">Resend in {formatSeconds(countdown.left)}</span>
              ) : (
                <TextButton onClick={resend}>Resend code</TextButton>
              )}
            </div>
          </div>
        ) : (
          <div className="py-2">
            <SuccessMark size={40} />
            <div className="mt-5">
              <AuthTitle title="You’re signed in">Taking you to your workspace…</AuthTitle>
            </div>
            <div className="mt-6 h-1 w-40 overflow-hidden rounded-full bg-foreground/[0.08]">
              <motion.div
                className="h-full origin-left rounded-full bg-[var(--auth-accent)]"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 1.6, ease: "linear", delay: 0.3 }}
              />
            </div>
            <TextButton
              className="mt-6 text-[13px]"
              onClick={() => {
                setEmail("");
                go("email", -1);
              }}
            >
              Sign out and try again
            </TextButton>
          </div>
        )}
      </Steps>
    </AuthShell>
  );
}

export { AuthOtp, type AuthOtpProps };
