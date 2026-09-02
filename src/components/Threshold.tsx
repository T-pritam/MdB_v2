"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";
import { getLenis } from "@/lib/scroll";
import Wordmark from "./Wordmark";

const Scene3D = dynamic(() => import("./Scene3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <div className="arc-fallback spinning" />
    </div>
  ),
});

/**
 * §1 THRESHOLD — the door. Ink black. The sculptural dumbbell, lit from one
 * source, above the drawn wordmark. One thin orange punctuation rule.
 *
 * THE OPENING: one continuous wordmark. The same SVG element starts
 * centred in the viewport at 1.45× its hero size, reveals itself with
 * the house clip-path wipe (the artwork is a single filled path — there
 * is no strokeable outline, so no stroke is faked), then travels into
 * its measured hero position and settles to 1×. The rest of the hero
 * rises around it, the canvas fades in last, and the wordmark's inline
 * styles are cleared at the end so the resting hero is pixel-identical
 * to the approved state. Scroll is locked for the ride; any scroll
 * intent — or a 3s cap for slow loads — jumps straight to the end
 * state. Runs once per load; mobile runs the same sequence at ~1.4s;
 * prefers-reduced-motion skips it entirely.
 */
export default function Threshold() {
  const ref = useRef<HTMLElement>(null);
  const wordmarkRef = useRef<HTMLHeadingElement>(null);
  const sceneOuterRef = useRef<HTMLDivElement>(null);
  const sceneDriftRef = useRef<HTMLDivElement>(null);
  const [mountScene, setMountScene] = useState(false);
  const [introDone, setIntroDone] = useState(false);

  // Under reduced motion there is no intro: the canvas gate opens
  // immediately and the hero renders in its final state.
  useEffect(() => {
    if (prefersReducedMotion()) setIntroDone(true);
  }, []);

  // WebGL mounts on every width once the section is in view. Scene3D itself
  // branches on matchMedia('(max-width: 767px)') for the mobile input model;
  // this is the only live 3D object on the mobile page.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMountScene(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      // As the door scrolls away the object drifts up and dims.
      gsap.to(sceneDriftRef.current, {
        y: -60,
        opacity: 0,
        ease: "power1.inOut",
        scrollTrigger: {
          trigger: ref.current,
          start: "top top",
          end: "70% top",
          scrub: true,
        },
      });

      const wordmark = wordmarkRef.current;
      if (!wordmark) return;
      const header = document.querySelector<HTMLElement>(".site-nav");

      // Mobile visitors reach content faster: same sequence at ~1.4s.
      const k = window.innerWidth < 768 ? 1.4 / 2.2 : 1;

      // The intro state is computed from the hero element's REAL measured
      // resting position — never hardcoded offsets. SVG geometry, so the
      // measurement does not depend on font loading.
      const rect = wordmark.getBoundingClientRect();
      const dx = window.innerWidth / 2 - (rect.left + rect.width / 2);
      const dy = window.innerHeight / 2 - (rect.top + rect.height / 2);

      // Scroll locked for the ride; released on completion or skip.
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      getLenis()?.stop();

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        document.body.style.overflow = prevOverflow;
        getLenis()?.start();
        // The resting hero must be pixel-identical to the approved state:
        // the one animated element sheds every inline style it carried.
        gsap.set(wordmark, { clearProps: "transform,clipPath" });
        removeSkip();
        cap.kill();
      };

      gsap.set(wordmark, {
        x: dx,
        y: dy,
        scale: 1.45,
        transformOrigin: "50% 50%",
        clipPath: "inset(0 100% 0 0)",
      });

      const tl = gsap.timeline({
        defaults: { ease: "power2.out" },
        onComplete: finish,
      });

      // 2 — the reveal, centred: the brand wipe on the one element.
      tl.to(
        wordmark,
        { clipPath: "inset(0 0% 0 0)", duration: 1.1 * k },
        0.15 * k
      );
      // 3 — the same element travels into the hero position.
      tl.addLabel("travel", (0.15 + 1.1) * k);
      tl.to(wordmark, { x: 0, y: 0, scale: 1, duration: 0.9 * k }, "travel");
      // The canvas may begin mounting while its container is still unseen.
      tl.call(() => setIntroDone(true), undefined, "travel");
      // 4 — the hero resolves around it as it settles.
      tl.addLabel("reveal", `travel+=${0.25 * k}`);
      tl.from(
        ".threshold-rise",
        { autoAlpha: 0, y: 16, duration: 0.7 * k, stagger: 0.09 * k },
        "reveal"
      );
      tl.from(".threshold-rule", { scaleX: 0, duration: 0.7 * k }, "reveal");
      if (header) {
        tl.from(header, { autoAlpha: 0, y: 16, duration: 0.7 * k }, "reveal");
      }
      // 5 — the object arrives last.
      tl.from(
        sceneOuterRef.current,
        { autoAlpha: 0, duration: 0.9 * k },
        `reveal+=${0.2 * k}`
      );

      // Never trap the visitor: any scroll intent skips to the end state.
      const skip = () => {
        if (tl.progress() < 1) tl.progress(1);
      };
      const keySkip = (e: KeyboardEvent) => {
        if (
          ["ArrowDown", "ArrowUp", "PageDown", "PageUp", " ", "End", "Home"].includes(
            e.key
          )
        ) {
          skip();
        }
      };
      window.addEventListener("wheel", skip, { passive: true });
      window.addEventListener("touchmove", skip, { passive: true });
      window.addEventListener("keydown", keySkip);
      const removeSkip = () => {
        window.removeEventListener("wheel", skip);
        window.removeEventListener("touchmove", skip);
        window.removeEventListener("keydown", keySkip);
      };

      // Slow GLB or fonts must never strand anyone on blank Ink.
      const cap = gsap.delayedCall(3, skip);

      return () => {
        finish();
        tl.kill();
      };
    },
    { scope: ref }
  );

  return (
    <section
      id="top"
      ref={ref}
      data-theme="ink"
      aria-label="Maison de Build"
      className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-ink px-6 pb-16 pt-24 text-center text-cream"
    >
      <div
        ref={sceneOuterRef}
        className="relative h-[40vh] max-h-[420px] w-[min(80vw,560px)] max-md:mb-2 max-md:h-[30vh] md:mb-8"
        aria-hidden="true"
      >
        <div ref={sceneDriftRef} className="absolute inset-0">
          {mountScene && introDone && <Scene3D />}
        </div>
      </div>

      <h1
        ref={wordmarkRef}
        className="threshold-wordmark w-[min(86vw,640px)]"
      >
        <Wordmark className="h-auto w-full" />
      </h1>

      <p className="threshold-rise label mt-9 text-cream">
        ICONIC BUILD · ICONIC STRENGTH
      </p>

      <p className="threshold-rise type-subhead mt-6">A house, not a gym.</p>

      {/* The surviving manifesto line, folded in from the deleted section. */}
      <p className="threshold-rise type-body mt-6 max-w-[34ch] text-cream">
        We are the place you defend who you have already become.
      </p>

      <div
        className="threshold-rule mt-8 h-px w-10 origin-center bg-orange"
        aria-hidden="true"
      />

      <p className="threshold-rise data mt-8 text-sm text-cream">
        B Block, Kavuri Hills, Hyderabad
      </p>
      <p className="threshold-rise data mt-2 text-sm text-cream">EST. de 2026</p>
    </section>
  );
}
