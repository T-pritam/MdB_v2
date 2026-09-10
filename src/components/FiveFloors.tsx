"use client";

import { useEffect, useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";
import { getGyro, onGyro } from "@/lib/gyro";
import { makeCounterRoll } from "@/lib/counterRoll";

/**
 * §3 THE HOUSE — the signature ascent. Four floors plus ground: each
 * level is a full-viewport moment; the transition is a disciplined
 * vertical elevator glide (the camera rises, so the outgoing floor exits
 * through the bottom and the next arrives from above). Backgrounds
 * alternate Ink/Cream. Transforms and opacity only.
 *
 * Without JavaScript, or under prefers-reduced-motion, the floors simply
 * stack: the copy carries the structure on its own.
 */

/* Floor mapping per the client's finalised Membership + Access Guide.
   Body copy is verbatim from that document. */
const FLOORS = [
  {
    number: "G",
    name: "FIFTH ELEMENT CAFÉ + IV LOUNGE",
    body: "Nourishment, recovery and rituals designed for the way you live.",
  },
  {
    number: "01",
    name: "PERFORMANCE & COMBAT",
    body: "A floor for performance, combat and everything that demands more from the body.",
  },
  {
    number: "02",
    name: "CARDIO & RECOVERY",
    body: "A floor for cardio, recovery and everything that restores what movement demands.",
  },
  {
    number: "03",
    name: "STRENGTH",
    body: "A floor for strength, conditioning and everything that builds lasting capacity.",
  },
  {
    number: "04",
    name: "YOGA, PILATES & GAMING",
    body: "A floor for mobility, balance, focus and everything that brings the body and mind into alignment.",
  },
];

/** Scroll distance per floor transition, in viewport heights. */
const STEP_VH = 1.1;

export default function FiveFloors() {
  const ref = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);

  // Mobile only: the pinned floor number takes a gyroscope parallax —
  // DISPLACEMENT, a direct bounded function of tilt (never accumulated
  // velocity, which would walk a positioned element off-screen). The
  // range is ±30px / ±20px: the number renders ~80vw wide (312px at
  // 390), leaving ~39px gutters at 390 and ~32px at a 320 floor, so
  // ±30px never clips the edge; vertically the name sits 2rem (32px)
  // below, so ±20px never collides with it. The gyro store is silent
  // under prefers-reduced-motion, on denial, and where the API is
  // missing, so this writes nothing in those cases. The numbers carry
  // no GSAP transform (the tweens ride .floor-inner), so the write
  // cannot fight the timeline.
  useEffect(() => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const nums = ref.current?.querySelectorAll<HTMLElement>(".floor-num");
    if (!nums?.length) return;
    return onGyro(() => {
      const g = getGyro();
      const t = `translate3d(${(g.y * 30).toFixed(1)}px, ${(g.x * 20).toFixed(
        1
      )}px, 0)`;
      nums.forEach((n) => {
        n.style.transform = t;
      });
    });
  }, []);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      // The overture: the headline arrives first, the subhead follows on
      // a short stagger — a restrained rise-and-fade with a slight scale
      // settle. Fires once on entry, fully resolved before the pin below
      // takes the viewport; its trigger is the landing block, never the
      // pinned shell, so the two can't fight.
      const intro = gsap.timeline({
        defaults: { ease: "power2.out" },
        scrollTrigger: {
          trigger: ".floors-intro",
          start: "top 80%",
          once: true,
        },
      });
      intro.from(".floors-headline", {
        opacity: 0,
        y: 24,
        scale: 0.98,
        transformOrigin: "50% 100%",
        duration: 0.9,
      });
      intro.from(
        ".floors-sub",
        { opacity: 0, y: 16, duration: 0.7 },
        0.12
      );

      const pin = pinRef.current;
      if (!pin) return;

      // Switch from stacked flow to the live, layered elevator. This runs
      // before paint, so the static fallback never flashes.
      pin.classList.add("floors-live");

      const panels = gsap.utils.toArray<HTMLElement>(".floor-panel", pin);
      const inners = gsap.utils.toArray<HTMLElement>(".floor-inner", pin);
      const ticks = gsap.utils.toArray<HTMLElement>(".floor-tick", pin);
      const numbers = gsap.utils.toArray<HTMLElement>(".floor-num", pin);

      const INK = "#000000";
      const CREAM = "#eae0d2";
      const floorColor = (i: number) => (i % 2 === 0 ? INK : CREAM);

      // Floors above the first wait out of frame, below the viewport: you
      // rise to meet them. The pin container carries the background so the
      // color shifts during the move instead of snapping (panels are
      // transparent in live mode; see globals.css).
      panels.forEach((p, i) => {
        if (i > 0) gsap.set(p, { yPercent: 100 });
      });
      gsap.set(pin, { backgroundColor: floorColor(0) });
      gsap.set(ticks[0], { opacity: 1, scaleX: 2 });

      const tl = gsap.timeline({
        defaults: { ease: "power2.inOut" },
        scrollTrigger: {
          trigger: pin,
          start: "top top",
          end: () => `+=${window.innerHeight * (FLOORS.length - 1) * STEP_VH}`,
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          // First pin in document order refreshes first; the other two
          // (Gallery, Story) follow at 2 and 1.
          refreshPriority: 3,
          // The ascent owns the viewport: the fixed chrome steps aside while
          // this trigger is live (see .site-nav rules in globals.css).
          onToggle: (self) =>
            document.body.classList.toggle("floors-active", self.isActive),
          onRefresh: (self) => {
            if (process.env.NODE_ENV === "development") {
              console.log("[MdB pin] five-floors", {
                start: Math.round(self.start),
                end: Math.round(self.end),
                travel: Math.round(self.end - self.start),
                spacerHeight:
                  (self.pin as HTMLElement | undefined)?.parentElement
                    ?.offsetHeight ?? null,
              });
            }
          },
          snap: {
            snapTo: "labelsDirectional",
            duration: { min: 0.2, max: 0.6 },
            ease: "power2.out",
          },
          invalidateOnRefresh: true,
        },
      });

      tl.addLabel("floor-0");
      FLOORS.forEach((_, i) => {
        if (i === 0) return;
        const at = `step-${i}`;
        tl.addLabel(at, "+=0.35");
        // The ascent: the outgoing floor moves up and out while the next
        // arrives from below, both scrubbed together.
        tl.to(panels[i - 1], { yPercent: -100, duration: 1 }, at);
        tl.fromTo(inners[i - 1], { yPercent: 0 }, { yPercent: 10, duration: 1 }, at);
        tl.fromTo(panels[i], { yPercent: 100 }, { yPercent: 0, duration: 1 }, at);
        tl.fromTo(inners[i], { yPercent: 10 }, { yPercent: 0, duration: 1 }, at);
        // Text never rides the blend: the outgoing copy clears BEFORE the
        // color moves, the incoming copy appears only AFTER it has settled.
        tl.to(inners[i - 1], { opacity: 0, duration: 0.3 }, at);
        tl.fromTo(inners[i], { opacity: 0 }, { opacity: 1, duration: 0.3 }, `${at}+=0.65`);
        // The Ink↔Cream tween is compressed into the middle 30% of the move;
        // at rest the house is exactly #000000 or #EAE0D2, never a mid-grey.
        tl.to(pin, { backgroundColor: floorColor(i), duration: 0.3 }, `${at}+=0.35`);
        // The counter rolls to the new floor, settling ahead of the name.
        // The roll is still numeric index-space, i-1 → i (unchanged from
        // the 00-indexed fix); only the FORMATTING changed for the G→01
        // transition: index 0 renders "G", everything else pads to two
        // digits. Because the scrub plays this same tween forward and
        // backward, G→01 and 01→G both pass through the identical
        // rounded values (0 ⇄ 1) and both directions render correctly.
        const fmtFloor = (n: number) =>
          n === 0 ? "G" : String(n).padStart(2, "0");
        // Mechanic extracted to src/lib/counterRoll.ts (Layer 2) so the
        // mobile gallery counter rolls the same way. Same proxy, same
        // vars (v: i, duration 0.6, snap {v:1}, formatted onUpdate),
        // same timeline position — the built timeline is unchanged.
        const { target: roll, vars: rollVars } = makeCounterRoll(
          i - 1,
          i,
          numbers[i],
          fmtFloor
        );
        tl.to(roll, rollVars, at);
        // The rail marks the passing floor.
        tl.to(ticks[i - 1], { opacity: 0.35, scaleX: 1, duration: 0.4 }, at);
        tl.to(ticks[i], { opacity: 1, scaleX: 2, duration: 0.4 }, `${at}+=0.5`);
        tl.addLabel(`floor-${i}`, "+=0.05");
      });
    },
    { scope: ref }
  );

  return (
    <section
      ref={ref}
      data-theme="ink"
      aria-label="The house, floor by floor"
      className="relative isolate bg-ink"
    >
      {/* The landing before the ascent — collapsed to roughly a heading's
          worth of height so FLOOR G arrives within ~200px of scroll. */}
      <div className="floors-intro flex items-end bg-ink px-6 pb-10 pt-[clamp(64px,8vh,96px)] text-cream">
        <div className="content-wrap w-full text-center">
          {/* The section overture, centred. Sized so the measured line
              (14.23em at −0.025em tracking) fits the content column on
              one line from 640px up; below 640px the sentence spans go
              block, so the only break is between the two sentences —
              never mid-phrase. */}
          <h2 className="floors-headline font-normal leading-[1.05] tracking-[-0.025em] text-[clamp(2rem,4.5vw,4.25rem)]">
            <span className="block sm:inline">Four Floors.</span>{" "}
            <span className="block sm:inline">Five distinct experiences.</span>
          </h2>
          <p className="floors-sub type-body mx-auto mt-5 max-w-[38ch]">
            One address. Zero compromise
          </p>
        </div>
      </div>

      {/* The ascent */}
      <div ref={pinRef} id="floors-pin" className="floors-shell relative">
        {FLOORS.map((floor, i) => {
          const dark = i % 2 === 0;
          return (
            <article
              key={floor.number}
              data-theme={dark ? "ink" : "cream"}
              className={`floor-panel relative flex min-h-[100dvh] items-center overflow-hidden ${
                dark ? "bg-ink text-cream" : "bg-cream text-ink"
              }`}
            >
              <div className="floor-inner content-wrap w-full">
                <div>
                  <p className={`label ${dark ? "text-cream" : "text-stone"}`}>
                    {floor.number === "G"
                      ? "Ground floor"
                      : `Floor ${floor.number}`}
                  </p>
                  {/* Deterministic stack: kicker, number, name and body are
                      separate block elements sharing one left edge, with
                      fixed gaps — every floor lays out identically no matter
                      how long the name runs. The counter keeps its 2ch cell
                      (left-aligned) so G occupies the same footprint as
                      01–04 and nothing below ever shifts. */}
                  <p
                    className="floor-num data mt-6 select-none text-left leading-[0.8]"
                    style={{
                      fontSize: "clamp(6rem, 24vh, 13.5rem)",
                      width: "2ch",
                    }}
                    aria-hidden="true"
                  >
                    {floor.number}
                  </p>
                  <h3 className="type-display mt-4">{floor.name}</h3>
                  <p
                    className={`type-subhead mt-8 max-w-[40ch] ${
                      dark ? "text-cream" : "text-ink"
                    }`}
                  >
                    {floor.body}
                  </p>
                </div>
              </div>
            </article>
          );
        })}

        {/* Elevator rail: a thin vertical rule with five marks; the lit one
            is where you are */}
        <div
          className="floors-rail pointer-events-none absolute right-5 top-1/2 hidden -translate-y-1/2 flex-col items-end gap-4 md:flex"
          aria-hidden="true"
        >
          <span className="absolute -right-2 top-[-8px] block h-[calc(100%+16px)] w-px bg-stone/40" />
          {FLOORS.map((floor, i) => (
            <span
              key={floor.number}
              className="floor-tick block h-px w-5 origin-right bg-orange"
              style={{ opacity: i === 0 ? 1 : 0.35 }}
            />
          ))}
        </div>
      </div>

    </section>
  );
}
