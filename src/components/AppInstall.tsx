"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";

const PhoneScene = dynamic(() => import("./PhoneScene"), { ssr: false });
const PhoneFrames = dynamic(() => import("./PhoneFrames"), { ssr: false });

/**
 * THE COMPANION — Ink. The app presented as what it is: a record-keeper.
 * The device is the centred focal object: on desktop the real iPhone
 * GLB (PhoneScene), mounted hidden shortly after page load — once the
 * page's own loading (hero GLB included) has settled — so parse, PMREM
 * and shader compilation are long finished before any scroll, however
 * fast, can reach this section. Below 768px the canvas NEVER mounts —
 * the CSS phone renders instead, and it is also the fallback if the
 * WebGL context is lost. While the scene loads, the phone slot is
 * reserved empty space at the correct dimensions.
 *
 * Both store buttons link to the production downloads page.
 */

const APP_DOWNLOAD_URL = "https://maisondebuild.com/downloads";

export default function AppInstall() {
  const ref = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLSpanElement>(null);

  // "css": desktop context loss (and SSR/no-JS, so the section is never
  // phoneless). "frames": mobile — the pre-rendered frame sequence, no
  // WebGL. "pending": desktop before the mount chain fires (reserved
  // space only). "3d": the canvas is mounted (hidden until ready).
  const [mode, setMode] = useState<"css" | "pending" | "3d" | "frames">("css");
  const lostRef = useRef(false);
  // The scene reports in once loaded AND compiled; the canvas then
  // fades in over 400ms. Until that moment the slot stays empty.
  const [sceneReady, setSceneReady] = useState(false);

  // Mount at page load, chained — never against the hero. Threshold
  // exposes no "hero ready" signal (its introDone/mountScene are
  // internal state; Scene3D emits nothing), so the stated proxy is
  // used: window 'load' → requestIdleCallback (setTimeout 1500ms where
  // unavailable) → a further 1000ms settle, because PMREM + 32 shader
  // compiles are a synchronous burst that must not land mid-wordmark
  // intro. Desktop only: mobile never mounts the canvas.
  useEffect(() => {
    if (window.innerWidth < 768) {
      // Mobile: the frame sequence replaces both the WebGL scene and the
      // CSS phone. The canvas can never mount below 768px.
      setMode("frames");
      return;
    }
    setMode("pending");

    let cancelled = false;
    let idleId: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const mount = () => {
      if (!cancelled && !lostRef.current) setMode("3d");
    };
    const afterIdle = () => {
      timer = setTimeout(mount, 1000);
    };
    const onLoad = () => {
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(afterIdle);
      } else {
        timer = setTimeout(afterIdle, 1500);
      }
    };

    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", onLoad);
      if (idleId !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);

  const onContextLost = useCallback(() => {
    lostRef.current = true;
    setMode("css");
  }, []);

  const onSceneReady = useCallback(() => setSceneReady(true), []);

  // The text reveal runs once, independent of which device renders.
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from(".app-rise", {
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

  // The CSS phone's scrub — built only while the fallback is the device
  // on screen (mobile always; desktop only after context loss). Reverted
  // and rebuilt when the mode flips, so a mid-session fallback still
  // gets its motion. The GLB scene carries its own single trigger.
  useGSAP(
    () => {
      if (mode !== "css") return;
      if (prefersReducedMotion()) return;

      const stage = stageRef.current;
      const phone = phoneRef.current;
      const glare = glareRef.current;
      if (!stage || !phone || !glare) return;
      // Below 768px the turn is dropped for a fade-and-drift only — the
      // stacked column leaves no room for the projection to breathe and
      // the flat treatment stays jank-free on weaker devices.
      const small = window.innerWidth < 768;

      const tl = gsap.timeline({
        // Scrubbed timeline: linear through the transit; the fades carry
        // the house ease, scrub smoothing does the rest.
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: ref.current,
          start: "top bottom",
          end: "bottom top",
          scrub: 1,
          invalidateOnRefresh: true,
          // The compositor hint exists only while the section transits —
          // never a standing cost on the rest of the page.
          onToggle: (self) => {
            phone.style.willChange = self.isActive ? "transform" : "";
            stage.style.willChange = self.isActive ? "opacity" : "";
            glare.style.willChange = self.isActive ? "transform" : "";
          },
        },
      });

      // Visible through the section's active middle: in by 15% of the
      // transit, out only across the final 15%. The fade rides the STAGE
      // so the grounding layers (shadow, glow) dim with the device — a
      // shadow outliving its object would give the fake away.
      tl.fromTo(
        stage,
        { opacity: 0 },
        { opacity: 1, duration: 0.15, ease: "power2.out" },
        0
      );
      tl.to(stage, { opacity: 0, duration: 0.15, ease: "power2.out" }, 0.85);

      if (small) {
        tl.fromTo(phone, { y: 24 }, { y: -24, duration: 1 }, 0);
      } else {
        // The turn: perspective sits on .app-phone-stage (globals.css).
        // ±12° — a wider swing reads flatter, not deeper. rotationX is a
        // constant tilt (same value both ends): the device is never seen
        // perfectly face-on, which is what sells the object. z carries it
        // through space rather than spinning it in place.
        tl.fromTo(
          phone,
          { rotationY: -12, rotationX: 6, y: 36, z: -80 },
          { rotationY: 12, rotationX: 6, y: -36, z: 40, duration: 1 },
          0
        );
        // Room light crossing the glass as the device turns — the sheen
        // band sweeps opposite the rotation on the same scrub.
        tl.fromTo(glare, { xPercent: -14 }, { xPercent: 14, duration: 1 }, 0);
      }
    },
    { scope: ref, dependencies: [mode], revertOnUpdate: true }
  );

  // The CSS phone, unchanged — now rendered ONLY after desktop WebGL
  // context loss (and in SSR/no-JS HTML). Mobile renders PhoneFrames;
  // the desktop loading path reserves empty space instead.
  const cssPhone = (
    <div ref={stageRef} className="app-phone-stage" aria-hidden="true">
      {/* Grounding layers: siblings of the phone, painted beneath it
          (DOM order) and never rotating with it. The glow is what makes
          the contact shadow legible on a #000 field. */}
      <span className="app-phone-glow" />
      <span className="app-phone-shadow" />
      <div ref={phoneRef} className="app-phone">
        <span className="app-phone-notch" />
        <div className="app-phone-screen">
          <img
            src="/images/app/dashboard-home.png"
            alt=""
            className="app-phone-capture"
            loading="lazy"
            draggable={false}
          />
          <span ref={glareRef} className="app-phone-glare" />
        </div>
      </div>
    </div>
  );

  return (
    <section
      ref={ref}
      id="app"
      data-theme="ink"
      aria-label="The companion app"
      className="relative section-pad bg-ink text-cream"
    >
      {/* The phone is the focal element: copy above, device centred,
          store actions below — one column, reading order preserved. */}
      <div className="content-wrap flex flex-col items-center text-center">
        <p className="app-rise label text-orange">The Companion</p>
        <h2 className="app-rise type-title mt-6 max-w-[16ch]">
          The house, in your pocket.
        </h2>
        <p className="app-rise type-body mt-10 max-w-[46ch]">
          Book a bay. See your programme. Read your own record — every
          session, every lift, every quarterly review.
        </p>
        <p className="app-rise type-body mt-6 max-w-[46ch]">
          Your coach writes it. You carry it.
        </p>

        <div className="mt-16 flex w-full justify-center">
          {mode === "frames" ? (
            <PhoneFrames />
          ) : mode === "css" ? (
            cssPhone
          ) : (
            /* Reserved space at the canvas's exact dimensions: nothing
               renders in the slot while the scene loads, and nothing
               shifts when it mounts. The canvas arrives hidden and
               pointer-inert, then fades in over 400ms on the house ease
               once loaded AND compiled — typically moments after page
               load, viewports before anyone can scroll here. */
            <div
              className="relative h-[min(72vh,680px)] w-[min(88vw,560px)]"
              aria-hidden="true"
            >
              {mode === "3d" && (
                <div
                  className={`pointer-events-none absolute inset-0 transition-opacity duration-[400ms] ease-[cubic-bezier(0.33,1,0.68,1)] ${
                    sceneReady ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <PhoneScene
                    onContextLost={onContextLost}
                    onReady={onSceneReady}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="app-rise mt-14 flex flex-wrap justify-center gap-5">
          <a
            href={APP_DOWNLOAD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="label inline-block border border-cream/30 px-8 py-4 text-cream"
          >
            App Store
          </a>
          <a
            href={APP_DOWNLOAD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="label inline-block border border-cream/30 px-8 py-4 text-cream"
          >
            Google Play
          </a>
        </div>
      </div>
    </section>
  );
}
