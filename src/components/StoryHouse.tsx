"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";

/**
 * THE STORY — Ink. Three beats of one idea, scrubbed to scroll.
 * Text alternates sides; one shared media frame repositions between the
 * halves, carrying the teammate's footage (placeholder until facility
 * film exists). Beat 3 carries no visual at all — the frame fades out and
 * the copy centres, so the "nothing asks for you" beat performs nothing.
 *
 * The frame mechanic is ported from the reference build's Story: slot
 * interpolation per beat, media crossfade by proximity, and only the
 * active beat's video ever plays. Hardened per the ship spec:
 *  - scale clamped to [0.9, 1.16], translateX to ±25vw, non-finite
 *    values fall back instead of writing through;
 *  - videos mount only once the section is within one viewport;
 *  - play() is never called before readyState 2 — the poster holds.
 *
 * Without JavaScript, on mobile, or under prefers-reduced-motion, the
 * beats stack as static blocks with poster images only — no <video>.
 *
 * Copy is verbatim from the approved blend spec.
 */

/* Three beats, every one carrying a transition video (the point of the
   section), each with a single short body line. WHAT SIMPLE COSTS stays
   cut. Copy is draft, not client-approved. */
const BEATS = [
  {
    kicker: "THE PRACTISE",
    video: "beat1",
    headline: "There is one way this house works.",
    body: [
      "You arrive. Your place is known. Your practice continues. Every detail is considered, every session remembered.",
    ],
  },
  {
    kicker: "NOTHING ASKS FOR YOU",
    video: "beat2",
    headline: "Look around. Nothing here is trying to get your attention.",
    body: [
      "Considered spaces, uninterrupted focus and room to do what brought you here.",
    ],
  },
  {
    kicker: "THE GUEST IS KNOWN",
    video: "beat4",
    headline: "You are not checked in. You are recognised.",
    body: [
      "Your coach knows your history, your progress and what your practice requires next.",
    ],
  },
];

const MEDIA = BEATS.map((b, i) => ({ i, id: b.video })).filter(
  (m): m is { i: number; id: string } => m.id !== null
);

/** Scroll distance per beat transition, in viewport heights. The pin's
 *  total length derives from this times BEATS.length - 1. */
const STEP_VH = 4 / 3;
/** The frame's resting offset from center, in vw. Beat 0 sits right. */
const PANEL_X = 22;
/** Transit swell — the frame breathes to 1.16 mid-crossing, per spec. */
const SWELL = 0.16;

/* Hard safety envelope: writes outside these never reach the DOM. */
const SCALE_MIN = 0.9;
const SCALE_MAX = 1.16;
const TX_MAX = 25; // vw

/** Where the frame rests for each beat — derived from BEATS so a beat cut
 *  can never desynchronise it (it was a hardcoded four-entry array before
 *  the four-to-two cut). A beat with no video is the deliberate void: the
 *  frame fades to nothing and the copy holds the room alone. Otherwise
 *  the frame sits opposite the text, which alternates by index. */
const SLOTS = BEATS.map((b, i) =>
  b.video === null
    ? { tx: 0, op: 0 }
    : { tx: i % 2 === 0 ? PANEL_X : -PANEL_X, op: 1 }
);

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

export default function StoryHouse() {
  const ref = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const applyRef = useRef<(() => void) | null>(null);
  const [near, setNear] = useState(false);
  // Mobile renders full-bleed per-beat videos instead of the shared frame.
  // Set client-side only, so SSR markup and the desktop DOM are unchanged.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setIsMobile(true);
  }, []);

  // Videos exist in the DOM only with motion allowed, and only once the
  // section is within one viewport of entering — before that the frame
  // (desktop) or beat backgrounds (mobile) show posters, and everything
  // above the section stays interactive while nothing heavy is downloading.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "100% 0px 100% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // After the videos mount, one apply pass wires their load/play gating
  // to the current scroll position without waiting for the next scroll.
  useEffect(() => {
    if (!near) return;
    const id = requestAnimationFrame(() => applyRef.current?.());
    return () => cancelAnimationFrame(id);
  }, [near]);

  // One refresh once fonts settle — text heights shift the pin measurements.
  useEffect(() => {
    let cancelled = false;
    Promise.all([document.fonts.ready]).then(() => {
      if (cancelled) return;
      ScrollTrigger.refresh();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useGSAP(
    () => {
      const reduced = prefersReducedMotion();
      const mobile = window.innerWidth < 768;

      // Reduced motion: stacked static blocks, poster images only — all
      // widths, untouched.
      if (reduced) return;

      // Mobile: the same pinned beat sequence as desktop — identical step
      // length, labels, fade timings and snap — but each beat's video is a
      // full-bleed background (see .story-live-m in globals.css) instead of
      // the shared repositioning frame, and videos PLAY while their beat is
      // active rather than scrubbing (currentTime scrubbing is unreliable
      // on iOS Safari).
      if (mobile) {
        const pin = pinRef.current;
        if (!pin) return;

        pin.classList.add("story-live", "story-live-m");

        const beats = gsap.utils.toArray<HTMLElement>(".story-beat", pin);
        const SEG = BEATS.length - 1;

        beats.forEach((b, i) => {
          if (i > 0) gsap.set(b, { opacity: 0 });
        });

        const beatVideo = (i: number) =>
          beats[i]?.querySelector<HTMLVideoElement>(".story-mvid video") ??
          null;
        const pauseAll = () => {
          beats.forEach((_, i) => {
            const v = beatVideo(i);
            if (v && !v.paused) v.pause();
          });
        };

        let applyLive: (progress: number) => void = () => {};
        let snapPoints: number[] = [];

        const tl = gsap.timeline({
          defaults: { ease: "power2.out" },
          scrollTrigger: {
            trigger: pin,
            start: "top top",
            end: () => `+=${window.innerHeight * SEG * STEP_VH}`,
            pin: true,
            scrub: 1,
            snap: {
              snapTo: (value: number) => {
                if (!snapPoints.length) return value;
                let best = snapPoints[0];
                for (const s of snapPoints) {
                  if (Math.abs(s - value) < Math.abs(best - value)) best = s;
                }
                return best;
              },
              duration: { min: 0.2, max: 0.6 },
              ease: "power2.out",
            },
            invalidateOnRefresh: true,
            anticipatePin: 1,
            refreshPriority: 1,
            onUpdate: (self) => applyLive(self.progress),
            onRefresh: (self) => {
              applyLive(self.progress);
              if (process.env.NODE_ENV === "development") {
                console.log("[MdB pin] story", {
                  start: Math.round(self.start),
                  end: Math.round(self.end),
                  travel: Math.round(self.end - self.start),
                  spacerHeight:
                    (self.pin as HTMLElement | undefined)?.parentElement
                      ?.offsetHeight ?? null,
                });
              }
            },
            onLeave: pauseAll,
            onLeaveBack: pauseAll,
          },
        });

        tl.addLabel("beat-0");
        BEATS.forEach((_, i) => {
          if (i === 0) return;
          const at = `step-${i}`;
          tl.addLabel(at, "+=0.35");
          tl.to(beats[i - 1], { opacity: 0, duration: 0.25 }, at);
          tl.to({}, { duration: 1 }, at);
          tl.fromTo(
            beats[i],
            { opacity: 0, y: 16 },
            { opacity: 1, y: 0, duration: 0.3 },
            `${at}+=0.72`
          );
          tl.addLabel(`beat-${i}`, "+=0.05");
        });

        const duration = tl.duration();
        const beatPos = BEATS.map((_, i) =>
          Math.min(1, tl.labels[`beat-${i}`] / duration)
        );
        snapPoints = beatPos;

        // Same progress → beat-space mapping as desktop; on mobile the only
        // per-frame writes are video play/pause by beat proximity.
        const apply = (progress: number) => {
          const p = Number.isFinite(progress) ? clamp01(progress) : 0;
          let f = SEG;
          if (p <= beatPos[0]) f = 0;
          else {
            for (let i = 0; i < SEG; i++) {
              if (p <= beatPos[i + 1]) {
                f = i + (p - beatPos[i]) / (beatPos[i + 1] - beatPos[i]);
                break;
              }
            }
          }
          if (!Number.isFinite(f)) f = 0;

          beats.forEach((_, bi) => {
            const v = beatVideo(bi);
            if (!v) return;
            const ad = Math.abs(f - bi);
            if (ad < 0.5) {
              if (v.readyState >= 2) {
                if (v.paused) v.play().catch(() => {});
              } else if (!v.dataset.fetching) {
                v.dataset.fetching = "1";
                v.load();
              }
            } else if (!v.paused) {
              v.pause();
            }
          });
        };

        applyLive = apply;
        const st = tl.scrollTrigger;
        if (st) {
          applyRef.current = () => apply(st.progress);
          apply(st.progress);
        }
        return;
      }

      const pin = pinRef.current;
      const panel = panelRef.current;
      if (!pin || !panel) return;

      pin.classList.add("story-live");
      panel.classList.remove("hidden");

      const beats = gsap.utils.toArray<HTMLElement>(".story-beat", pin);
      const layers = gsap.utils.toArray<HTMLElement>(".story-layer", panel);
      const SEG = BEATS.length - 1;

      // Later beats wait unseen.
      beats.forEach((b, i) => {
        if (i > 0) gsap.set(b, { opacity: 0 });
      });

      const pauseAll = () => {
        layers.forEach((L) => {
          const v = L.querySelector("video");
          if (v && !v.paused) v.pause();
        });
      };

      // Filled in below, once the timeline's labels exist; the trigger's
      // callbacks close over them so they always reach the live versions.
      let applyLive: (progress: number) => void = () => {};
      let snapPoints: number[] = [];

      const tl = gsap.timeline({
        defaults: { ease: "power2.out" },
        scrollTrigger: {
          trigger: pin,
          start: "top top",
          end: () => `+=${window.innerHeight * SEG * STEP_VH}`,
          pin: true,
          scrub: 1,
          snap: {
            // Rest points are the BEATS only. The step-* labels are transit
            // positioning aids — snapping to them (as labelsDirectional
            // did) parks the scrub mid-crossing, where the frame's
            // interpolated opacity is partial: the beat-3 ghost rectangle.
            snapTo: (value: number) => {
              if (!snapPoints.length) return value;
              let best = snapPoints[0];
              for (const s of snapPoints) {
                if (Math.abs(s - value) < Math.abs(best - value)) best = s;
              }
              return best;
            },
            duration: { min: 0.2, max: 0.6 },
            ease: "power2.out",
          },
          invalidateOnRefresh: true,
          anticipatePin: 1,
          // Last pin in document order (FiveFloors 3, Gallery 2).
          refreshPriority: 1,
          onUpdate: (self) => applyLive(self.progress),
          onRefresh: (self) => {
            applyLive(self.progress);
            if (process.env.NODE_ENV === "development") {
              console.log("[MdB pin] story", {
                start: Math.round(self.start),
                end: Math.round(self.end),
                travel: Math.round(self.end - self.start),
                spacerHeight:
                  (self.pin as HTMLElement | undefined)?.parentElement
                    ?.offsetHeight ?? null,
              });
            }
          },
          onLeave: pauseAll,
          onLeaveBack: pauseAll,
        },
      });

      tl.addLabel("beat-0");
      BEATS.forEach((_, i) => {
        if (i === 0) return;
        const at = `step-${i}`;
        tl.addLabel(at, "+=0.35");
        // The outgoing copy clears FIRST — the frame never crosses live text.
        tl.to(beats[i - 1], { opacity: 0, duration: 0.25 }, at);
        // Spacer holding the transit's slot in the timeline: the frame's
        // actual movement is written per-frame by apply(), not tweened,
        // so the label spacing (and the snap points) stay exactly as the
        // approved build had them.
        tl.to({}, { duration: 1 }, at);
        // The next beat resolves once the frame has cleared its column.
        tl.fromTo(
          beats[i],
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.3 },
          `${at}+=0.72`
        );
        tl.addLabel(`beat-${i}`, "+=0.05");
      });

      // Beat centres as progress fractions, read off the real labels so the
      // frame's slot interpolation and the snap agree to the pixel. Clamped:
      // the final beat label sits a hair past the timeline's content end, so
      // its raw fraction lands above 1 and beat 4 would never quite resolve.
      const duration = tl.duration();
      const beatPos = BEATS.map((_, i) =>
        Math.min(1, tl.labels[`beat-${i}`] / duration)
      );
      snapPoints = beatPos;

      /** The ported reference mechanic: one shared frame interpolating
       *  between per-beat slots, media crossfading by proximity, only the
       *  active beat's video playing. All writes pass the safety envelope. */
      const apply = (progress: number) => {
        const p = Number.isFinite(progress) ? clamp01(progress) : 0;

        // progress → beat-space f, piecewise across the real label positions
        let f = SEG;
        if (p <= beatPos[0]) f = 0;
        else {
          for (let i = 0; i < SEG; i++) {
            if (p <= beatPos[i + 1]) {
              f = i + (p - beatPos[i]) / (beatPos[i + 1] - beatPos[i]);
              break;
            }
          }
        }
        if (!Number.isFinite(f)) f = 0;

        const lo = Math.min(SEG - 1, Math.floor(f));
        const t = easeOutCubic(f - lo);
        const a = SLOTS[lo];
        const b = SLOTS[lo + 1];

        let tx = lerp(a.tx, b.tx, t);
        let sc = 1 + SWELL * Math.sin(clamp01(f - lo) * Math.PI);
        let op = clamp01(lerp(a.op, b.op, t));

        // The envelope: fall back rather than write a broken value through.
        if (!Number.isFinite(tx)) tx = 0;
        if (!Number.isFinite(sc)) sc = 1;
        if (!Number.isFinite(op)) op = 1;
        tx = Math.min(TX_MAX, Math.max(-TX_MAX, tx));
        sc = Math.min(SCALE_MAX, Math.max(SCALE_MIN, sc));

        panel.style.opacity = op.toFixed(3);
        panel.style.transform = `translate(-50%, -50%) translateX(${tx.toFixed(
          2
        )}vw) scale(${sc.toFixed(3)})`;

        // Media crossfade by proximity; only the active layer's video
        // plays, and never before it can actually show frames — a stalled
        // play() on a file this size is what produces a black box, so
        // below readyState 2 the poster holds and we only ask the browser
        // to start fetching.
        layers.forEach((L) => {
          const bi = Number(L.dataset.beat);
          const ad = Math.abs(f - bi);
          L.style.opacity = smooth(0, 1, 1 - clamp01(ad)).toFixed(3);
          const v = L.querySelector("video");
          if (!v) return;
          if (ad < 0.5 && op > 0.02) {
            if (v.readyState >= 2) {
              if (v.paused) v.play().catch(() => {});
            } else if (!v.dataset.fetching) {
              v.dataset.fetching = "1";
              v.load();
            }
          } else if (!v.paused) {
            v.pause();
          }
        });
      };

      applyLive = apply;
      const st = tl.scrollTrigger;
      if (st) {
        applyRef.current = () => apply(st.progress);
        // Before first paint (useGSAP runs at layout-effect timing): the
        // frame must be correct at the current scroll, not corrected after.
        apply(st.progress);
      }
    },
    { scope: ref }
  );

  return (
    <section
      ref={ref}
      id="story"
      data-theme="ink"
      aria-label="The story of the house"
      className="relative isolate bg-ink text-cream"
    >
      <div ref={pinRef} className="story-shell relative">
        {BEATS.map((beat, i) => {
          const centered = beat.video === null;
          const textRight = i % 2 === 1;
          const justify = centered
            ? "justify-center"
            : textRight
              ? "justify-end"
              : "justify-start";
          return (
            <article
              key={beat.kicker}
              className={`story-beat relative flex min-h-[100dvh] items-center py-[clamp(80px,11vh,124px)] ${justify}`}
            >
              {/* Mobile only (isMobile is set client-side, so SSR and
                  desktop DOM are untouched): the beat's video as a
                  full-bleed cover background under a bottom scrim.
                  Portrait 9:16 encode below 768px via the media
                  attribute; muted + playsInline are mandatory for iOS
                  autoplay. Hidden until .story-live-m exists, so reduced
                  motion never shows it. Playback is driven by the pin
                  timeline's apply() — play while the beat is active,
                  paused otherwise. */}
              {isMobile && beat.video && (
                <div className="story-mvid" aria-hidden="true">
                  {near && (
                    <video
                      muted
                      playsInline
                      loop
                      preload="none"
                      poster={`/images/story/${beat.video}-portrait-poster.jpg`}
                    >
                      <source
                        src={`/videos/story/${beat.video}-portrait.mp4`}
                        media="(max-width: 767px)"
                        type="video/mp4"
                      />
                      <source
                        src={`/videos/story/${beat.video}.mp4`}
                        type="video/mp4"
                      />
                    </video>
                  )}
                  <div className="story-mscrim" />
                </div>
              )}
              <div className="content-wrap w-full">
                <div className={`flex ${justify}`}>
                  {/* The 'none' beat is the breath between the side-panel
                      beats: full width, centred, short broken lines —
                      the widest, quietest moment in the section. */}
                  <div
                    className={
                      centered
                        ? "w-full text-center"
                        : "max-w-[46ch] md:w-[44%] md:min-w-[380px]"
                    }
                  >
                    {/* Static/mobile media: poster only, never a video. */}
                    {beat.video && (
                      <div className="story-thumb" aria-hidden="true">
                        <picture>
                          <source
                            srcSet={`/images/story/${beat.video}.webp`}
                            type="image/webp"
                          />
                          <img
                            src={`/images/story/${beat.video}.jpg`}
                            alt=""
                            loading="lazy"
                            draggable={false}
                          />
                        </picture>
                      </div>
                    )}
                    <p className="label text-orange">{beat.kicker}</p>
                    <h3
                      className={`type-title mt-6 font-normal ${
                        centered ? "mx-auto max-w-[16ch]" : ""
                      }`}
                    >
                      {beat.headline}
                    </h3>
                    {beat.body.map((line) => (
                      <p
                        key={line.slice(0, 24)}
                        className={`mt-6 text-[1.0625rem] leading-[1.6] md:text-lg ${
                          centered ? "mx-auto max-w-[62ch]" : "max-w-[46ch]"
                        }`}
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          );
        })}

        {/* The one shared media frame — content crossfades, the frame
            repositions between halves and disappears for beat 3. */}
        <div
          ref={panelRef}
          className="story-panel pointer-events-none absolute left-1/2 top-1/2 hidden h-[min(64vh,600px)] w-[min(44vw,620px)]"
          aria-hidden="true"
        >
          {MEDIA.map((m) => (
            <div className="story-layer" data-beat={m.i} key={m.i}>
              <picture>
                <source
                  srcSet={`/images/story/${m.id}.webp`}
                  type="image/webp"
                />
                <img
                  src={`/images/story/${m.id}.jpg`}
                  alt=""
                  loading="lazy"
                  draggable={false}
                />
              </picture>
              {near && (
                <video
                  src={`/videos/story/${m.id}.mp4`}
                  muted
                  loop
                  playsInline
                  preload="none"
                  poster={`/images/story/${m.id}.jpg`}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
