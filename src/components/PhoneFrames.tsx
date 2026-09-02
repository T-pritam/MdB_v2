"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollTrigger } from "@/lib/gsap";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";
import { getGyro, onGyro } from "@/lib/gyro";

/**
 * THE COMPANION on mobile — the desktop phone scene as a pre-rendered
 * frame sequence, scrubbed on scroll. Pixel-identical to the WebGL scene
 * (the frames ARE that scene, captured at 600×900 via ?capture=phone),
 * instant, zero GPU: the hero keeps the mobile page's only WebGL context.
 *
 * Frames preload lazily: a once-only ScrollTrigger starts the fetch when
 * the section is roughly two viewports away; frame 0 draws the moment it
 * arrives (300ms fade-in) and the rest stream in order. Scrubbing to a
 * frame that hasn't arrived draws the nearest loaded one — never a blank.
 *
 * prefers-reduced-motion: the middle frame (30) is drawn and held.
 * A subtle gyroscope parallax (silent under reduced motion, on denial,
 * or without the API) offsets the canvas a few pixels with device tilt.
 */

const FRAME_COUNT = 60;
const FRAME_W = 600;
const FRAME_H = 900;
const SECTION_ID = "app";
const HOLD_FRAME = 30;

const frameSrc = (i: number) =>
  `/images/phone-frames/phone-${i.toString().padStart(3, "0")}.webp`;

export default function PhoneFrames() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = prefersReducedMotion();
    const frames: (HTMLImageElement | null)[] = Array(FRAME_COUNT).fill(null);
    let disposed = false;
    let started = false;
    let drawn = -1;
    let want = reduced ? HOLD_FRAME : 0;
    let shown = false;

    // Draw the wanted frame, falling back to the nearest loaded neighbour;
    // only redraws when the resolved index actually changes.
    const draw = () => {
      let use = -1;
      for (let d = 0; d < FRAME_COUNT; d++) {
        if (want - d >= 0 && frames[want - d]) {
          use = want - d;
          break;
        }
        if (want + d < FRAME_COUNT && frames[want + d]) {
          use = want + d;
          break;
        }
      }
      if (use < 0 || use === drawn) return;
      drawn = use;
      ctx.clearRect(0, 0, FRAME_W, FRAME_H);
      ctx.drawImage(frames[use]!, 0, 0, FRAME_W, FRAME_H);
      if (!shown) {
        shown = true;
        setVisible(true);
      }
    };

    const load = (i: number, done?: () => void) => {
      const img = new Image();
      img.onload = () => {
        if (disposed) return;
        frames[i] = img;
        done?.();
      };
      img.onerror = () => done?.();
      img.src = frameSrc(i);
    };

    // Sequential streaming so early frames (the ones a scrolling visitor
    // meets first) always win the connection.
    const loadFrom = (i: number) => {
      if (disposed || i >= FRAME_COUNT) return;
      if (frames[i]) {
        loadFrom(i + 1);
        return;
      }
      load(i, () => {
        draw();
        loadFrom(i + 1);
      });
    };

    const startPreload = () => {
      if (started || disposed) return;
      started = true;
      if (reduced) {
        // Held frame only — nothing else is ever shown, fetch nothing else.
        load(HOLD_FRAME, draw);
        return;
      }
      load(0, () => {
        draw();
        loadFrom(1);
      });
    };

    const section = document.getElementById(SECTION_ID);
    const triggers: ScrollTrigger[] = [];
    if (section) {
      // Preload begins ~two viewports before the section arrives, once.
      triggers.push(
        ScrollTrigger.create({
          trigger: section,
          start: "top 300%",
          once: true,
          onEnter: startPreload,
        })
      );
      if (!reduced) {
        // Same range the desktop scene scrubs: top-enters-bottom →
        // bottom-leaves-top across the section.
        triggers.push(
          ScrollTrigger.create({
            trigger: section,
            start: "top bottom",
            end: "bottom top",
            onUpdate: (self) => {
              want = Math.round(self.progress * (FRAME_COUNT - 1));
              draw();
            },
          })
        );
      }
    } else {
      startPreload();
    }

    // Tilt reads as the on-screen phone answering the real one in the
    // visitor's hand: a 3D rotation (±12° yaw / ±8° pitch), inherently
    // bounded, under the wrapper's perspective. Silent under reduced
    // motion, denial, or a missing API — the store never moves.
    const offGyro = onGyro(() => {
      const g = getGyro();
      canvas.style.transform = `rotateY(${(g.y * 12).toFixed(2)}deg) rotateX(${(
        -g.x * 8
      ).toFixed(2)}deg)`;
    });

    return () => {
      disposed = true;
      triggers.forEach((t) => t.kill());
      offGyro();
    };
  }, []);

  return (
    /* perspective for the gyro's 3D tilt on the canvas below — this
       component only ever mounts below 768px. */
    <div
      className="flex w-full justify-center"
      style={{ perspective: "1000px" }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        width={FRAME_W}
        height={FRAME_H}
        className={`aspect-[2/3] w-[min(76vw,380px)] transition-opacity duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
