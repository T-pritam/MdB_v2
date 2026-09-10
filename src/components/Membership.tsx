"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * §6 MEMBERSHIP — Cream. Five ways in, per the client's finalised
 * Membership + Access Guide. The access comparison is absorbed into the
 * cards: every selling tier carries a G · 01 · 02 · 03 · 04 floor strip
 * with three states — included (solid Ink chip), via coins (Stone
 * outline), not available (em-dash) — distinct by shape, so the states
 * survive greyscale. A compact six-row strip beneath carries what the
 * floor strip can't; full detail lives in the brochure.
 *
 * Coins are written as currency only: wallet, balance, rates,
 * earn-back, top up, carry forward. No gamified vocabulary of any kind.
 *
 * No pricing anywhere — enquiry only. The one orange accent in this
 * section is the wallet kicker.
 */

const EASE: [number, number, number, number] = [0.33, 1, 0.68, 1];

const FLOOR_KEYS = ["G", "01", "02", "03", "04"] as const;

type FloorState = "in" | "coins" | "na";

type Tier = {
  num: string;
  name: string;
  line: string;
  floors?: Record<(typeof FLOOR_KEYS)[number], FloorState>;
  bullets?: string[];
  comingSoon?: boolean;
};

const ALL_IN: Record<(typeof FLOOR_KEYS)[number], FloorState> = {
  G: "in",
  "01": "in",
  "02": "in",
  "03": "in",
  "04": "in",
};

const TIERS: Tier[] = [
  {
    num: "01",
    name: "PERFORMANCE",
    line: "Athletic training.",
    floors: { G: "in", "01": "in", "02": "in", "03": "na", "04": "coins" },
    bullets: [
      "The Performance & Combat floor, all yours.",
      "Full Cardio & Recovery floor — steam, sauna, cold plunge, infrared.",
      "Body composition and movement assessment on joining.",
      "Coins loaded on day one.",
    ],
  },
  {
    num: "02",
    name: "STRENGTH",
    line: "Serious lifting.",
    floors: { G: "in", "01": "coins", "02": "in", "03": "in", "04": "coins" },
    bullets: [
      "The Strength floor, all yours. Every rack, every plate, every machine.",
      "Full Cardio & Recovery floor — steam, sauna, cold plunge, infrared.",
      "Body composition and movement assessment on joining.",
      "Coins loaded on day one.",
    ],
  },
  {
    num: "03",
    name: "ELITE",
    line: "The full club.",
    floors: ALL_IN,
    bullets: [
      "All four floors. Every hour.",
      "Preferred coin rates, with earn-back on redemptions.",
      "Priority booking and priority on every waitlist.",
      "Two guest passes every month.",
    ],
  },
  {
    num: "04",
    name: "WELLNESS",
    line: "A coin-led weekly rhythm. Yoga, Pilates, mobility and breathwork. Details to follow.",
    comingSoon: true,
  },
  {
    num: "05",
    name: "COACH",
    line: "The full result.",
    floors: ALL_IN,
    bullets: [
      "All four floors. Every hour.",
      "Personal training included — Trainer, Coach or Director.",
      "Our lowest coin rates, with earn-back.",
      "Priority booking, priority waitlist, two guest passes a month.",
    ],
  },
];

/* Wellness excluded — its details follow; see the footnote. */
const COMPARE_HEADERS = ["PERFORMANCE", "STRENGTH", "ELITE", "COACH"];
const COMPARE_ROWS: [string, string, string, string, string][] = [
  ["Coin rates", "Standard", "Standard", "Preferred", "Lowest"],
  ["Earn-back on redemptions", "—", "—", "Yes", "Yes"],
  ["Personal training", "Add-on", "Add-on", "Add-on", "Included"],
  ["Priority booking & waitlist", "—", "—", "Yes", "Yes"],
  ["Guest passes", "Via coins", "Via coins", "2 / month", "2 / month"],
  ["Members-only events", "—", "—", "Yes", "Yes"],
];

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -15% 0px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/* Three states by SHAPE, not colour alone: included is a solid filled
   chip, via-coins is an outlined chip, not-available is an em-dash. */
function FloorStrip({
  floors,
}: {
  floors: Record<(typeof FLOOR_KEYS)[number], FloorState>;
}) {
  return (
    <div className="mt-6 flex items-center gap-1.5" aria-label="Floor access">
      {FLOOR_KEYS.map((k) => {
        const state = floors[k];
        if (state === "na") {
          return (
            <span
              key={k}
              className="data flex h-7 min-w-9 items-center justify-center text-sm text-stone/50"
              aria-label={`Floor ${k}: not available`}
            >
              —
            </span>
          );
        }
        if (state === "coins") {
          return (
            <span
              key={k}
              className="data flex h-7 min-w-9 items-center justify-center border border-stone px-1 text-xs text-stone"
              aria-label={`Floor ${k}: bookable via coins`}
            >
              {k}
            </span>
          );
        }
        return (
          <span
            key={k}
            className="data flex h-7 min-w-9 items-center justify-center bg-ink px-1 text-xs text-cream"
            aria-label={`Floor ${k}: included`}
          >
            {k}
          </span>
        );
      })}
    </div>
  );
}

export default function Membership() {
  return (
    <section
      id="membership"
      data-theme="cream"
      aria-label="Membership"
      className="relative section-pad bg-cream text-ink"
    >
      <div className="content-wrap">
        <Reveal>
          <h2 className="type-title max-w-[18ch]">Five ways in.</h2>
        </Reveal>
        <Reveal delay={0.06}>
          <p className="type-body mt-6 max-w-[38ch]">
            Start with how you want to train.
          </p>
        </Reveal>

        <div className="mt-20 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {TIERS.map((tier, i) =>
            tier.comingSoon ? (
              /* Wellness is not being sold yet: muted placeholder only —
                 no floor strip, no bullets, no CTA. */
              <Reveal key={tier.name} delay={i * 0.08} className="h-full">
                <div className="h-full border border-ink/10 p-10 opacity-55 md:p-12">
                  <p className="data text-sm text-stone">{tier.num}</p>
                  <h3 className="tier-name mt-3">{tier.name}</h3>
                  <p className="label mt-4 text-stone">Coming soon</p>
                  <p className="mt-6 text-[1.0625rem] leading-[1.6]">
                    {tier.line}
                  </p>
                </div>
              </Reveal>
            ) : (
              <Reveal key={tier.name} delay={i * 0.08} className="h-full">
                <div className="tier-card h-full border border-ink/15 p-10 md:p-12">
                  <p className="data text-sm text-stone">{tier.num}</p>
                  <h3 className="tier-name mt-3">{tier.name}</h3>
                  <p className="mt-3 text-[1.0625rem] leading-[1.6]">
                    {tier.line}
                  </p>
                  {tier.floors && <FloorStrip floors={tier.floors} />}
                  <ul className="mt-8 flex flex-col gap-3">
                    {tier.bullets?.map((b) => (
                      <li key={b} className="text-[1.0625rem] leading-[1.6]">
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            )
          )}
        </div>

        <Reveal delay={0.05}>
          <p className="label mt-8 text-stone">
            Solid — included · Outlined — via coins · — Not available
          </p>
        </Reveal>

        {/* The essence of the comparison; the full matrix lives in the
            brochure. Horizontally scrollable below 768px so nothing
            squashes — comparability is the point of a matrix. */}
        <Reveal delay={0.05}>
          <div className="mt-24">
            <p className="label md:hidden">
              Swipe <span aria-hidden="true">→</span>
            </p>
            <div className="mt-3 overflow-x-auto md:mt-0">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-ink/20">
                    <th className="py-4 pr-4" aria-label="Feature" />
                    {COMPARE_HEADERS.map((h) => (
                      <th key={h} className="label py-4 pr-4 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row) => (
                    <tr key={row[0]} className="border-b border-ink/10">
                      <th className="py-4 pr-4 text-sm font-medium">
                        {row[0]}
                      </th>
                      {row.slice(1).map((cell, ci) => (
                        <td key={ci} className="py-4 pr-4 text-sm">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-stone">
              Wellness details to follow.
            </p>
          </div>
        </Reveal>

        {/* The wallet: coins are currency here — balance, rates,
            earn-back, top up, carry forward. */}
        <Reveal delay={0.05}>
          <div className="mt-24 border border-ink/15 p-10 md:p-12">
            <p className="label text-orange">The Build Wallet</p>
            <p className="type-subhead mt-5 max-w-[34ch]">
              One wallet. The entire club. Loaded on day one, valid for your
              full membership term.
            </p>
            <p className="mt-6 max-w-[52ch] text-[1.0625rem] leading-[1.6]">
              Coins unlock classes, recovery, assessments, guests, gaming and
              the café. Top up any time from the app. Carry forward up to half
              your unused balance on renewal.
            </p>
            <p className="label mt-8 text-stone">
              Train · Move · Recover · Assess · Access
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="mt-8 border border-ink/15 p-10 md:p-12">
            <p className="label">Personal Training</p>
            <p className="data mt-5 text-sm">
              01 Personal Trainer · 02 Coach · 03 Director
            </p>
            <p className="mt-4 max-w-[52ch] text-[1.0625rem] leading-[1.6]">
              Included with Coach. Available as an add-on on every other
              membership.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-24 max-w-[38ch]">
            <p className="type-body">Membership on enquiry.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
