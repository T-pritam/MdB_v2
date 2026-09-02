"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Preload, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { gsap } from "@/lib/gsap";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";

/**
 * The Companion's device, real geometry: the iPhone GLB with the app
 * dashboard on its emissive screen, scrubbed to the section's transit.
 *
 * Mounted by AppInstall on desktop only — hidden and pointer-inert,
 * chained off page load (load → idle → settle), so GLB parsing, PMREM
 * baking and shader compilation are already done before any scroll,
 * however fast, can reach the section.
 * frameloop="demand": nothing renders except on a scroll tick's
 * invalidate(), so this canvas costs nothing while the hero's is live. On WebGL context loss the parent swaps back to the
 * CSS phone — this component never tries to limp along.
 *
 * THE SHARED-OBJECT RULE (this project has been bitten): useGLTF caches
 * by URL and hands every caller the same Object3D. The scene is cloned
 * (scene.clone(true)) before mounting, and the screen material is
 * cloned before its emissive map is swapped, so the cached original is
 * never mounted or mutated.
 */

const MODEL_URL = "/models/iphone17promax.glb";
const TEXTURE_URL = "/images/app/iphone-screen-texture.png";
const SCREEN_MESH = "HkNSnYzBPABcqwM.001";
const SCREEN_MATERIAL = "BsXHDwLKqtDOfrW";
const SECTION_ID = "app";

/** Scroll motion envelope. */
const ROT_Y_MAX = (25 * Math.PI) / 180; // -25° → +25° across the transit
const ROT_X_TILT = (5 * Math.PI) / 180; // constant — never dead face-on
const Z_BASE = -0.6; // world units; approaches to +0.4 mid-transit
const Z_SWELL = 1.0;
/** The device fills ~85% of the camera's ~3.64-unit visible height. */
const FIT_HEIGHT = 3.1;
/** Exit fade: full opacity until 82% of the transit, gone by 98%. */
const FADE_START = 0.82;
const FADE_SPAN = 0.16;

/* Same environment as the hero (Scene3D.tsx): RoomEnvironment ships
   with three, so metal gets real reflections with no network fetch. */
function StudioEnvironment() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    scene.environmentIntensity = 0.4;
    return () => {
      scene.environment = null;
      scene.environmentIntensity = 1;
      envTexture.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  return null;
}

/**
 * DEV-ONLY CAPTURE MODE — writes the 60-frame sequence PhoneFrames scrubs
 * on mobile. Triple-guarded so it can never ship: a development build AND
 * `?capture=phone` in the URL AND a viewport ≥ 1024px. In production
 * builds the NODE_ENV check is a compile-time constant, so the entire
 * path is dead code.
 */
function captureRequested(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("capture") === "phone" &&
    window.innerWidth >= 1024
  );
}

const CAPTURE_W = 600;
const CAPTURE_H = 900;
const CAPTURE_FRAMES = 60;

function PhoneRig({
  onReady,
  onCaptureTick,
}: {
  onReady: () => void;
  onCaptureTick?: (frame: number | "done") => void;
}) {
  const group = useRef<THREE.Group>(null);
  const invalidate = useThree((state) => state.invalidate);
  const gl = useThree((state) => state.gl);
  const { scene } = useGLTF(MODEL_URL);
  const screenTexture = useTexture(TEXTURE_URL);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const progress = useRef(0);

  const { cloned, fit } = useMemo(() => {
    // Never mount the cached shared instance — deep clone first.
    const cloned = scene.clone(true);
    cloned.updateMatrixWorld(true);

    // ── The screen swap ─────────────────────────────────────────────
    // glTF texture convention: flipY = false. sRGB, or colours shift.
    screenTexture.colorSpace = THREE.SRGBColorSpace;
    screenTexture.flipY = false;
    screenTexture.needsUpdate = true;

    let screen: THREE.Mesh | null = null;
    cloned.traverse((obj) => {
      if (screen || !(obj instanceof THREE.Mesh)) return;
      const mat = obj.material as THREE.Material;
      if (obj.name === SCREEN_MESH || mat?.name === SCREEN_MATERIAL) {
        screen = obj;
      }
    });

    if (screen) {
      const mesh = screen as THREE.Mesh;
      // Clone the material too — it is shared with the cached scene.
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
      const original = mat.emissiveMap;
      mat.emissiveMap = screenTexture;
      mat.emissive = new THREE.Color(1, 1, 1); // stays fully self-lit
      // The dashboard's colours are design-exact: exempt the emissive
      // screen from ACES so Orange stays Orange. Lights never touch an
      // emissive term either way — the screen cannot darken in shadow.
      mat.toneMapped = false;
      mat.needsUpdate = true;
      mesh.material = mat;
      original?.dispose(); // free the baked screen from GPU memory
    }

    // ── Deterministic orientation check ─────────────────────────────
    // The root Empty carries a 180° X rotation (Blender legacy). Rather
    // than trust it, read the screen mesh itself: texture-top (v=0)
    // must map to world +Y, and the screen normal must face +Z (the
    // camera). π-flips on wrapper groups correct either failure — the
    // GLB is never edited.
    let flipFacing = 0;
    let flipUpright = 0;
    if (screen) {
      const mesh = screen as THREE.Mesh;
      const geo = mesh.geometry as THREE.BufferGeometry;
      const pos = geo.getAttribute("position");
      const uv = geo.getAttribute("uv");
      const nrm = geo.getAttribute("normal");
      if (pos && uv && nrm) {
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(
          mesh.matrixWorld
        );
        const v3 = new THREE.Vector3();
        let nz = 0;
        let covVY = 0;
        let meanV = 0;
        let meanY = 0;
        const n = pos.count;
        for (let i = 0; i < n; i++) {
          meanV += uv.getY(i);
          meanY += v3.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).y;
        }
        meanV /= n;
        meanY /= n;
        for (let i = 0; i < n; i++) {
          nz += v3.fromBufferAttribute(nrm, i).applyMatrix3(normalMatrix).z;
          const y = v3
            .fromBufferAttribute(pos, i)
            .applyMatrix4(mesh.matrixWorld).y;
          covVY += (uv.getY(i) - meanV) * (y - meanY);
        }
        // Screen looking away → about-face on Y (keeps vertical intact).
        if (nz < 0) flipFacing = Math.PI;
        // v grows downward in glTF; if v instead grows with world Y the
        // capture would stand on its head → roll π about Z.
        if (covVY > 0) flipUpright = Math.PI;
      }
    }

    // ── Auto-fit (hero convention) ──────────────────────────────────
    // The root scale is 0.01, leaving a ~0.2-unit phone; scale the
    // GROUP up to FIT_HEIGHT rather than pulling the camera in.
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;

    return {
      cloned,
      fit: {
        offset: center.multiplyScalar(-1),
        scale: FIT_HEIGHT / maxDim,
        flipFacing,
        flipUpright,
      },
    };
  }, [scene, screenTexture]);

  // This effect cannot run until the Suspense boundary above has
  // resolved (assets loaded) and <Preload all /> has compiled every
  // shader in its layout effect — so firing onReady here means "loaded
  // AND compiled": the parent's crossfade never reveals a stall.
  useEffect(() => {
    onReady();
  }, [onReady]);

  // One scrubbed ScrollTrigger — the site's convention, driving a plain
  // progress proxy. Every scroll tick writes progress, fades the canvas
  // at the exit edge (DOM opacity — no material writes), and calls
  // invalidate(): with frameloop="demand" nothing renders otherwise.
  useEffect(() => {
    if (reduced) {
      // Static, centred, face-on, full opacity: no trigger, one paint.
      invalidate();
      return;
    }
    const section = document.getElementById(SECTION_ID);
    if (!section) return;

    const state = { p: 0 };
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top bottom",
        end: "bottom top",
        scrub: 1,
        invalidateOnRefresh: true,
      },
    });
    tl.to(state, {
      p: 1,
      duration: 1,
      ease: "none",
      onUpdate: () => {
        progress.current = state.p;
        const fade =
          state.p < FADE_START
            ? 1
            : Math.max(0, 1 - (state.p - FADE_START) / FADE_SPAN);
        gl.domElement.style.opacity = fade.toFixed(3);
        invalidate();
      },
    });
    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, [reduced, invalidate, gl]);

  // ── Dev capture loop ─────────────────────────────────────────────
  // Runs only when onCaptureTick is passed (itself gated by the triple
  // guard). Sizes the canvas to a fixed 600×900 so every frame is
  // identical regardless of window size, steps the scroll-progress proxy
  // 0→1 across 60 frames, forces a render, and reads the canvas back in
  // the SAME tick as the render — so the production renderer config
  // (no preserveDrawingBuffer) is untouched.
  const captureScene = useThree((state) => state.scene);
  const captureCamera = useThree((state) => state.camera);
  useEffect(() => {
    if (!onCaptureTick || !captureRequested()) return;
    let cancelled = false;

    const run = async () => {
      // Suspense has resolved and Preload has compiled (this effect runs
      // after PhoneRig mounts); one short settle for the first paint.
      await new Promise((r) => setTimeout(r, 600));
      const g = group.current;
      if (!g || cancelled) return;

      gl.setPixelRatio(1);
      gl.setSize(CAPTURE_W, CAPTURE_H);
      const cam = captureCamera as THREE.PerspectiveCamera;
      cam.aspect = CAPTURE_W / CAPTURE_H;
      cam.updateProjectionMatrix();

      for (let i = 0; i < CAPTURE_FRAMES; i++) {
        if (cancelled) return;
        const p = i / (CAPTURE_FRAMES - 1);
        // Same mapping as the useFrame scrub below.
        g.rotation.y = (p * 2 - 1) * ROT_Y_MAX;
        g.rotation.x = ROT_X_TILT;
        g.position.z = Z_BASE + Z_SWELL * Math.sin(p * Math.PI);
        gl.render(captureScene, cam);
        // toBlob snapshots the bitmap synchronously at call time (encoding
        // is async), so this reads the buffer rendered this tick. The
        // canvas is alpha: true — frames come out transparent-backed.
        const blob = await new Promise<Blob | null>((resolve) =>
          gl.domElement.toBlob(resolve, "image/webp", 0.86)
        );
        if (!blob || cancelled) return;
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let bin = "";
        for (let j = 0; j < bytes.length; j += 8192) {
          bin += String.fromCharCode(...bytes.subarray(j, j + 8192));
        }
        await fetch("/api/dev/capture-frames", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `phone-${i.toString().padStart(3, "0")}.webp`,
            data: btoa(bin),
          }),
        });
        if (cancelled) return;
        onCaptureTick(i);
      }
      onCaptureTick("done");
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [onCaptureTick, gl, captureScene, captureCamera]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    if (reduced) {
      g.rotation.set(0, 0, 0);
      g.position.z = 0;
      return;
    }
    const p = progress.current;
    g.rotation.y = (p * 2 - 1) * ROT_Y_MAX;
    g.rotation.x = ROT_X_TILT;
    // Approaches through the middle of the transit, then recedes.
    g.position.z = Z_BASE + Z_SWELL * Math.sin(p * Math.PI);
  });

  return (
    <group ref={group}>
      <group rotation={[0, fit.flipFacing, 0]}>
        <group rotation={[0, 0, fit.flipUpright]}>
          <group scale={fit.scale}>
            <group position={fit.offset}>
              <primitive object={cloned} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

export default function PhoneScene({
  onContextLost,
  onReady,
}: {
  onContextLost: () => void;
  onReady: () => void;
}) {
  // Dev capture overlay state. captureRequested() is constant for the life
  // of the page (URL + build + viewport-at-mount), read once.
  const [capturing] = useState(() => captureRequested());
  const [captured, setCaptured] = useState<number | "done">(0);
  const onCaptureTick = useCallback(
    (frame: number | "done") =>
      setCaptured(frame === "done" ? "done" : frame + 1),
    []
  );

  return (
    <>
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ fov: 40, near: 0.1, far: 100, position: [0, 0, 5] }}
      gl={{
        alpha: true,
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.15,
      }}
      style={{
        width: "100%",
        height: "100%",
        background: "transparent",
        pointerEvents: "none",
      }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (event) => {
          event.preventDefault();
          onContextLost();
        });
      }}
    >
      {/* Titanium on Ink: a warm key from the front-right, and the rim
          from behind-left — the edge light is what separates a dark
          object from a dark field. The screen is emissive + untone-
          mapped, so none of this touches it. */}
      <ambientLight color={0xeae0d2} intensity={0.15} />
      <directionalLight color={0xfff8f0} intensity={2.5} position={[3, 4, 4]} />
      <directionalLight
        color={0xeae0d2}
        intensity={1.8}
        position={[-4, 2, -5]}
      />
      <StudioEnvironment />
      {/* While this boundary is suspended the parent keeps the CSS phone
          on screen as the visible fallback (r3f's reconciler cannot
          project DOM into a canvas-side fallback, so the handoff rides
          onReady). Preload compiles all 32 materials via gl.compile
          before first paint — no first-frame shader stall. */}
      <Suspense fallback={null}>
        <PhoneRig
          onReady={onReady}
          onCaptureTick={capturing ? onCaptureTick : undefined}
        />
        <Preload all />
      </Suspense>
    </Canvas>
    {capturing && (
      <div
        className="fixed inset-0 z-[90] flex items-center justify-center bg-ink"
        style={{ pointerEvents: "auto" }}
      >
        <p className="label text-cream">
          {captured === "done"
            ? "Done — 60 frames written"
            : `Capturing ${captured} / ${CAPTURE_FRAMES}`}
        </p>
      </div>
    )}
    </>
  );
}
