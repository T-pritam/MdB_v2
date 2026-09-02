"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { setLenis } from "@/lib/scroll";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";

export default function SmoothScroll() {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    // A reload must start from the top: the browser would otherwise restore
    // scroll into a layout whose pins have not been measured yet, and every
    // trigger below the stale point lands wrong.
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    const lenis = new Lenis({ lerp: 0.1 });
    setLenis(lenis);

    lenis.on("scroll", ScrollTrigger.update);

    const tick = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      setLenis(null);
    };
  }, []);

  return null;
}
