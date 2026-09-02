"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";
import { getLenis } from "@/lib/scroll";

/**
 * A small ring that trails the pointer with weight. Ink on cream, cream on
 * ink; it grows quietly over interactive elements.
 *
 * The theme comes from a real hit test (elementFromPoint) against the nearest
 * [data-theme] ancestor, re-checked on pointer movement AND on every scroll
 * frame: scrolling slides section boundaries under a stationary cursor, so a
 * scroll-position guess would lag the visual boundary.
 */
export default function CustomCursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: fine)").matches || prefersReducedMotion()) return;

    const root = document.documentElement;
    root.classList.add("custom-cursor-active");

    gsap.set(el, { xPercent: -50, yPercent: -50 });
    // Damped follow (~0.15 lerp feel): the ring arrives, it doesn't dart.
    const xTo = gsap.quickTo(el, "x", { duration: 0.45, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.45, ease: "power3.out" });

    let px = -1;
    let py = -1;
    let shown = false;

    // The single source of truth: what is actually under the pointer.
    // The ring and grain are pointer-events: none, so they never occlude.
    const updateFromPoint = () => {
      if (px < 0 || py < 0) return;
      const target = document.elementFromPoint(px, py);
      if (!target) return;
      const themed = target.closest("[data-theme]");
      el.classList.toggle(
        "cursor-on-cream",
        themed?.getAttribute("data-theme") === "cream"
      );
      // Form fields keep the native I-beam, so the ring stays quiet there.
      const interactive = target.closest("a, button, [role='button'], canvas");
      el.classList.toggle("cursor-hovering", !!interactive);
    };

    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      if (!shown) {
        shown = true;
        gsap.set(el, { x: px, y: py });
        el.style.opacity = "1";
      }
      xTo(px);
      yTo(py);
      updateFromPoint();
    };

    const onLeave = () => {
      shown = false;
      px = py = -1;
      el.style.opacity = "0";
    };

    // Re-check while scrolling: Lenis is the sanctioned scroll pipe. One
    // rAF-coalesced hit test per scrolled frame.
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        updateFromPoint();
      });
    };
    const lenis = getLenis();
    lenis?.on("scroll", onScroll);

    document.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      lenis?.off("scroll", onScroll);
      root.classList.remove("custom-cursor-active");
    };
  }, []);

  return <div ref={ref} className="custom-cursor" aria-hidden="true" />;
}
