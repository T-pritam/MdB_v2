"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import { getLenis } from "@/lib/scroll";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";
import { requestGyroFromGesture, startGyroDirect } from "@/lib/gyro";
import Wordmark from "./Wordmark";

/**
 * THE GATE — details + OTP before anything past the hero.
 *
 * The hero scrolls free. Once more than 60px of content beyond the
 * hero's bottom edge has entered the viewport, scroll locks (Lenis
 * stopped + body overflow hidden) and the full-screen gate appears:
 * pane 1 collects name and mobile, pane 2 takes a six-digit code.
 *
 * MOCK MODE: no SMS is sent and any six digits verify. The developer
 * handoff comments below mark exactly where Firebase Phone Auth plugs
 * in. On unlock a 90-day token lands in localStorage; a valid token
 * skips the gate entirely on later visits.
 *
 * Cream, Montserrat, no shadows, no gradients, no close button — the
 * only way through is the form. prefers-reduced-motion shows and hides
 * instantly instead of fading.
 */

const STORAGE_KEY = "mdb_verified";
const TOKEN_DAYS = 90;

type Pane = "cleared" | "armed" | "details" | "otp";

export default function ScrollGate() {
  const [pane, setPane] = useState<Pane>("armed");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [nameError, setNameError] = useState(false);
  const [phoneError, setPhoneError] = useState(false);
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [otpError] = useState(false); // never set in mock mode; real in production

  const overlayRef = useRef<HTMLDivElement>(null);
  const boxRefs = useRef<(HTMLInputElement | null)[]>([]);
  const paneRef = useRef<Pane>("armed");
  paneRef.current = pane;

  // ── Gyroscope parallax (mobile only) ─────────────────────────────
  // Platforms with no permission API (Android) start listening
  // immediately; iOS is handled inside the VERIFY tap below. Desktop
  // never runs either path — both are gated on the mobile breakpoint.
  useEffect(() => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    startGyroDirect();
  }, []);

  // ── Token check + the scroll trigger ─────────────────────────────
  useEffect(() => {
    // Valid token — skip the gate entirely, Lenis stays running.
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { expiresAt } = JSON.parse(stored);
        if (new Date(expiresAt) > new Date()) {
          setPane("cleared");
          return;
        }
        // Expired — remove and gate as if first visit.
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }

    // Trigger measurement: the hero's bottom edge in document space
    // (offsetTop + offsetHeight of #top, re-measured on resize). The
    // gate opens when scrollY exceeds (heroBottom − viewportHeight) +
    // 60 — i.e. when more than 60px of content beyond the hero's bottom
    // has scrolled into view. Never on load, never inside the hero.
    const hero = document.getElementById("top");
    if (!hero) return;
    let heroBottom = hero.offsetTop + hero.offsetHeight;
    const remeasure = () => {
      heroBottom = hero.offsetTop + hero.offsetHeight;
    };
    window.addEventListener("resize", remeasure);

    let queued = false;
    const check = () => {
      queued = false;
      if (paneRef.current !== "armed") return;
      if (window.scrollY > heroBottom - window.innerHeight + 60) {
        // Lock scroll exactly where the user is and open the gate.
        getLenis()?.stop();
        document.body.style.overflow = "hidden";
        setPane("details");
      }
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(check);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", remeasure);
    };
  }, []);

  // ── The gate owns the pointer while open ─────────────────────────
  // The overlay is a form, and the custom ring (z-index 70) sits below
  // it (z-index 80) while the ring globally suppresses the native
  // cursor — so without this there is no visible pointer inside the
  // gate. html.gate-open hides the ring and restores native cursors
  // within the overlay (see globals.css); removed again on unlock.
  const gateOpen = pane === "details" || pane === "otp";
  useEffect(() => {
    if (!gateOpen) return;
    document.documentElement.classList.add("gate-open");
    return () => document.documentElement.classList.remove("gate-open");
  }, [gateOpen]);

  // ── Pane 1: details ──────────────────────────────────────────────
  const submitDetails = () => {
    const nameOk = fullName.trim().length > 0;
    const digits = phone.replace(/[\s-]/g, "");
    const phoneOk = /^\d{10}$/.test(digits);
    setNameError(!nameOk);
    setPhoneError(!phoneOk);
    if (!nameOk || !phoneOk) return;

    // DEVELOPER HANDOFF — replace console.log with your lead capture call here.
    // Payload: { fullName: string, phone: string, timestamp: ISO string }
    // This fires before OTP is sent. Wire to your backend or Firebase here.
    console.log("[MdB gate] lead", {
      fullName: fullName.trim(),
      phone: `+91${digits}`,
      timestamp: new Date().toISOString(),
    });

    setPhone(digits);
    setPane("otp");
  };

  // ── Pane 2: OTP boxes ────────────────────────────────────────────
  const setDigit = (i: number, value: string) => {
    const d = value.replace(/\D/g, "").slice(-1);
    setOtp((prev) => {
      const next = [...prev];
      next[i] = d;
      return next;
    });
    if (d && i < 5) boxRefs.current[i + 1]?.focus();
  };

  const onBoxKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) {
      boxRefs.current[i - 1]?.focus();
    }
  };

  const onBoxPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    if (text.length < 6) return;
    e.preventDefault();
    setOtp(text.slice(0, 6).split(""));
    boxRefs.current[5]?.focus();
  };

  const otpComplete = otp.every((d) => /^\d$/.test(d));

  const unlockAndStore = () => {
    const now = new Date();
    const expires = new Date(now.getTime() + TOKEN_DAYS * 24 * 60 * 60 * 1000);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        phone: `+91${phone}`,
        verifiedAt: now.toISOString(),
        expiresAt: expires.toISOString(),
      })
    );
    getLenis()?.start();
    document.body.style.overflow = "";

    // Dismiss: simple opacity fade, then out of the DOM. Scroll continues
    // from exactly where the user was — nothing repositions.
    const overlay = overlayRef.current;
    if (prefersReducedMotion() || !overlay) {
      setPane("cleared");
      return;
    }
    gsap.to(overlay, {
      autoAlpha: 0,
      duration: 0.3,
      ease: "power2.out",
      onComplete: () => setPane("cleared"),
    });
  };

  // DEVELOPER HANDOFF — OTP verification stub.
  // Replace this block with Firebase Phone Auth confirmationResult.confirm(otp).
  // On Firebase success: call unlockAndStore() below.
  // On Firebase failure: show the inline error message below the boxes.
  // ENV VARS NEEDED: NEXT_PUBLIC_FIREBASE_API_KEY, AUTH_DOMAIN, PROJECT_ID.
  const verify = () => {
    // iOS only honours DeviceOrientationEvent.requestPermission() when it is
    // called synchronously inside a user gesture. The VERIFY tap is the one
    // gesture every first-time visitor performs, so the request rides on it
    // — mobile only; desktop's tap handler is byte-identical to before.
    // Denial or absence of the API degrades silently to touch-only.
    if (window.matchMedia("(max-width: 767px)").matches) {
      requestGyroFromGesture();
    }
    if (!otpComplete) return;
    // Mock mode: any six digits pass.
    unlockAndStore();
  };

  if (pane === "cleared" || pane === "armed") return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Verify to continue"
      data-theme="cream"
      className="gate-overlay fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-cream text-ink"
    >
      <div className="flex w-full max-w-[420px] flex-col items-center px-6 py-16 text-center">
        <div className="w-[min(60vw,300px)] text-ink" aria-hidden="true">
          <Wordmark className="h-auto w-full" decorative />
        </div>

        {pane === "details" && (
          <>
            <p className="type-body mt-12">To continue, we need one detail.</p>

            <div className="mt-10 w-full text-left">
              <label htmlFor="gate-name" className="label block">
                Full name
              </label>
              <input
                id="gate-name"
                type="text"
                autoComplete="name"
                className="underline-input mt-2"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              {nameError && (
                <p className="label mt-2 text-stone" role="alert">
                  Please share your full name
                </p>
              )}
            </div>

            <div className="mt-8 w-full text-left">
              <label htmlFor="gate-phone" className="label block">
                Mobile number
              </label>
              <div className="flex items-baseline gap-3">
                <span className="data pt-3 text-sm">+91</span>
                <input
                  id="gate-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  className="underline-input mt-2"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              {phoneError && (
                <p className="label mt-2 text-stone" role="alert">
                  Enter the ten-digit mobile number
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={submitDetails}
              className="label mt-12 bg-orange px-10 py-4 text-ink transition-opacity duration-300 hover:opacity-85"
            >
              Continue
            </button>
          </>
        )}

        {pane === "otp" && (
          <>
            <p className="type-body mt-12">
              A code has been sent to +91 {phone}.
            </p>

            <div className="mt-10 flex justify-center gap-3">
              {otp.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    boxRefs.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  aria-label={`Digit ${i + 1}`}
                  className="gate-otp data h-14 w-11 border border-ink/30 bg-transparent text-center text-xl focus:border-ink focus:outline-none"
                  value={d}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => onBoxKeyDown(i, e)}
                  onPaste={onBoxPaste}
                />
              ))}
            </div>

            {otpError && (
              <p className="label mt-4 text-stone" role="alert">
                That code didn&apos;t match. Try again.
              </p>
            )}

            <button
              type="button"
              onClick={verify}
              disabled={!otpComplete}
              className="label mt-12 bg-orange px-10 py-4 text-ink transition-opacity duration-300 hover:opacity-85 disabled:opacity-35"
            >
              Verify
            </button>

            <button
              type="button"
              onClick={() => setPane("details")}
              className="label mt-6 text-stone transition-colors duration-300 hover:text-ink"
            >
              ← Change number
            </button>
          </>
        )}
      </div>
    </div>
  );
}
