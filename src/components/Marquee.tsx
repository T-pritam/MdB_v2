"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Kinetic type divider — BUILD · RETURN · MAINTAIN.
 * The track drifts right-to-left at walking pace on its own; scroll
 * velocity (either direction) fast-forwards the drift, then it settles.
 * Ticker-driven with a seamless measured wrap. Ported physics from the
 * reference build; its gradient dot and skewY shear are NOT inherited —
 * solid Orange dots, no shear, Montserrat only.
 *
 * prefers-reduced-motion: the ticker is never added; the track sits
 * static at x = 0.
 */

const WORDS = ["INTELLIGENT", "DISCIPLINED", "VITAL"];
const TRACK = Array(6).fill(WORDS).flat() as string[];

const BASE = 70; // px/s resting drift
const KICK = 9; // px/s boost per px scrolled
const MAX = 1100; // boost ceiling so a fast flick never blurs the words
const DECAY = 3.2; // higher = boost dies quicker after the scroll stops

export default function Marquee() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const root = rootRef.current;
    if (!root) return;
    const track = root.querySelector<HTMLElement>(".marquee-track");
    if (!track) return;
    const words = track.querySelectorAll<HTMLElement>(".marquee-word");

    // The wrap distance. The ghost/solid styling alternates with period 2,
    // and a copy is 3 words, so position AND styling only repeat together
    // every TWO copies (6 words) — wrapping at one copy would swap solid
    // and ghost at the seam. Measured, not assumed; re-measured on resize
    // and after the font swap (a pre-swap measure gives a wrong cycle and
    // a visible jump at the wrap).
    let cycle = 1;
    const measure = () => {
      cycle = words[WORDS.length * 2].offsetLeft - words[0].offsetLeft || 1;
    };
    measure();
    document.fonts.ready.then(measure);
    window.addEventListener("resize", measure);

    const setX = gsap.quickSetter(track, "x", "px") as (value: number) => void;

    let x = 0;
    let boost = 0;
    let lastY = window.scrollY;

    const tick = (_time: number, dtMs: number) => {
      const dt = Math.min(dtMs, 100) / 1000; // clamp guards tab-away jumps
      const y = window.scrollY;
      boost = Math.min(MAX, boost + Math.abs(y - lastY) * KICK);
      boost *= Math.exp(-DECAY * dt);
      lastY = y;
      x = (x + (BASE + boost) * dt) % cycle;
      setX(-x);
    };
    gsap.ticker.add(tick);

    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <section
      ref={rootRef}
      data-theme="ink"
      aria-hidden="true"
      className="marquee relative bg-ink text-cream"
    >
      <div className="marquee-track">
        {TRACK.map((word, i) => (
          <span key={i} className="marquee-pair">
            <span
              className={`marquee-word ${i % 2 === 1 ? "marquee-word--ghost" : ""}`}
            >
              {word}
            </span>
            <span className="marquee-dot" />
          </span>
        ))}
      </div>
    </section>
  );
}
