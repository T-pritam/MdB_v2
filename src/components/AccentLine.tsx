"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * A single quiet accent line between sections — small, tracked, understated,
 * alone in generous space. A whisper, never stacked with other statements.
 */

const EASE: [number, number, number, number] = [0.33, 1, 0.68, 1];

export default function AccentLine({
  text,
  theme,
}: {
  text: string;
  theme: "ink" | "cream";
}) {
  const reduce = useReducedMotion();
  return (
    <section
      data-theme={theme}
      className={`relative flex min-h-[46vh] items-center py-[clamp(92px,13vh,132px)] ${
        theme === "ink" ? "bg-ink text-cream" : "bg-cream text-ink"
      }`}
    >
      <div className="content-wrap flex w-full justify-center">
        <motion.p
          className="label text-center"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -15% 0px" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          {text}
        </motion.p>
      </div>
    </section>
  );
}
