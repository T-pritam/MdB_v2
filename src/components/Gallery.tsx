"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";
import {
  classifyGesture,
  ADVANCE_FRACTION,
  EDGE_RESIST,
  FLICK_PX_PER_S,
  SNAP_S,
  type GesturePhase,
} from "@/lib/gesture";
import { makeCounterRoll } from "@/lib/counterRoll";

/**
 * THE GALLERY — the ledger. This house keeps records; the gallery is a
 * record, not a slideshow. A typographic index of the seven rooms on the
 * left, one calm portrait frame on the right. The type does the moving:
 * the active row brightens to Cream, steps 8px in, and draws the
 * section's only orange — a 1px rule beneath it — while the image simply
 * crossfades behind (0.7s, incoming settling from 1.03).
 *
 * Strictly 2D: no WebGL, no CSS 3D, no pin — normal flow, content
 * height. Auto-advances every 4.5s; hovering a row jumps to it and
 * pauses; leaving the index resumes after 2s. Rows are real buttons —
 * focusable, Enter/Space selects, Stone focus ring.
 *
 * Under 768px the index becomes a horizontal scrolling row of names
 * above a full-width frame (same engine, same rows). Under
 * prefers-reduced-motion: a static column, every name at full strength
 * above its own image, zero motion.
 *
 * Room names are draft, not client-approved.
 */

/* Images and room names in one place — the client's render batch, in
   the approved order. */
const PANELS = [
  { id: "g7", label: "The yoga studio", w: 1280, h: 720 },
  { id: "g8", label: "The movement floor", w: 1280, h: 720 },
  { id: "g9", label: "The reformers", w: 724, h: 524 },
  { id: "g10", label: "The alcoves", w: 674, h: 489 },
  { id: "g11", label: "The changing rooms", w: 1280, h: 960 },
  { id: "g12", label: "The lockers", w: 1280, h: 960 },
  { id: "g13", label: "The washrooms", w: 1280, h: 960 },
];

const COUNT = String(PANELS.length).padStart(2, "0");
const HOLD = 4.5; // seconds per room
const RESUME_AFTER = 2; // seconds after the pointer leaves the index

const pad = (n: number) => String(n).padStart(2, "0");

/* ── Mobile swipe constants (Layer 2) ─────────────────────────────
   The track runs on one continuous position value P in card-index
   space, like the Activities fan: card i sits at x = (i − P) × spacing,
   and the peek scale/opacity ride the same value through a power3.out
   ease. A release snaps to the nearest permitted index. The snap
   contract (ADVANCE_FRACTION, FLICK_PX_PER_S, EDGE_RESIST, SNAP_S)
   lives in src/lib/gesture.ts, shared verbatim with the Activities
   carousel. */
/** Side cards at rest: scale(0.92), opacity 0.45 (active: 1 / 1). */
const PEEK_SCALE_DROP = 0.08;
const PEEK_OPACITY_DROP = 0.55;

/* useLayoutEffect on the client so the counter roll starts before paint;
   plain useEffect during SSR to keep React quiet. */
const useIsoLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function PanelImage({ panel }: { panel: (typeof PANELS)[number] }) {
  return (
    <picture>
      <source srcSet={`/images/gallery/${panel.id}.webp`} type="image/webp" />
      <img
        src={`/images/gallery/${panel.id}.jpg`}
        alt={panel.label}
        width={panel.w}
        height={panel.h}
        loading="lazy"
        draggable={false}
      />
    </picture>
  );
}

export default function Gallery() {
  const ref = useRef<HTMLElement>(null);
  const indexRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const seededRef = useRef(false);
  const [mode, setMode] = useState<"ledger" | "static">("ledger");
  const [active, setActive] = useState(0);

  // Mobile gate (Layer 2): the swipe track replaces the crossfade below
  // 768px. Checked once, like the other Layer 1 mobile branches; never
  // true on desktop, so every branch it guards is mobile-only.
  const [isMobileSwipe] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches
  );
  const countRef = useRef<HTMLSpanElement>(null);
  const prevActiveRef = useRef(0);
  // The index the track is settled on or snapping toward.
  const trackTargetRef = useRef(0);
  // Set by the mobile engine so external active changes (auto-advance,
  // label taps) can drive the track; null when the engine is not running.
  const trackGoToRef = useRef<((idx: number) => void) | null>(null);

  useEffect(() => {
    const decide = () => setMode(prefersReducedMotion() ? "static" : "ledger");
    decide();
    window.addEventListener("resize", decide);
    return () => window.removeEventListener("resize", decide);
  }, []);

  // The two pins (FiveFloors, Story) measure through this section;
  // refresh once late arrivals have settled layout.
  useEffect(() => {
    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener("load", onLoad);
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) ScrollTrigger.refresh();
    });
    return () => {
      cancelled = true;
      window.removeEventListener("load", onLoad);
    };
  }, []);

  // Heading reveal — the house standard.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from(".gallery-rise", {
        opacity: 0,
        y: 16,
        duration: 0.7,
        ease: "power2.out",
        scrollTrigger: { trigger: ref.current, start: "top 85%", once: true },
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  // The image crossfade: calm, no wipe, no slide — the type moves, the
  // image resolves.
  useEffect(() => {
    if (mode !== "ledger") {
      seededRef.current = false;
      return;
    }
    // Mobile: the swipe engine below owns the layers; the crossfade
    // never runs. Desktop path is untouched.
    if (isMobileSwipe) return;
    const frame = frameRef.current;
    if (!frame) return;
    const layers = Array.from(frame.querySelectorAll<HTMLElement>(".ledger-layer"));
    if (!layers.length) return;

    if (!seededRef.current) {
      seededRef.current = true;
      layers.forEach((l, i) => gsap.set(l, { opacity: i === active ? 1 : 0 }));
      return;
    }

    const incoming = layers[active];
    const img = incoming?.querySelector("img");
    gsap.to(incoming, {
      opacity: 1,
      duration: 0.7,
      ease: "power2.out",
      overwrite: true,
    });
    if (img) {
      gsap.fromTo(
        img,
        { scale: 1.03 },
        { scale: 1, duration: 0.7, ease: "power2.out", overwrite: true }
      );
    }
    layers.forEach((l, i) => {
      if (i !== active) {
        gsap.to(l, { opacity: 0, duration: 0.7, ease: "power2.out", overwrite: true });
      }
    });
  }, [active, mode]);

  /* ── Mobile only (Layer 2): the swipe track ─────────────────────
     One continuous position P in card-index space. Cards either side
     of the active one peek at the viewport edges (scale 0.92, opacity
     0.45, riding the same P through power3.out); horizontal drag is
     classified with the dumbbell's shared 8px / |dx|>|dy| rule; release
     snaps to the nearest permitted index, 0.5s power3.out. A gesture
     never advances more than one index. */
  useEffect(() => {
    if (!isMobileSwipe || mode !== "ledger") return;
    const frame = frameRef.current;
    if (!frame) return;
    const layers = Array.from(
      frame.querySelectorAll<HTMLElement>(".ledger-layer")
    );
    if (!layers.length) return;

    const n = layers.length;
    const easeOut = gsap.parseEase("power3.out");
    // Neighbour spacing: 8px under the card width, so each side card
    // peeks past the frame into the full-bleed clip window.
    let spacing = Math.max(frame.clientWidth - 8, 1);
    const pos = { p: trackTargetRef.current };

    const apply = () => {
      layers.forEach((el, i) => {
        const d = i - pos.p;
        // Position is linear in P; the peek scale/opacity ride the same
        // progress value through the brand's cubic ease-out.
        const t = easeOut(Math.min(Math.abs(d), 1));
        gsap.set(el, {
          x: d * spacing,
          scale: 1 - PEEK_SCALE_DROP * t,
          opacity: 1 - PEEK_OPACITY_DROP * t,
          zIndex: 10 - Math.round(Math.abs(d)),
        });
      });
    };

    let snapTween: gsap.core.Tween | null = null;
    const goTo = (idx: number) => {
      trackTargetRef.current = idx;
      snapTween?.kill();
      snapTween = gsap.to(pos, {
        p: idx,
        duration: SNAP_S,
        ease: "power3.out",
        onUpdate: apply,
      });
    };

    // ── Drag: classified with the dumbbell's shared rule ──────────
    let phase: GesturePhase = "idle";
    let startX = 0;
    let startY = 0;
    let startP = 0;
    let fromIdx = 0;
    let samples: { t: number; x: number }[] = [];

    const onDown = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      phase = "pending";
      startX = e.clientX;
      startY = e.clientY;
      fromIdx = trackTargetRef.current;
      samples = [{ t: performance.now(), x: e.clientX }];
    };

    const onMove = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      if (phase === "pending") {
        const cls = classifyGesture(e.clientX - startX, e.clientY - startY);
        if (cls === null) return;
        if (cls === "drag") {
          phase = "drag";
          frame.setPointerCapture(e.pointerId);
          snapTween?.kill();
          startX = e.clientX;
          startP = pos.p;
        } else {
          // Vertical intent: the browser owns it (touch-action: pan-y).
          phase = "scroll";
        }
        return;
      }
      if (phase !== "drag") return;
      let p = startP - (e.clientX - startX) / spacing;
      // Soft resistance past either end — the track has no wrap.
      if (p < 0) p *= EDGE_RESIST;
      else if (p > n - 1) p = n - 1 + (p - (n - 1)) * EDGE_RESIST;
      pos.p = p;
      apply();
      const now = performance.now();
      samples.push({ t: now, x: e.clientX });
      while (samples.length > 2 && now - samples[0].t > 120) samples.shift();
    };

    const onUp = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      const wasDrag = phase === "drag";
      phase = "idle";
      if (!wasDrag) return;
      try {
        frame.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      // Velocity over the last ~120ms, px/s; negative = swiping left.
      const now = performance.now();
      const old = samples.find((s) => now - s.t <= 120) ?? samples[0];
      const dtS = Math.max((now - old.t) / 1000, 0.016);
      const vx = (e.clientX - old.x) / dtS;

      // Advance rules — capped at ONE index either way per gesture:
      // past 25% of card width advances regardless of velocity; below
      // that, a flick over 250 px/s advances; otherwise snap back.
      const offset = pos.p - fromIdx;
      let target = fromIdx;
      if (Math.abs(offset) > ADVANCE_FRACTION) {
        target = fromIdx + Math.sign(offset);
      } else if (Math.abs(vx) > FLICK_PX_PER_S) {
        target = fromIdx + (vx < 0 ? 1 : -1);
      }
      target = Math.max(0, Math.min(n - 1, target));
      goTo(target);
      if (target !== fromIdx) setActive(target);
    };

    const onResize = () => {
      spacing = Math.max(frame.clientWidth - 8, 1);
      apply();
    };

    frame.addEventListener("pointerdown", onDown);
    frame.addEventListener("pointermove", onMove);
    frame.addEventListener("pointerup", onUp);
    frame.addEventListener("pointercancel", onUp);
    window.addEventListener("resize", onResize);

    trackGoToRef.current = (idx: number) => {
      if (phase === "drag" || trackTargetRef.current === idx) return;
      goTo(idx);
    };

    pos.p = trackTargetRef.current;
    apply();

    return () => {
      trackGoToRef.current = null;
      snapTween?.kill();
      frame.removeEventListener("pointerdown", onDown);
      frame.removeEventListener("pointermove", onMove);
      frame.removeEventListener("pointerup", onUp);
      frame.removeEventListener("pointercancel", onUp);
      window.removeEventListener("resize", onResize);
      gsap.set(layers, { clearProps: "transform,opacity,zIndex" });
    };
  }, [isMobileSwipe, mode]);

  // Mobile: auto-advance and label taps drive the same track.
  useEffect(() => {
    trackGoToRef.current?.(active);
  }, [active]);

  // Mobile: the NN / 07 counter rolls between indices with the same
  // odometer mechanic FiveFloors uses (src/lib/counterRoll.ts). Layout
  // effect so the roll starts from the previous value before paint.
  useIsoLayoutEffect(() => {
    const prev = prevActiveRef.current;
    prevActiveRef.current = active;
    if (!isMobileSwipe || mode !== "ledger") return;
    const el = countRef.current;
    if (!el || prev === active) return;
    const { target, vars } = makeCounterRoll(prev, active, el, (v) =>
      pad(v + 1)
    );
    el.textContent = pad(prev + 1);
    const tween = gsap.to(target, vars);
    return () => {
      tween.kill();
    };
  }, [active, mode, isMobileSwipe]);

  // Mobile (Layer 2 fix, Part C): the label strip follows the active
  // index. React's `active` state is the single source of truth — the
  // swipe release, label taps and the auto-advance all write it, and
  // the rows' styling, the counter, the track snap and this strip
  // offset all read it. The strip's scroll offset tweens so the active
  // label sits centred (clamped at the track's ends), on the same 0.5s
  // power3.out the card snap uses — label and image move as one.
  // Desktop's vertical index has no scroll offset; the effect is
  // mobile-only. Reduced motion: the offset is set instantly.
  useEffect(() => {
    if (!isMobileSwipe || mode !== "ledger") return;
    const rows = indexRef.current?.querySelector<HTMLElement>(".ledger-rows");
    const row = rows?.children[active] as HTMLElement | undefined;
    if (!rows || !row) return;
    const rowsRect = rows.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const delta =
      rowRect.left + rowRect.width / 2 - (rowsRect.left + rowsRect.width / 2);
    const target = Math.max(
      0,
      Math.min(rows.scrollWidth - rows.clientWidth, rows.scrollLeft + delta)
    );
    if (prefersReducedMotion()) {
      rows.scrollLeft = target;
      return;
    }
    const tween = gsap.to(rows, {
      scrollLeft: target,
      duration: SNAP_S,
      ease: "power3.out",
      overwrite: "auto",
    });
    return () => {
      tween.kill();
    };
  }, [active, isMobileSwipe, mode]);

  // The advance engine: one delayed call, paused while the index is
  // hovered, resuming 2s after the pointer leaves.
  useEffect(() => {
    if (mode !== "ledger") return;
    const index = indexRef.current;
    if (!index) return;

    let timer: gsap.core.Tween | null = null;
    let resume: gsap.core.Tween | null = null;

    const schedule = () => {
      timer?.kill();
      timer = gsap.delayedCall(HOLD, () => {
        setActive((a) => (a + 1) % PANELS.length);
        schedule();
      });
    };
    const onEnter = () => {
      timer?.kill();
      resume?.kill();
    };
    const onLeave = () => {
      resume?.kill();
      resume = gsap.delayedCall(RESUME_AFTER, schedule);
    };
    index.addEventListener("mouseenter", onEnter);
    index.addEventListener("mouseleave", onLeave);

    // Mobile only: a touch on the track pauses the advance the same way
    // hovering the index does on desktop, resuming 2s after release.
    const frame = isMobileSwipe ? frameRef.current : null;
    if (frame) {
      frame.addEventListener("pointerdown", onEnter);
      frame.addEventListener("pointerup", onLeave);
      frame.addEventListener("pointercancel", onLeave);
    }
    schedule();

    return () => {
      timer?.kill();
      resume?.kill();
      index.removeEventListener("mouseenter", onEnter);
      index.removeEventListener("mouseleave", onLeave);
      if (frame) {
        frame.removeEventListener("pointerdown", onEnter);
        frame.removeEventListener("pointerup", onLeave);
        frame.removeEventListener("pointercancel", onLeave);
      }
    };
  }, [mode]);

  if (mode === "static") {
    return (
      <section
        ref={ref}
        id="gallery"
        data-theme="ink"
        aria-label="The house, inside"
        className="relative isolate section-pad bg-ink text-cream"
      >
        <div className="content-wrap">
          <h2 className="type-title">Inside.</h2>
          <div className="mt-16 flex flex-col gap-20">
            {PANELS.map((p) => (
              <figure key={p.id} className="ledger-static m-0">
                <figcaption className="ledger-static-name">{p.label}</figcaption>
                <PanelImage panel={p} />
              </figure>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={ref}
      id="gallery"
      data-theme="ink"
      aria-label="The house, inside"
      className="relative isolate section-pad bg-ink text-cream"
    >
      <div className="content-wrap">
        <h2 className="gallery-rise type-title">Inside.</h2>

        <div className="ledger-grid mt-16">
          <div ref={indexRef} className="ledger-index">
            {/* The number sits in its own (unstyled, inline) span so the
                mobile counter roll has a text node to write; desktop
                renders the identical "NN / 07" and never touches it. */}
            <p className="data mb-6 text-sm text-stone" aria-live="polite">
              <span ref={countRef}>{pad(active + 1)}</span> / {COUNT}
            </p>
            <div className="ledger-rows" role="list">
              {PANELS.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  role="listitem"
                  aria-pressed={i === active}
                  className={`ledger-row${i === active ? " is-active" : ""}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => setActive(i)}
                >
                  {p.label}
                  <span className="ledger-rule" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>

          <div ref={frameRef} className="ledger-frame">
            {PANELS.map((p) => (
              <div key={p.id} className="ledger-layer">
                <PanelImage panel={p} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
