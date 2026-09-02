/**
 * Horizontal-drag-versus-vertical-scroll gesture classification — the
 * dumbbell's model from mobile Layer 1, extracted so the mobile gallery
 * can share it instead of reinventing it.
 *
 * The contract, identical at every call site:
 * - 8px of movement before a gesture is classified at all;
 * - |dx| > |dy| → horizontal drag: the caller takes the gesture over
 *   (setPointerCapture) for its remainder;
 * - |dy| >= |dx| → vertical scroll: the caller releases the gesture to
 *   the browser and ignores it until the pointer lifts;
 * - the surface carries `touch-action: pan-y`, so the browser keeps
 *   native vertical scrolling either way.
 */

/** Movement (px) before a touch gesture is classified drag vs scroll. */
export const CLASSIFY_PX = 8;

/* ── The swipe-track snap contract (mobile Layer 2) ────────────────
   Written for the gallery's swipe track; the Activities carousel rides
   the identical values. One home, so the two surfaces can never drift. */

/** Drag past this fraction of card width advances one index. */
export const ADVANCE_FRACTION = 0.25;
/** Flick velocity (px/s) that advances one index. Never more than one. */
export const FLICK_PX_PER_S = 250;
/** Resistance multiplier when dragging past either end of the track. */
export const EDGE_RESIST = 0.35;
/** The release snap: 0.5s power3.out onto the target index. */
export const SNAP_S = 0.5;

export type GesturePhase = "idle" | "pending" | "drag" | "scroll";

/** null = still under the movement threshold, not yet classifiable. */
export function classifyGesture(
  dx: number,
  dy: number
): "drag" | "scroll" | null {
  if (Math.abs(dx) < CLASSIFY_PX && Math.abs(dy) < CLASSIFY_PX) return null;
  return Math.abs(dx) > Math.abs(dy) ? "drag" : "scroll";
}
