"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import MagneticButton from "./MagneticButton";

/**
 * The lead capture sequence, shared by the visit modal and the inline Visit
 * form so the flow is written exactly once.
 *
 * Three panes, carousel-style: details (name + one contact field) →
 * schedule (the day/time pickers) → confirmation with the brochure. The
 * two dots at the base track panes 1 and 2 only — the confirmation is a
 * destination, not a step. No route reaches the pickers without the
 * details validating first.
 *
 * The contact field detects its own type: an @ with a dot after it is
 * treated as an email, a digit string (with + space hyphen brackets,
 * 10–15 digits) as a phone number. The detected type ships with the
 * payload as `contactType`.
 *
 * Under prefers-reduced-motion the pane transition is an opacity swap.
 */

const EASE: [number, number, number, number] = [0.33, 1, 0.68, 1];

const TIMES = ["07:00", "09:00", "11:00", "17:00", "19:00"];

/* Swappable without a code change: the developer replaces the file or
   points NEXT_PUBLIC_BROCHURE_PATH somewhere else. */
const BROCHURE_PATH =
  process.env.NEXT_PUBLIC_BROCHURE_PATH || "/brochure/maison-de-build.pdf";

type Day = { iso: string; weekday: string; day: string };

type ContactType = "email" | "phone";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** One field, type detected. Returns null when it is neither a plausible
 *  email nor a plausible phone number. */
function detectContact(raw: string): ContactType | null {
  const value = raw.trim();
  if (!value) return null;
  const at = value.indexOf("@");
  if (at > -1) {
    return value.indexOf(".", at) > at &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ? "email"
      : null;
  }
  if (/^[\d+\s\-()]+$/.test(value)) {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15 ? "phone" : null;
  }
  return null;
}

export default function LeadFlow({ idPrefix }: { idPrefix: string }) {
  const reduce = useReducedMotion();

  const [pane, setPane] = useState(0);
  const [dir, setDir] = useState(1);

  const [fullName, setFullName] = useState("");
  const [contact, setContact] = useState("");
  const [touched, setTouched] = useState({ name: false, contact: false });
  const [slotDate, setSlotDate] = useState("");
  const [slotTime, setSlotTime] = useState("");
  const [slotErrors, setSlotErrors] = useState({ date: false, time: false });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const [days, setDays] = useState<Day[]>([]);

  // The brochure is downloaded only when the visitor clicks the button —
  // the auto-download that used to fire here was removed by client request.

  // The next seven days, computed on the client so server and client
  // markup never disagree around midnight.
  useEffect(() => {
    const list: Day[] = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      list.push({
        iso: d.toISOString().slice(0, 10),
        weekday: d.toLocaleDateString("en-GB", { weekday: "short" }),
        day: String(d.getDate()).padStart(2, "0"),
      });
    }
    setDays(list);
  }, []);

  const nameValid = fullName.trim().length >= 2;
  const contactType = detectContact(contact);
  const contactValid = contactType !== null;
  const detailsValid = nameValid && contactValid;

  const go = (to: number) => {
    setDir(to > pane ? 1 : -1);
    setPane(to);
  };

  const submit = async () => {
    const missing = { date: !slotDate, time: !slotTime };
    setSlotErrors(missing);
    if (missing.date || missing.time || !contactType) return;
    setSubmitting(true);
    setSubmitError(false);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          contact: contact.trim(),
          contactType,
          slotDate,
          slotTime,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      window.gtag?.("event", "generate_lead");
      go(2);
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  };

  const variants = {
    enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: 24 * d }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: -24 * d }),
  };

  return (
    <div>
      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div
          key={pane}
          custom={dir}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.35, ease: EASE }}
        >
          {pane === 0 && (
            <div className="flex flex-col gap-9">
              <div>
                <label
                  htmlFor={`${idPrefix}-fullName`}
                  className="label block text-cream"
                >
                  Full name
                </label>
                <input
                  id={`${idPrefix}-fullName`}
                  type="text"
                  autoComplete="name"
                  className="underline-input mt-2"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                />
                {touched.name && !nameValid && (
                  <p className="mt-2 text-xs text-orange" role="alert">
                    Please share your full name.
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor={`${idPrefix}-contact`}
                  className="label block text-cream"
                >
                  Contact
                </label>
                <input
                  id={`${idPrefix}-contact`}
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="Email or phone"
                  className="underline-input mt-2"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, contact: true }))}
                />
                {touched.contact && contact.trim() !== "" && !contactValid && (
                  <p className="mt-2 text-xs text-orange" role="alert">
                    Enter an email address or a phone number.
                  </p>
                )}
              </div>

              <MagneticButton className="mt-2">
                <button
                  type="button"
                  disabled={!detailsValid}
                  onClick={() => go(1)}
                  data-theme="cream"
                  className="label w-full bg-cream px-8 py-4 text-ink transition-colors duration-300 hover:text-orange disabled:opacity-40 sm:w-auto"
                >
                  Continue
                </button>
              </MagneticButton>
            </div>
          )}

          {pane === 1 && (
            <div className="flex flex-col gap-9">
              <button
                type="button"
                onClick={() => go(0)}
                aria-label="Back to your details"
                className="flex h-10 w-10 items-center justify-center border border-cream/25 text-cream transition-colors duration-300 hover:border-cream/60"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              <fieldset>
                <legend className="label text-cream">Day</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {days.map((d) => {
                    const active = slotDate === d.iso;
                    return (
                      <button
                        key={d.iso}
                        type="button"
                        onClick={() => {
                          setSlotDate(d.iso);
                          setSlotErrors((s) => ({ ...s, date: false }));
                        }}
                        aria-pressed={active}
                        className={`flex min-w-[3.6rem] flex-col items-center gap-1 border px-3 py-2.5 transition-colors duration-300 ${
                          active
                            ? "border-orange text-cream"
                            : "border-cream/25 text-cream hover:border-cream/60"
                        }`}
                      >
                        <span className="text-[10px] uppercase tracking-[0.18em]">
                          {d.weekday}
                        </span>
                        <span className="data text-base">{d.day}</span>
                      </button>
                    );
                  })}
                </div>
                {slotErrors.date && (
                  <p className="mt-2 text-xs text-orange" role="alert">
                    Choose a day.
                  </p>
                )}
              </fieldset>

              <fieldset>
                <legend className="label text-cream">Time</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {TIMES.map((t) => {
                    const active = slotTime === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setSlotTime(t);
                          setSlotErrors((s) => ({ ...s, time: false }));
                        }}
                        aria-pressed={active}
                        className={`data border px-4 py-2.5 text-sm transition-colors duration-300 ${
                          active
                            ? "border-orange text-cream"
                            : "border-cream/25 text-cream hover:border-cream/60"
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
                {slotErrors.time && (
                  <p className="mt-2 text-xs text-orange" role="alert">
                    Choose a time.
                  </p>
                )}
              </fieldset>

              <MagneticButton className="mt-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={submit}
                  data-theme="cream"
                  className="label w-full bg-cream px-8 py-4 text-ink transition-colors duration-300 hover:text-orange disabled:opacity-60 sm:w-auto"
                >
                  {submitting ? "Sending" : "Schedule a visit"}
                </button>
              </MagneticButton>

              {submitError && (
                <p className="text-xs text-orange" role="alert">
                  That did not send. Please try again.
                </p>
              )}
            </div>
          )}

          {pane === 2 && (
            <div>
              <p className="type-subhead">Thank you. We will be in touch.</p>
              <div className="mt-8 h-px w-10 bg-orange" aria-hidden="true" />
              <a
                href={BROCHURE_PATH}
                download
                className="label mt-10 inline-block border border-cream/30 px-8 py-4 text-cream transition-colors duration-300 hover:border-orange"
              >
                Download brochure
              </a>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Two dots: the details and schedule panes. The confirmation is a
          destination, not a step, so it carries no dot. */}
      {pane < 2 && (
        <div className="mt-10 flex justify-center gap-2.5" aria-hidden="true">
          {[0, 1].map((i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                i === pane ? "bg-cream" : "bg-cream/25"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
