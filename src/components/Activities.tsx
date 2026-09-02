"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import { gsap } from "@/lib/gsap";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";
import {
  classifyGesture,
  ADVANCE_FRACTION,
  FLICK_PX_PER_S,
  type GesturePhase,
} from "@/lib/gesture";

/**
 * ACTIVITIES — the fan of plates. Twelve disciplines spread like a hand
 * of engraved plates: typographic cards over dimmed placeholder imagery.
 *
 * The fan runs on ONE continuous position value P (a float in card-index
 * space). Every card derives its transform from the interpolation
 * formula — rot = d·24, scale = 1 − 0.2244d², x = d·19, y = d²·6 with
 * d = wrapped(i − P) / 3 — so fractional positions mid-drag are native,
 * and arrows, drag, coast and settle are all the same code path: a
 * single rAF that writes P through applyPosition(). Geometry lives on
 * each card's OUTER wrapper; the entrance reveal and the hover
 * choreography live on the INNER card, so the three systems can never
 * fight over one transform.
 *
 * Drag: pointer-captured, 1:1 with the finger (one visual card spacing
 * of drag moves one card), velocity taken from the last ~100ms, decayed
 * at ~4.5/s, total coast capped at ~3 cards, then a 0.5s power2.out
 * settle onto the nearest index. Hover-lift is suppressed while
 * dragging; a movement over 8px swallows the click. touch-action pan-y
 * keeps vertical page scroll alive on touch.
 *
 * Orange appears once: a small rule on the centre plate.
 *
 * Below 768px the fan itself goes touch-native and ENDLESS: the
 * desktop rotation and scale formulas verbatim, translations scaled
 * by viewport ratio, P unbounded with each card's offset wrapped into
 * [−5.5, +5.5] so the hand loops in both directions, rolling momentum
 * on release (a flick travels multiple cards and decays to a settle —
 * never a hard snap), and tap-to-zoom: the tapped plate comes face-on
 * while its siblings hold position and dim. The gallery's
 * one-index-per-flick contract is NOT used here and is untouched
 * there. Desktop under prefers-reduced-motion (and no-JS) keeps the
 * plain grid; mobile reduced motion keeps the fan geometry with
 * single-card instant swipes and instant zoom/dismiss.
 */

const EASE: [number, number, number, number] = [0.33, 1, 0.68, 1];

/* Card backgrounds are placeholders — client imagery lands per card as
   it is approved; the treatment (grayscale, opacity, Ink veil) lives in
   CSS so swaps never need re-editing. Interiors 1/2 rotate where no
   subject image exists yet; no two neighbours repeat.
   Pickleball was cancelled and removed per the Membership + Access
   Guide; new activity cards wait until their images exist. */
const DISCIPLINES = [
  { name: "GYM", img: "1" },
  { name: "CROSSFIT", img: "2" },
  { name: "HIIT", img: "hiit" },
  { name: "BOXING", img: "boxing" },
  { name: "YOGA", img: "yoga" },
  { name: "PILATES", img: "2" },
  { name: "STEAM & SAUNA", img: "sauna" },
  { name: "SPA", img: "spa" },
  { name: "GAMING", img: "games-room" },
  { name: "RELAXATION LOUNGE", img: "lounge" },
  { name: "FIFTH ELEMENT CAFÉ", img: "cafe" },
];

const N = DISCIPLINES.length;
const HALF = 3; // half of the 7-slot visible window
const DECAY = 4.5; // momentum decay per second
const MAX_COAST = 3; // cards a flick may travel past release
const SETTLE_S = 0.5;

/* ── Mobile hand (Layer 2) ────────────────────────────────────────
   Below 768px the desktop fan renders as a held hand of cards, and
   the hand is endless: P grows unbounded and each card's offset wraps
   into [−5.5, +5.5], so cards leave one flank and re-enter the other.
   Rotation and scale are the desktop formulas EXACTLY (rot = d·24,
   scale = 1 − 0.2244d², d = wrapped(i − P)/3); only the translation
   terms scale: x = d·19rem·k, y = d²·6rem·k. */
/** Viewport ratio for the translation terms. Derivation: against the
    1024px desktop reference (the narrowest width the full-scale fan
    ships at), k₀ = vw/1024 left all 7 slots fully inside a 390px
    viewport — over the 5-visible target — so the divisor is tightened
    to 780, which lands k = 0.5 at 390 (the value the fan's own
    sub-768 multiplier table already prescribes) and pushes the ±3
    cards past the viewport edge: 5 full cards + 2 edge peeks. */
const M_K = () => window.innerWidth / 780;
/** Momentum decay per second — the desktop fan's own DECAY (4.5),
    which with the mobile card pitch yields ≈1.1 cards for a gentle
    250 px/s flick and ≈4.4 for a firm 1000 px/s one. */
const M_DECAY = DECAY;
/** EMA alpha for release velocity (the dumbbell's own value). */
const M_VEL_ALPHA = 0.3;
/** Below this |v| (cards/s) the roll settles to the nearest index. */
const M_STOP_V = 0.25;
/** The settle at the end of a roll: 0.4s power3.out. Never mid-roll. */
const M_SETTLE_S = 0.4;
/** Zoomed card target width; also capped by stage height (4/7 kept). */
const M_ZOOM_W = 380;
const M_ZOOM_VW = 0.86;
/** Siblings hold position and dim to this while a card is zoomed. */
const M_DIM = 0.15;
/** Zoom in/out tween. */
const M_ZOOM_S = 0.5;
/** The fade: opacity holds 1 through the 7-slot window (|off| ≤ 3),
    then a C¹ smoothstep reaches exactly 0 at |off| 4.5 — a full card
    before the wrap at |off| 5.5, so recycling is always invisible. */
const M_FADE_START = 3;
const M_FADE_END = 4.5;

/* useLayoutEffect on the client so the track is positioned before
   paint; plain useEffect during SSR to keep React quiet. */
const useIsoLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function getResponsiveMultiplier(width: number) {
  if (width < 480) return 0.28;
  if (width < 640) return 0.38;
  if (width < 768) return 0.5;
  if (width < 1024) return 0.75;
  return 1.0;
}

/* Scales y-offsets and entry distances when the viewport is shorter than
   the ideal deck height, so the fan never overflows vertically. */
function getHeightMultiplier(width: number) {
  let idealPx: number;
  if (width < 480) idealPx = 22 * 16;
  else if (width < 640) idealPx = 26 * 16;
  else if (width < 768) idealPx = 28 * 16;
  else if (width < 1024) idealPx = 34 * 16;
  else idealPx = 38 * 16;

  const available = window.innerHeight * 0.7;
  if (available >= idealPx) return 1;
  return available / idealPx;
}

const mod = (v: number, n: number) => ((v % n) + n) % n;

/** Shortest wrapped distance from position p to card i, in cards. */
const wrapOffset = (i: number, p: number) => {
  let off = mod(i - p, N);
  if (off > N / 2) off -= N;
  return off;
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.min(1, t), 3);

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -15% 0px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/* The static plate — the exact surface both the reduced-motion grid and
   the mobile hand's cards render: same border, background, padding and
   label scale as ever, imagery under the same veil. */
function StaticPlate({ d }: { d: (typeof DISCIPLINES)[number] }) {
  return (
    <div className="fan-card-static">
      <picture className="fan-card-img" aria-hidden="true">
        <source
          srcSet={`/images/activities/${d.img}.webp`}
          type="image/webp"
        />
        <img
          src={`/images/activities/${d.img}.jpg`}
          alt=""
          loading="lazy"
          draggable={false}
        />
      </picture>
      <span className="fan-card-veil" aria-hidden="true" />
      <span className="fan-name label">{d.name}</span>
    </div>
  );
}

export default function Activities() {
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // The mobile hand's clip window, and the engine's tap/dismiss entry
  // points (set while the engine runs, null otherwise).
  const clipRef = useRef<HTMLDivElement>(null);
  const cardTapRef = useRef<((i: number) => void) | null>(null);
  const dismissRef = useRef<(() => void) | null>(null);
  // Renders the full-area dismiss layer while a card is zoomed.
  const [zoomIdx, setZoomIdx] = useState<number | null>(null);
  const posRef = useRef(0); // the one continuous position
  const cycleRef = useRef<(dir: "left" | "right") => void>(() => {});
  const [centerIndex, setCenterIndex] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(prefersReducedMotion());
  }, []);

  const cycle = useCallback((dir: "left" | "right") => {
    cycleRef.current(dir);
  }, []);

  // Mobile (Layer 2): the hand replaces the 2-column grid. Set in an
  // effect so SSR and the desktop render are untouched; a no-JS mobile
  // visitor keeps the stacked grid fallback. Deliberately NOT gated on
  // motion preference — reduced motion gets the hand too, with
  // single-card instant swipes (see the engine below).
  const [mobileHand, setMobileHand] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setMobileHand(true);
    }
  }, []);

  /* ── Mobile only: the hand engine ───────────────────────────────
     The desktop fan's geometry with viewport-scaled translations, made
     ENDLESS: P grows unbounded and each card's offset wraps into
     [−n/2, +n/2], so cards leave one flank and re-enter the other —
     always at opacity 0 (the fade reaches zero at |off| 4.5, a full
     card before the wrap at 5.5). Every per-frame value is continuous
     in P: no clamps, no edge resistance, no coarse rounding. Writes go
     through per-card quickSetters created once; z-index is the one
     integer write (integers are inherent to z-index), strictly
     monotone in |off| at 0.01-card steps, so adjacent cards swap
     stacking within 0.005 cards of exact equidistance — the instant
     their mirrored poses match and the swap cannot be seen. Momentum
     decays at the fan's own DECAY (dt capped at 50ms so a dropped
     frame slows time instead of jumping P) and settles 0.4s power3.out
     onto the nearest index in unbounded P-space — |Δ| ≤ 0.5, so
     settling never unwinds the fan to reach an index. Tap-to-zoom
     brings the plate face-on; siblings hold position and dim (never UP
     from 0); a dismissed card returns to its live wrapped pose
     recomputed from the current P. Geometry rides the outer
     .fan-hand-card; the tap scale (CSS :active) rides .fan-card-static
     — two writers, two elements. Layout effect so the hand is
     positioned before first paint. */
  useIsoLayoutEffect(() => {
    if (!mobileHand) return;
    const clip = clipRef.current;
    if (!clip) return;
    const cards = Array.from(
      clip.querySelectorAll<HTMLElement>(".fan-hand-card")
    );
    if (!cards.length) return;

    const reducedNow = prefersReducedMotion();
    const n = cards.length;
    // With the wrap, every index rests symmetric — start on card 0.
    const pos = { p: 0 };

    // Offset wrapped into (−n/2, +n/2]: continuous in P everywhere
    // except the recycle jump at ±n/2 — where the card is invisible.
    const wrapOff = (i: number) => {
      let off = (((i - pos.p) % n) + n) % n;
      if (off > n / 2) off -= n;
      return off;
    };

    // Opacity: 1 through the 7-slot window, then a C¹ smoothstep to
    // exactly 0 at |off| = M_FADE_END. Zero slope at both joins — no
    // kink, no threshold pop.
    const fanAlpha = (a: number) => {
      const t = Math.min(
        1,
        Math.max(0, (a - M_FADE_START) / (M_FADE_END - M_FADE_START))
      );
      return 1 - t * t * (3 - 2 * t);
    };

    // ONE pose function feeds both the per-frame writes and the zoom
    // return tween, so the two can never drift. Translations in px
    // (19rem·k and 6rem·k at 16px/rem). `a` rides along for stacking.
    const pose = (i: number) => {
      const k = M_K();
      const off = wrapOff(i);
      const a = Math.abs(off);
      const d = off / HALF;
      return {
        x: d * 19 * 16 * k,
        y: d * d * 6 * 16 * k,
        rotation: d * 24,
        scale: 1 - 0.2244 * d * d,
        opacity: fanAlpha(a),
        a,
      };
    };

    // Per-frame writers: one quickSetter per property per card,
    // created once. z-index (integer, strictly decreasing in |off| at
    // 0.01-card steps) writes only when its value actually changes.
    const setters = cards.map((el) => ({
      x: gsap.quickSetter(el, "x", "px") as (v: number) => void,
      y: gsap.quickSetter(el, "y", "px") as (v: number) => void,
      rot: gsap.quickSetter(el, "rotation", "deg") as (v: number) => void,
      // Never quickSetter(el, "scale"): on an HTML element GSAP aliases
      // "scale" to the comma-joined "scaleX,scaleY", which falls through
      // to setAttribute and throws. One property per setter.
      scaleX: gsap.quickSetter(el, "scaleX") as (v: number) => void,
      scaleY: gsap.quickSetter(el, "scaleY") as (v: number) => void,
      alpha: gsap.quickSetter(el, "opacity") as (v: number) => void,
      lastZ: -1,
      el,
    }));

    const apply = () => {
      for (let i = 0; i < cards.length; i++) {
        const s = setters[i];
        const q = pose(i);
        s.x(q.x);
        s.y(q.y);
        s.rot(q.rotation);
        s.scaleX(q.scale);
        s.scaleY(q.scale);
        s.alpha(q.opacity);
        const z = 1200 - Math.round(q.a * 100);
        if (z !== s.lastZ) {
          s.lastZ = z;
          s.el.style.zIndex = String(z);
        }
      }
    };

    // ── The roll: momentum on P, then a soft settle ───────────────
    let raf = 0;
    let lastT = 0;
    let velocity = 0; // cards per second (EMA-fed)
    let settleTween: gsap.core.Tween | null = null;

    const stopRoll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    // Target comes from Math.round(pos.p) in unbounded P-space, so the
    // move is at most half a card and never unwinds through the fan.
    const settleTo = (idx: number) => {
      settleTween?.kill();
      if (reducedNow) {
        pos.p = idx;
        apply();
        return;
      }
      settleTween = gsap.to(pos, {
        p: idx,
        duration: M_SETTLE_S,
        ease: "power3.out",
        onUpdate: apply,
      });
    };

    const rollTick = (now: number) => {
      raf = requestAnimationFrame(rollTick);
      // 50ms cap: a dropped frame slows time rather than jumping P.
      const dt = Math.min(now - lastT, 50) / 1000;
      lastT = now;
      velocity *= Math.exp(-M_DECAY * dt);
      pos.p += velocity * dt;
      apply();
      if (Math.abs(velocity) < M_STOP_V) {
        stopRoll();
        settleTo(Math.round(pos.p));
      }
    };

    const startRoll = () => {
      stopRoll();
      lastT = performance.now();
      raf = requestAnimationFrame(rollTick);
    };

    // ── Zoom: the tapped plate comes face-on ──────────────────────
    let zoomed: number | null = null;
    let moved = 0;

    const zoomTo = (i: number) => {
      if (zoomed !== null) return;
      stopRoll();
      settleTween?.kill();
      zoomed = i;
      setZoomIdx(i);
      // Fill min(86vw, 380px) wide, capped only so the 4/7 card can
      // never outgrow the VIEWPORT's height — the stage hugs the
      // resting fan and the zoomed card deliberately overflows it
      // vertically (the stage clips x, never y). Transform only —
      // scale, never width.
      const zw = Math.min(
        M_ZOOM_VW * window.innerWidth,
        M_ZOOM_W,
        M_ZOOM_VW * window.innerHeight * (4 / 7)
      );
      const zscale = zw / cards[i].offsetWidth;
      cards[i].style.zIndex = "3000"; // above siblings AND the dismiss layer
      setters[i].lastZ = -1; // direct write above: invalidate the cache
      cards.forEach((el, j) => {
        if (j === i) {
          if (reducedNow) {
            gsap.set(el, { x: 0, y: 0, rotation: 0, scale: zscale });
          } else {
            gsap.to(el, {
              x: 0,
              y: 0,
              rotation: 0,
              scale: zscale,
              duration: M_ZOOM_S,
              ease: "power3.out",
              overwrite: "auto",
            });
          }
          return;
        }
        // Siblings fade and HOLD position — transforms untouched, and
        // a card the fan has already faded out never brightens back.
        const target = Math.min(M_DIM, pose(j).opacity);
        if (reducedNow) gsap.set(el, { opacity: target });
        else {
          gsap.to(el, {
            opacity: target,
            duration: M_ZOOM_S,
            ease: "power3.out",
            overwrite: "auto",
          });
        }
      });
    };

    const dismiss = () => {
      if (zoomed === null) return;
      const i = zoomed;
      const done = () => {
        zoomed = null;
        setZoomIdx(null);
        apply(); // true-up every card and restore z-order
        // A zoom can interrupt a settle mid-flight; never leave the
        // hand parked between indices.
        if (pos.p !== Math.round(pos.p)) settleTo(Math.round(pos.p));
      };
      if (reducedNow) {
        done();
        return;
      }
      cards.forEach((el, j) => {
        const q = pose(j);
        if (j === i) {
          // Back to the LIVE wrapped fan pose, recomputed from P now.
          gsap.to(el, {
            x: q.x,
            y: q.y,
            rotation: q.rotation,
            scale: q.scale,
            opacity: q.opacity,
            duration: M_ZOOM_S,
            ease: "power3.out",
            overwrite: "auto",
            onComplete: done,
          });
          return;
        }
        gsap.to(el, {
          opacity: q.opacity,
          duration: M_ZOOM_S,
          ease: "power3.out",
          overwrite: "auto",
        });
      });
    };

    cardTapRef.current = (i: number) => {
      // A drag is not a tap: the pointer chain below tracks movement,
      // and anything past the classification threshold swallows it.
      if (moved > 8) return;
      if (zoomed === i) {
        dismiss();
        return;
      }
      if (zoomed !== null) return; // the dismiss layer owns these taps
      zoomTo(i);
    };
    dismissRef.current = dismiss;

    // ── Drag: classified with the dumbbell's shared rule ──────────
    let phase: GesturePhase = "idle";
    let startX = 0;
    let startY = 0;
    let startP = 0;
    let pxPerCard = 100;
    let lastX = 0;
    let lastMoveT = 0;
    let fromIdx = 0;

    const onDown = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      moved = 0;
      // While zoomed the fan takes no gestures at all — the tap that
      // dismisses can never double as a swipe.
      if (zoomed !== null) return;
      phase = "pending";
      startX = e.clientX;
      startY = e.clientY;
      lastX = e.clientX;
      lastMoveT = performance.now();
      fromIdx = Math.round(pos.p);
    };

    const onMove = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      if (phase === "pending") {
        moved = Math.max(
          moved,
          Math.abs(e.clientX - startX),
          Math.abs(e.clientY - startY)
        );
        const cls = classifyGesture(e.clientX - startX, e.clientY - startY);
        if (cls === null) return;
        if (cls === "drag") {
          phase = "drag";
          clip.setPointerCapture(e.pointerId);
          stopRoll();
          settleTween?.kill();
          velocity = 0;
          // One card-pitch of drag moves one card: the x-spacing of
          // adjacent cards, (19rem/3)·k.
          pxPerCard = (19 / HALF) * 16 * M_K();
          startX = e.clientX;
          startP = pos.p;
          lastX = e.clientX;
          lastMoveT = performance.now();
        } else {
          // Vertical intent: the browser owns it (touch-action: pan-y).
          phase = "scroll";
        }
        return;
      }
      if (phase !== "drag") return;
      moved = Math.max(moved, Math.abs(e.clientX - startX));
      // Endless: no clamp, no edge resistance — the wrap absorbs it.
      pos.p = startP - (e.clientX - startX) / pxPerCard;
      apply();
      // Release velocity is an EMA of per-move deltas (cards/s).
      const now = performance.now();
      const dtS = Math.max((now - lastMoveT) / 1000, 0.001);
      const instant = -(e.clientX - lastX) / pxPerCard / dtS;
      velocity = M_VEL_ALPHA * instant + (1 - M_VEL_ALPHA) * velocity;
      lastX = e.clientX;
      lastMoveT = now;
    };

    const onUp = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      const wasDrag = phase === "drag";
      phase = "idle";
      if (!wasDrag) return;
      try {
        clip.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }

      if (reducedNow) {
        // No momentum roll: exactly one card, instantly — the
        // gallery's own advance rules decide the direction.
        const offset = pos.p - fromIdx;
        let target = fromIdx;
        const vPx = velocity * pxPerCard;
        if (Math.abs(offset) > ADVANCE_FRACTION) {
          target = fromIdx + Math.sign(offset);
        } else if (Math.abs(vPx) > FLICK_PX_PER_S) {
          target = fromIdx + Math.sign(vPx);
        }
        pos.p = target;
        apply();
        velocity = 0;
        return;
      }

      if (Math.abs(velocity) < M_STOP_V) {
        settleTo(Math.round(pos.p));
      } else {
        startRoll();
      }
    };

    const onResize = () => {
      // While zoomed the fan pose must not overwrite the zoomed card.
      if (zoomed !== null) return;
      apply();
    };

    clip.addEventListener("pointerdown", onDown);
    clip.addEventListener("pointermove", onMove);
    clip.addEventListener("pointerup", onUp);
    clip.addEventListener("pointercancel", onUp);
    window.addEventListener("resize", onResize);

    apply();

    return () => {
      stopRoll();
      settleTween?.kill();
      cardTapRef.current = null;
      dismissRef.current = null;
      setZoomIdx(null);
      clip.removeEventListener("pointerdown", onDown);
      clip.removeEventListener("pointermove", onMove);
      clip.removeEventListener("pointerup", onUp);
      clip.removeEventListener("pointercancel", onUp);
      window.removeEventListener("resize", onResize);
      cards.forEach((el) => gsap.killTweensOf(el));
      gsap.set(cards, { clearProps: "transform,opacity,zIndex" });
    };
  }, [mobileHand]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || reduced) return;

    const outers = Array.from(
      container.querySelectorAll<HTMLElement>(".fan-card-outer")
    );
    const inners = Array.from(
      container.querySelectorAll<HTMLElement>(".fan-card")
    );
    if (!outers.length) return;

    const reducedNow = prefersReducedMotion();

    // ── Geometry: the one writer ─────────────────────────────────────
    const applyPosition = (p: number) => {
      const mult = getResponsiveMultiplier(window.innerWidth);
      const hMult = getHeightMultiplier(window.innerWidth);
      outers.forEach((el, i) => {
        const off = wrapOffset(i, p);
        const a = Math.abs(off);
        if (a > HALF + 1) {
          el.style.opacity = "0";
          el.style.zIndex = "0";
          return;
        }
        const d = off / HALF;
        gsap.set(el, {
          x: `${d * 19 * mult}rem`,
          y: `${d * d * 6 * hMult}rem`,
          rotation: d * 24,
          scale: 1 - 0.2244 * d * d,
          opacity: a <= HALF ? 1 : HALF + 1 - a,
        });
        // Never animated — written instantly with the geometry.
        el.style.zIndex = String(10 - Math.round(a * 3));
      });
      const rounded = mod(Math.round(p), N);
      setCenterIndex((c) => (c === rounded ? c : rounded));
    };

    applyPosition(posRef.current);
    const onResize = () => applyPosition(posRef.current);
    window.addEventListener("resize", onResize);

    // ── The single rAF engine: drag → coast → settle ─────────────────
    type EngineMode = "idle" | "drag" | "coast" | "settle";
    let engine: EngineMode = "idle";
    let raf = 0;
    let lastT = 0;
    let velocity = 0; // cards per second
    let settleFrom = 0;
    let settleTo = 0;
    let settleT = 0;
    let dragging = false;

    const stopEngine = () => {
      engine = "idle";
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(now - lastT, 100) / 1000;
      lastT = now;

      if (engine === "drag") {
        applyPosition(posRef.current);
        return;
      }
      if (engine === "coast") {
        velocity *= Math.exp(-DECAY * dt);
        posRef.current += velocity * dt;
        applyPosition(posRef.current);
        if (Math.abs(velocity) < 0.25) {
          settleFrom = posRef.current;
          settleTo = Math.round(posRef.current);
          settleT = 0;
          engine = "settle";
        }
        return;
      }
      if (engine === "settle") {
        settleT += dt / SETTLE_S;
        const e = easeOutCubic(settleT);
        posRef.current = settleFrom + (settleTo - settleFrom) * e;
        applyPosition(posRef.current);
        if (settleT >= 1) {
          posRef.current = mod(settleTo, N);
          applyPosition(posRef.current);
          stopEngine();
          hoverSuppressed = false;
        }
        return;
      }
      stopEngine();
    };

    const startEngine = (m: EngineMode) => {
      engine = m;
      if (!raf) {
        lastT = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    const settleToIndex = (target: number) => {
      settleFrom = posRef.current;
      settleTo = target;
      settleT = 0;
      startEngine("settle");
    };

    // Arrows ride the same engine: one card per press.
    cycleRef.current = (dir: "left" | "right") => {
      if (dragging) return;
      const base =
        engine === "settle" ? settleTo : Math.round(posRef.current);
      settleToIndex(base + (dir === "right" ? 1 : -1));
    };

    // ── Hover: lift on the inner card, never the geometry ────────────
    let hoverSuppressed = false;
    let hovered: number | null = null;

    const resetInner = (i: number, delay = 0) => {
      gsap.to(inners[i], {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        duration: 0.5,
        delay,
        ease: "power2.out",
        overwrite: "auto",
      });
    };

    const hoverLayout = (h: number | null) => {
      const mult = getResponsiveMultiplier(window.innerWidth);
      const hMult = getHeightMultiplier(window.innerWidth);
      const p = posRef.current;
      inners.forEach((inner, i) => {
        const off = wrapOffset(i, p);
        if (Math.abs(off) > HALF) return;
        if (h === null) {
          resetInner(i, Math.abs(off) * 0.02);
          return;
        }
        const hOff = wrapOffset(h, p);
        const distance = Math.abs(off - hOff);
        if (i === h) {
          gsap.to(inner, {
            y: `${-2.5 * hMult}rem`,
            scale: 1.02,
            duration: 0.5,
            ease: "power2.out",
            overwrite: "auto",
          });
          return;
        }
        // Neighbours ease aside, weaker with distance.
        const push =
          5.5 * (1 - Math.abs(off) / (HALF + 1)) *
          (1 + 0.2 * Math.max(0, 3 - distance));
        const sign = off < hOff ? -1 : 1;
        gsap.to(inner, {
          x: `${sign * push * mult}rem`,
          rotation: sign * (3 / (distance + 1)),
          duration: 0.5,
          delay: distance * 0.02,
          ease: "power2.out",
          overwrite: "auto",
        });
      });
    };

    const enterHandlers = inners.map((inner, i) => {
      const handler = () => {
        if (hoverSuppressed || dragging || engine !== "idle") return;
        if (hovered !== i) {
          hovered = i;
          hoverLayout(i);
        }
      };
      inner.addEventListener("mouseenter", handler);
      return { inner, handler };
    });
    const onContainerLeave = () => {
      if (hovered !== null) {
        hovered = null;
        if (!dragging) hoverLayout(null);
      }
    };
    container.addEventListener("mouseleave", onContainerLeave);

    // ── Drag: pointer-captured, 1:1, momentum, capped coast ──────────
    let startX = 0;
    let startP = 0;
    let moved = 0;
    let pxPerCard = 100;
    let samples: { t: number; x: number }[] = [];

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      dragging = true;
      moved = 0;
      hoverSuppressed = true;
      hovered = null;
      inners.forEach((_, i) => resetInner(i));
      container.classList.add("is-grabbing");
      container.setPointerCapture(e.pointerId);
      // One visual card-spacing of drag moves one card.
      pxPerCard =
        (19 / HALF) * getResponsiveMultiplier(window.innerWidth) * 16;
      startX = e.clientX;
      startP = posRef.current;
      samples = [{ t: performance.now(), x: e.clientX }];
      startEngine("drag");
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      posRef.current = startP - dx / pxPerCard;
      const now = performance.now();
      samples.push({ t: now, x: e.clientX });
      while (samples.length > 2 && now - samples[0].t > 120) samples.shift();
    };

    const endDrag = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      container.classList.remove("is-grabbing");
      try {
        container.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }

      if (reducedNow) {
        // No momentum: map directly, snap to the nearest index.
        posRef.current = mod(Math.round(posRef.current), N);
        applyPosition(posRef.current);
        stopEngine();
        hoverSuppressed = false;
        return;
      }

      // Velocity over the last ~100ms, in cards/second (drag left =
      // position forward), coast capped at MAX_COAST cards of travel.
      const now = performance.now();
      const old = samples.find((s) => now - s.t <= 120) ?? samples[0];
      const dtS = Math.max((now - old.t) / 1000, 0.016);
      velocity = -((e.clientX - old.x) / pxPerCard) / dtS;
      const coastDistance = Math.max(
        -MAX_COAST,
        Math.min(MAX_COAST, velocity / DECAY)
      );
      velocity = coastDistance * DECAY;

      if (Math.abs(velocity) < 0.25) {
        settleToIndex(Math.round(posRef.current));
      } else {
        startEngine("coast");
      }
    };

    const onClickCapture = (e: MouseEvent) => {
      if (moved > 8) {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", endDrag);
    container.addEventListener("pointercancel", endDrag);
    container.addEventListener("click", onClickCapture, true);

    // ── The deal-in: once, when the section arrives ──────────────────
    const hMult0 = getHeightMultiplier(window.innerWidth);
    gsap.set(inners, { opacity: 0, y: `${12 * hMult0}rem`, scale: 0.5 });
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const visible = inners
          .map((inner, i) => ({ inner, a: Math.abs(wrapOffset(i, posRef.current)) }))
          .sort((a, b) => a.a - b.a);
        visible.forEach(({ inner, a }, order) => {
          gsap.to(inner, {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.9,
            ease: "power2.out",
            delay: 0.2 + Math.min(a, HALF + 1) * 0.06 + order * 0.01,
          });
        });
      },
      { rootMargin: "0px 0px -20% 0px" }
    );
    io.observe(container);

    return () => {
      stopEngine();
      io.disconnect();
      window.removeEventListener("resize", onResize);
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", endDrag);
      container.removeEventListener("pointercancel", endDrag);
      container.removeEventListener("click", onClickCapture, true);
      container.removeEventListener("mouseleave", onContainerLeave);
      enterHandlers.forEach(({ inner, handler }) =>
        inner.removeEventListener("mouseenter", handler)
      );
      [...outers, ...inners].forEach((el) => gsap.killTweensOf(el));
      cycleRef.current = () => {};
    };
  }, [reduced]);

  const chevron = (direction: "left" | "right") => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline
        points={direction === "left" ? "15 18 9 12 15 6" : "9 18 15 12 9 6"}
      />
    </svg>
  );

  return (
    <section
      ref={sectionRef}
      id="activities"
      data-theme="ink"
      aria-label="Activities"
      className="relative section-pad bg-ink text-cream"
    >
      <div className="content-wrap">
        <Reveal>
          <p className="label text-orange">Beyond the Iron</p>
        </Reveal>
        <Reveal delay={0.06}>
          <h2 className="type-title mt-6 max-w-[16ch]">
            More than one kind of work.
          </h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="type-body mt-8 max-w-[46ch]">
            Recover. Compete. Play. The floor is only the beginning.
          </p>
        </Reveal>

        {/* The fan: pointer-driven, md and up, motion allowed. */}
        <div className={reduced ? "hidden" : "hidden md:block"}>
          <div className="fan" ref={containerRef}>
            {DISCIPLINES.map((d, i) => (
              <div className="fan-card-outer" key={d.name}>
                <div
                  className={`fan-card${i === centerIndex ? " is-center" : ""}`}
                >
                  <picture className="fan-card-img" aria-hidden="true">
                    <source
                      srcSet={`/images/activities/${d.img}.webp`}
                      type="image/webp"
                    />
                    <img
                      src={`/images/activities/${d.img}.jpg`}
                      alt=""
                      loading="lazy"
                      draggable={false}
                    />
                  </picture>
                  <span className="fan-card-veil" aria-hidden="true" />
                  <span className="fan-name label">{d.name}</span>
                  <span className="fan-rule" aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>

          <div className="fan-nav">
            <button
              type="button"
              className="fan-btn"
              onClick={() => cycle("left")}
              aria-label="Previous discipline"
            >
              {chevron("left")}
            </button>
            <div className="fan-dots" aria-hidden="true">
              {DISCIPLINES.map((_, i) => (
                <span
                  key={i}
                  className={`fan-dot${i === centerIndex ? " is-on" : ""}`}
                />
              ))}
            </div>
            <button
              type="button"
              className="fan-btn"
              onClick={() => cycle("right")}
              aria-label="Next discipline"
            >
              {chevron("right")}
            </button>
          </div>
        </div>

        {mobileHand ? (
          /* Below 768px the grid path is gone from the render — the
             held hand of cards. Enters once with the section's own
             Reveal treatment; the engine above owns the geometry, the
             roll, and the zoom. */
          <Reveal className="mt-14">
            <div className="fan-hand" ref={clipRef}>
              {DISCIPLINES.map((d, i) => (
                <div
                  className="fan-hand-card"
                  key={d.name}
                  onClick={() => cardTapRef.current?.(i)}
                >
                  <StaticPlate d={d} />
                </div>
              ))}
              {zoomIdx !== null && (
                /* Full-area dismiss layer: above the fan (z 20), below
                   the zoomed card (z 30). Gestures are dead while a
                   card is zoomed, so this tap can never be a swipe. */
                <button
                  type="button"
                  aria-label="Close"
                  className="fan-hand-dismiss"
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissRef.current?.();
                  }}
                />
              )}
            </div>
          </Reveal>
        ) : (
          /* Desktop under reduced motion (and no-JS / pre-hydration
             mobile): the plates rest in a plain grid — quiet opacity
             reveals, no fan, no choreography. */
          <div className={reduced ? "block" : "md:hidden"}>
            <div className="mt-16 grid grid-cols-2 gap-3 sm:gap-4">
              {DISCIPLINES.map((d, i) => (
                <Reveal key={d.name} delay={i * 0.05}>
                  <StaticPlate d={d} />
                </Reveal>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
