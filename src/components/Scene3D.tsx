"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";
import { getGyro, onGyro } from "@/lib/gyro";
import { classifyGesture } from "@/lib/gesture";

/**
 * The dumbbell's material is fully metallic (glTF default metallicFactor 1).
 * Pure metals have no diffuse response, so without an environment map they
 * render as a near-black ghost. RoomEnvironment is bundled with three, so
 * this needs no network fetch. Its intensity is held low so the directional
 * key stays the one readable light source: museum-lit on black.
 */
function StudioEnvironment() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    scene.environmentIntensity = 0.35;
    return () => {
      scene.environment = null;
      scene.environmentIntensity = 1;
      envTexture.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  return null;
}

/** Seconds of stillness before the object resumes its own slow turn. */
const IDLE_DELAY = 2.5;
/** Seconds spent ramping into that turn, so it eases in rather than snaps on. */
const IDLE_RAMP = 1.5;
/** Idle turn speed in rad/s. Museum-slow, per the brand doc. */
const IDLE_SPEED = 0.15;
/** Per-frame carry-over after release. Settles in roughly a third of a second. */
const INERTIA_DECAY = 0.88;
/** Vertical travel stops short of the poles: a dumbbell tumbling end over end
 *  reads as broken, not physical. */
const MAX_PITCH = Math.PI / 2;

function Dumbbell() {
  const spin = useRef<THREE.Group>(null);
  const { scene } = useGLTF("/models/dumbbell.glb");
  const gl = useThree((state) => state.gl);

  // Drag is user-initiated, so it runs regardless. Only the unattended idle
  // turn is a motion preference.
  const [allowIdle] = useState(() => !prefersReducedMotion());

  const rot = useRef({ x: 0, y: 0 });
  const vel = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const idleTime = useRef(0);
  const ramp = useRef(0);

  // Auto-fit: measure the model's world bounding box, recenter its origin,
  // scale its longest side to ~3.2 units (camera at z=5, fov 40 sees ~3.6
  // units of height at the origin), and lay the long axis horizontally.
  const { offset, scale, orient } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;

    let orient: [number, number, number] = [0, 0, 0];
    if (size.y >= size.x && size.y >= size.z) {
      orient = [0, 0, Math.PI / 2];
    } else if (size.z >= size.x && size.z >= size.y) {
      orient = [0, Math.PI / 2, 0];
    }

    return {
      offset: center.multiplyScalar(-1),
      scale: 3.2 / maxDim,
      orient,
    };
  }, [scene]);

  // Drag to spin. Listeners sit on the canvas itself rather than the window, so
  // nothing outside the object is claimed. Pointer Events cover mouse, pen and
  // touch through one path.
  useEffect(() => {
    const canvas = gl.domElement;
    const root = document.documentElement;

    const endDrag = () => {
      if (!dragging.current) return;
      dragging.current = false;
      root.classList.remove("dumbbell-grabbing");
    };

    const onDown = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      dragging.current = true;
      last.current = { x: e.clientX, y: e.clientY };
      // Released momentum is seeded from the drag, so clear any leftover.
      vel.current = { x: 0, y: 0 };
      idleTime.current = 0;
      ramp.current = 0;
      canvas.setPointerCapture(e.pointerId);
      root.classList.add("dumbbell-grabbing");
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging.current || !e.isPrimary) return;
      // One canvas width of travel equals one full revolution.
      const perPixel = (Math.PI * 2) / (canvas.clientWidth || 1);
      const dx = (e.clientX - last.current.x) * perPixel;
      const dy = (e.clientY - last.current.y) * perPixel;
      last.current = { x: e.clientX, y: e.clientY };

      rot.current.y += dx;
      rot.current.x += dy;
      // Last delta doubles as the release velocity.
      vel.current = { x: dy, y: dx };
      idleTime.current = 0;
    };

    const onEnter = () => root.classList.add("dumbbell-grab");
    const onLeave = () => root.classList.remove("dumbbell-grab");

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", endDrag);
    // Fires when the browser takes the gesture over for a vertical page pan.
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("pointerenter", onEnter);
    canvas.addEventListener("pointerleave", onLeave);

    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", endDrag);
      canvas.removeEventListener("pointercancel", endDrag);
      canvas.removeEventListener("pointerenter", onEnter);
      canvas.removeEventListener("pointerleave", onLeave);
      root.classList.remove("dumbbell-grab", "dumbbell-grabbing");
    };
  }, [gl]);

  useFrame((_, delta) => {
    const g = spin.current;
    if (!g) return;

    if (dragging.current) {
      idleTime.current = 0;
      ramp.current = 0;
    } else {
      idleTime.current += delta;

      // Carry the release momentum, shedding it at a frame-rate independent
      // rate so the object coasts to rest instead of stopping dead.
      const decay = Math.pow(INERTIA_DECAY, delta * 60);
      vel.current.x *= decay;
      vel.current.y *= decay;
      rot.current.x += vel.current.x;
      rot.current.y += vel.current.y;

      if (allowIdle && idleTime.current > IDLE_DELAY) {
        ramp.current = Math.min(1, ramp.current + delta / IDLE_RAMP);
        rot.current.y += IDLE_SPEED * delta * ramp.current;
      }
    }

    rot.current.x = THREE.MathUtils.clamp(rot.current.x, -MAX_PITCH, MAX_PITCH);
    g.rotation.x = rot.current.x;
    g.rotation.y = rot.current.y;
  });

  return (
    <group rotation={[0.3, 0, -0.12]}>
      <group ref={spin}>
        <group rotation={orient}>
          <group scale={scale}>
            <group position={offset}>
              <primitive object={scene} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

useGLTF.preload("/models/dumbbell.glb");

/** Mobile drag: radians of yaw per pixel of horizontal travel. */
const M_ROT_Y_PER_PX = 0.011;
/** Mobile drag: radians of pitch per pixel of vertical travel. */
const M_ROT_X_PER_PX = 0.005;
/** Mobile pitch clamp — the object can tilt but never flip. */
const M_MAX_PITCH = 0.4;
/** EMA alpha for the release-velocity estimate. */
const M_VEL_ALPHA = 0.3;
/** Momentum friction per frame (also decays the gyro spin when level). */
const M_FRICTION = 0.94;
/** Gyro PITCH parallax amplitude in radians (~4.5° at full tilt). The
    pitch axis is clamped (M_MAX_PITCH), so it keeps the bounded
    displacement model — integrating velocity into a clamped axis would
    only pin it against the clamp. */
const M_GYRO_AMP = 0.08;
/** Yaw: left-right tilt is angular ACCELERATION (rad/s² at full ±18°
    deflection). Hold a tilt and the spin builds; tilt the other way and
    it slows, stops, and reverses — the snowball. */
const M_GYRO_ACCEL = 3.0;
/** Yaw velocity cap (rad/s) — mandatory; a full tilt reaches it in
    ~1.3s and the object stays readable. A faster touch fling may exceed
    it briefly; the gyro then simply cannot push it further. */
const M_GYRO_MAX_VEL = 4.0;
/** Tilt below 3° of the 18° range (normalised) neither accelerates nor
    holds the spin — hand jitter must not cause drift. */
const M_GYRO_DEADZONE = 3 / 18;
/** Spin below this (rad/s) counts as stopped. */
const M_SPIN_STOP = 0.01;

/**
 * Mobile-only interaction path. The visual rig (fit, lighting, materials)
 * is identical to desktop; only the input model changes: gesture-classified
 * touch-drag with momentum, driven entirely by invalidate() under
 * frameloop="demand" — no useFrame, no continuous render loop. The GLTF
 * cache object is cloned before mounting so the cached scene is never
 * mounted directly.
 */
function DumbbellMobile({ activeRef }: { activeRef: React.RefObject<boolean> }) {
  const spin = useRef<THREE.Group>(null);
  const { scene } = useGLTF("/models/dumbbell.glb");
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);

  const [allowMotion] = useState(() => !prefersReducedMotion());

  // Same auto-fit as desktop, measured on the clone.
  const { offset, scale, orient } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;

    let orient: [number, number, number] = [0, 0, 0];
    if (size.y >= size.x && size.y >= size.z) {
      orient = [0, 0, Math.PI / 2];
    } else if (size.z >= size.x && size.z >= size.y) {
      orient = [0, Math.PI / 2, 0];
    }

    return {
      offset: center.multiplyScalar(-1),
      scale: 3.2 / maxDim,
      orient,
    };
  }, [cloned]);

  useEffect(() => {
    const canvas = gl.domElement;

    const rot = { x: 0, y: 0 };
    let gesture: "idle" | "pending" | "drag" | "scroll" = "idle";
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let velY = 0;
    let physRaf = 0;
    let physLastT = 0;
    let idleWait = 0;
    let idleRamp = 0;
    // THE one yaw velocity (rad/s). Touch-release momentum and the gyro
    // integration land in this same accumulator — they add, never
    // replace — and the idle turn contributes its ramped displacement
    // only while this is zero. Three sources, one value, no fights.
    let spinVel = 0;

    const apply = () => {
      const g = spin.current;
      if (!g) return;
      const gyro = getGyro();
      // Pitch keeps the bounded displacement model; yaw is pure
      // integrated state (spinVel writes into rot.y below).
      g.rotation.x =
        THREE.MathUtils.clamp(rot.x, -M_MAX_PITCH, M_MAX_PITCH) +
        gyro.x * M_GYRO_AMP;
      g.rotation.y = rot.y;
    };

    // ── The one physics loop: gyro acceleration, momentum decay and
    // the idle turn integrated together. Runs only with motion
    // allowed; a tick that changes nothing renders nothing, so
    // frameloop stays demand-driven.
    const physicsTick = (t: number) => {
      physRaf = requestAnimationFrame(physicsTick);
      const dt = Math.min((t - physLastT) / 1000, 0.05);
      physLastT = t;
      if (!activeRef.current) return; // off-screen: wait, render nothing
      if (gesture === "drag") return; // drag owns it — gyro suspended,
      // spinVel frozen, ready to ADD to the release momentum.

      const tilt = getGyro().y;
      const inDead = Math.abs(tilt) < M_GYRO_DEADZONE;

      if (inDead) {
        // Level: the spin coasts out on the existing momentum decay
        // rather than stopping dead.
        spinVel *= Math.pow(M_FRICTION, dt * 60);
        if (Math.abs(spinVel) < M_SPIN_STOP) spinVel = 0;
      } else {
        // The snowball: tilt accelerates the spin. The gyro can never
        // push past the cap; a faster touch fling is left to decay on
        // its own rather than being clipped.
        const before = Math.abs(spinVel);
        spinVel += M_GYRO_ACCEL * tilt * dt;
        const cap = Math.max(M_GYRO_MAX_VEL, before);
        spinVel = THREE.MathUtils.clamp(spinVel, -cap, cap);
      }

      let moving = false;
      if (spinVel !== 0) {
        rot.y += spinVel * dt;
        // Live spin stands the idle turn down; it re-ramps later.
        idleWait = 0;
        idleRamp = 0;
        moving = true;
      } else if (inDead) {
        // Level and stopped: the museum turn returns via its ramp.
        idleWait += dt;
        if (idleWait >= IDLE_DELAY) {
          idleRamp = Math.min(1, idleRamp + dt / IDLE_RAMP);
          rot.y += IDLE_SPEED * dt * idleRamp;
          moving = true;
        }
      }

      if (moving) {
        apply();
        invalidate();
      }
    };
    const startPhysics = () => {
      if (!allowMotion || physRaf) return;
      physLastT = performance.now();
      physRaf = requestAnimationFrame(physicsTick);
    };
    const stopPhysics = () => {
      if (physRaf) cancelAnimationFrame(physRaf);
      physRaf = 0;
    };

    const onDown = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      gesture = "pending";
      startX = lastX = e.clientX;
      startY = lastY = e.clientY;
      velY = 0;
      idleWait = 0;
      idleRamp = 0;
    };

    const onMove = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      if (gesture === "pending") {
        // Shared classifier (src/lib/gesture.ts): same 8px threshold and
        // same |dx| > |dy| rule as before extraction.
        const cls = classifyGesture(e.clientX - startX, e.clientY - startY);
        if (cls === null) return;
        if (cls === "drag") {
          gesture = "drag";
          canvas.setPointerCapture(e.pointerId);
          lastX = e.clientX;
          lastY = e.clientY;
        } else {
          // Vertical intent: the browser owns it (touch-action: pan-y).
          gesture = "scroll";
        }
        return;
      }
      if (gesture !== "drag") return;
      const dxd = e.clientX - lastX;
      const dyd = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      const dRotY = dxd * M_ROT_Y_PER_PX;
      rot.y += dRotY;
      rot.x = THREE.MathUtils.clamp(
        rot.x + dyd * M_ROT_X_PER_PX,
        -M_MAX_PITCH,
        M_MAX_PITCH
      );
      velY += (dRotY - velY) * M_VEL_ALPHA;
      apply();
      invalidate();
    };

    const onUp = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      const wasDrag = gesture === "drag";
      gesture = "idle";
      if (!wasDrag) return;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // Capture may already be gone (pointercancel) — nothing to release.
      }
      if (allowMotion) {
        // The release momentum ADDS to whatever spin the gyro had
        // built before the grab — velY is rad/frame at ~60fps,
        // spinVel is rad/s.
        spinVel += velY * 60;
      }
      // Reduced motion: no physics loop runs — the object stops the
      // instant the finger lifts.
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    // The event listener keeps the PITCH parallax live between physics
    // frames; the yaw integration reads the same store inside the loop.
    const offGyro = onGyro(() => {
      if (!activeRef.current) return;
      apply();
      invalidate();
    });

    apply();
    invalidate();
    startPhysics();

    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      stopPhysics();
      offGyro();
    };
  }, [gl, invalidate, allowMotion, activeRef]);

  return (
    <group rotation={[0.3, 0, -0.12]}>
      <group ref={spin}>
        <group rotation={orient}>
          <group scale={scale}>
            <group position={offset}>
              <primitive object={cloned} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

export default function Scene3D() {
  // Pause the render loop whenever the hero is out of view, so the Story
  // section's canvas is the only one actively rendering further down the
  // page. Nothing about the rig, camera, or visible behavior changes.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);

  // Mobile branch: same scene, demand-driven frames, touch-drag input.
  const [isMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches
  );
  const activeRef = useRef(true);
  activeRef.current = active;
  // WebGL context-loss on mobile falls back to the typographic hero
  // (the canvas simply unmounts); desktop keeps its existing behavior.
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) =>
      setActive(entry.isIntersecting)
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (isMobile && contextLost) return null;

  return (
    <div ref={wrapRef} style={{ width: "100%", height: "100%" }}>
    <Canvas
      frameloop={isMobile ? "demand" : active ? "always" : "never"}
      onCreated={({ gl }) => {
        if (!isMobile) return;
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          setContextLost(true);
        });
      }}
      dpr={[1, 2]}
      camera={{ fov: 40, near: 0.1, far: 100, position: [0, 0, 5] }}
      gl={{
        alpha: true,
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.3,
      }}
      // pan-y leaves vertical page scrolling to the browser while claiming
      // horizontal drags for rotation. Nothing is preventDefault-ed globally,
      // and a vertical swipe over the object still scrolls the page.
      style={{
        width: "100%",
        height: "100%",
        background: "transparent",
        touchAction: "pan-y",
        cursor: "grab",
      }}
    >
      {/* One source, per the constitution. The faint ambient only keeps the
          shadow side from collapsing to a silhouette on the Ink ground. */}
      <ambientLight color={0xeae0d2} intensity={0.15} />
      <directionalLight color={0xfff8f0} intensity={3.0} position={[4, 6, 4]} />
      <StudioEnvironment />
      <Suspense fallback={null}>
        {isMobile ? <DumbbellMobile activeRef={activeRef} /> : <Dumbbell />}
      </Suspense>
    </Canvas>
    </div>
  );
}
