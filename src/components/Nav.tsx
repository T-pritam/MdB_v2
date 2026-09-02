"use client";

import { useRef, useState } from "react";
import { ScrollTrigger, useGSAP } from "@/lib/gsap";
import { scrollToId } from "@/lib/scroll";
import Wordmark from "./Wordmark";

/**
 * Quiet fixed chrome: the drawn wordmark alone.
 * Text color follows the surface actually under the bar: a hit test against
 * the nearest [data-theme] ancestor, re-run once per scrolled frame. Absolute
 * scroll positions are never trusted; the Five Floors pin spacer makes them
 * lie. The whole bar steps aside during the ascent (body.floors-active,
 * toggled by the pin's own trigger).
 */
export default function Nav() {
  const ref = useRef<HTMLElement>(null);
  const [theme, setTheme] = useState<"ink" | "cream">("ink");

  useGSAP(
    () => {
      const header = ref.current;
      if (!header) return;

      let queued = false;
      const update = () => {
        queued = false;
        // The header covers this point, so take the full stack and use the
        // first element that is not the header itself.
        const stack = document.elementsFromPoint(window.innerWidth / 2, 40);
        const under = stack.find((n) => !header.contains(n));
        const themed = under?.closest("[data-theme]");
        if (themed) {
          setTheme(themed.getAttribute("data-theme") === "cream" ? "cream" : "ink");
        }
      };
      const queue = () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(update);
      };

      update();
      // One full-range trigger: fires on every scroll frame, works with or
      // without Lenis, and carries no section-position assumptions.
      const st = ScrollTrigger.create({ start: 0, end: "max", onUpdate: queue });
      window.addEventListener("resize", queue);
      return () => {
        st.kill();
        window.removeEventListener("resize", queue);
      };
    },
    { scope: ref }
  );

  const onDark = theme === "ink";

  return (
    <header
      ref={ref}
      className={`site-nav fixed inset-x-0 top-0 z-40 transition-colors duration-500 ${
        onDark ? "bg-ink text-cream" : "bg-cream text-ink"
      }`}
    >
      <div className="content-wrap flex h-16 items-center justify-between">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            scrollToId("top");
          }}
          aria-label="Maison de Build, back to the threshold"
          className="block w-[132px] transition-opacity duration-300 hover:opacity-70 md:w-[156px]"
        >
          <Wordmark className="h-auto w-full" decorative />
        </a>
      </div>
    </header>
  );
}
