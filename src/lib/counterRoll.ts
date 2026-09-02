/**
 * The odometer mechanic from FiveFloors' floor counter, extracted verbatim
 * so the mobile gallery's NN / 07 counter can roll the same way: a numeric
 * proxy tweens from → to, snapped to integers, and every update writes the
 * formatted value into the element. The caller decides how the tween is
 * played — at a timeline position (FiveFloors) or as a plain tween
 * (the gallery).
 */
export function makeCounterRoll(
  from: number,
  to: number,
  el: HTMLElement,
  format: (n: number) => string,
  duration = 0.6
): { target: { v: number }; vars: gsap.TweenVars } {
  const roll = { v: from };
  return {
    target: roll,
    vars: {
      v: to,
      duration,
      snap: { v: 1 },
      onUpdate: () => {
        el.textContent = format(Math.round(roll.v));
      },
    },
  };
}
