"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";
import Crest from "./Crest";

/**
 * §8 THE FOUNDER / CLOSE — Cream. The crest settles like a stamp, the
 * founder's words arrive line by line. No photograph; presence is the
 * signature.
 */
export default function FounderClose() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      // The stamp settles: slightly large and faint, then seated.
      gsap.from(".founder-crest", {
        opacity: 0,
        scale: 1.08,
        duration: 1.4,
        ease: "power2.out",
        scrollTrigger: { trigger: ref.current, start: "top 65%", once: true },
      });

      gsap.from(".founder-rise", {
        opacity: 0,
        y: 16,
        duration: 0.7,
        ease: "power2.out",
        stagger: 0.08,
        scrollTrigger: { trigger: ref.current, start: "top 85%", once: true },
      });
    },
    { scope: ref }
  );

  return (
    <section
      ref={ref}
      data-theme="cream"
      aria-label="The founder"
      className="relative section-pad bg-cream text-ink"
    >
      <div className="content-wrap w-full">
        <div className="founder-crest w-[min(46vw,190px)] text-ink" aria-hidden="true">
          <Crest className="h-auto w-full" />
        </div>

        {/* Written in brand voice — Rushil to approve or replace.
            Cut to ~50 words for the conversion spine; the capped-house and
            reserved-bay facts it carried live in Membership already. */}
        <blockquote className="mt-16">
          <p className="founder-rise type-subhead max-w-[30ch]">
            Fifteen years of coaching taught me that longevity is built through
            repetition. You return. You pay attention. You keep going.
          </p>
          <p className="founder-rise type-body mt-8 max-w-[46ch]">
            Maison de Build is built around that simple idea.
          </p>
          <p className="founder-rise type-body mt-6 max-w-[46ch]">
            A place to train well, recover well and maintain what matters.
          </p>
          <p className="founder-rise type-body mt-6 max-w-[46ch]">
            If you are someone who returns, you already understand what this
            house is for.
          </p>
          <footer className="founder-rise mt-10">
            <p className="text-base text-stone">— Rushil, Founder</p>
          </footer>
        </blockquote>

        <p className="founder-rise label mt-20 text-stone">
          MOVE | RESET | RETURN
        </p>
        <p className="founder-rise data mt-4 text-sm text-stone">EST. de 2026</p>
      </div>
    </section>
  );
}
