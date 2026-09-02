import { prefersReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Global gyroscope parallax source. One deviceorientation listener feeds a
 * smoothed, normalised tilt offset that any mobile section can read.
 *
 * iOS requires DeviceOrientationEvent.requestPermission() to be called from
 * inside a user gesture, so `requestGyroFromGesture` is wired into the OTP
 * gate's VERIFY tap (ScrollGate). Platforms without the permission API
 * (Android, desktop) start listening directly via `startGyroDirect`.
 *
 * Raw beta/gamma are measured relative to the first reading (the visitor's
 * natural holding angle), clamped to ±18°, normalised to −1..1 and smoothed
 * with an exponential moving average (alpha 0.2 — light enough that a
 * velocity-driven consumer like the hero dumbbell doesn't lag the hand,
 * heavy enough that sensor jitter never reaches the transforms). Denial,
 * absence of the API, or prefers-reduced-motion all degrade silently to
 * zero offset.
 */

export type GyroOffset = { x: number; y: number };

/** Smoothed normalised tilt: x = front-back (beta), y = left-right (gamma). */
const offset: GyroOffset = { x: 0, y: 0 };
const listeners = new Set<() => void>();

let started = false;
let requested = false;
let baseBeta: number | null = null;
let baseGamma: number | null = null;

/** EMA smoothing factor for the raw sensor stream. */
const ALPHA = 0.2;
/** Degrees of tilt away from the resting pose that map to full deflection. */
const RANGE_DEG = 18;

/**
 * The normalised tilt, signed −1..1 per axis: x = front-back (beta),
 * y = left-right (gamma), 0 at the visitor's natural holding angle,
 * ±1 at ±18°. Consumers choose their own mapping — displacement,
 * rotation, or acceleration.
 */
export function getGyro(): Readonly<GyroOffset> {
  return offset;
}

/** Subscribe to smoothed updates. Returns an unsubscribe function. */
export function onGyro(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function handle(e: DeviceOrientationEvent) {
  if (e.beta == null || e.gamma == null) return;
  if (baseBeta === null || baseGamma === null) {
    baseBeta = e.beta;
    baseGamma = e.gamma;
  }
  const targetX = Math.max(-1, Math.min(1, (e.beta - baseBeta) / RANGE_DEG));
  const targetY = Math.max(-1, Math.min(1, (e.gamma - baseGamma) / RANGE_DEG));
  offset.x += (targetX - offset.x) * ALPHA;
  offset.y += (targetY - offset.y) * ALPHA;
  listeners.forEach((cb) => cb());
}

function attach() {
  if (started) return;
  started = true;
  window.addEventListener("deviceorientation", handle);
}

/**
 * Start listening on platforms that need no explicit permission. On iOS
 * (where DeviceOrientationEvent.requestPermission exists) this is a no-op;
 * the gesture path below handles it.
 */
export function startGyroDirect() {
  if (started || typeof window === "undefined") return;
  if (prefersReducedMotion()) return;
  const DOE = window.DeviceOrientationEvent as
    | (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> })
    | undefined;
  if (!DOE) return;
  if (typeof DOE.requestPermission === "function") return;
  attach();
}

/**
 * Must be called synchronously inside a user gesture handler (the OTP
 * VERIFY tap). Requests iOS permission if required; otherwise starts
 * directly. Every failure path is silent — the site works touch-only.
 */
export function requestGyroFromGesture() {
  if (started || requested || typeof window === "undefined") return;
  if (prefersReducedMotion()) return;
  const DOE = window.DeviceOrientationEvent as
    | (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> })
    | undefined;
  if (!DOE) return;
  if (typeof DOE.requestPermission !== "function") {
    attach();
    return;
  }
  requested = true;
  try {
    // Called synchronously within the tap so iOS honours it; only the
    // listener attachment waits on the promise.
    DOE.requestPermission()
      .then((state) => {
        if (state === "granted") attach();
      })
      .catch(() => {});
  } catch {
    // Older Safari throws instead of rejecting — degrade silently.
  }
}
