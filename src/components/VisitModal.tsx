"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { getLenis } from "@/lib/scroll";
import LeadFlow from "./LeadFlow";

/**
 * The schedule-a-visit modal. Opened by the Threshold and Nav CTAs via
 * openVisitModal() — a window event, so the triggers stay decoupled from
 * this single mounted instance and the page never scrolls.
 *
 * Accessibility is structural, not decorative: role="dialog",
 * aria-modal, focus trapped inside, Escape closes, focus returns to the
 * triggering button, body scroll locked (with scrollbar compensation so
 * the page never shifts) and Lenis paused while open.
 */

const OPEN_EVENT = "mdb:visit-modal-open";
const EASE: [number, number, number, number] = [0.33, 1, 0.68, 1];

export function openVisitModal() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function VisitModal() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const onOpen = () => {
      openerRef.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;

    const lenis = getLenis();
    lenis?.stop();

    // Scroll lock with scrollbar compensation: the page must not shift.
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPadding = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const nodes = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => el.offsetParent !== null);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const current = document.activeElement;
      if (!panel.contains(current)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && current === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    const focusTimer = requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>("input, button:not([disabled])")
        ?.focus();
    });

    return () => {
      cancelAnimationFrame(focusTimer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPadding;
      lenis?.start();
      openerRef.current?.focus();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
        >
          <div
            className="absolute inset-0 bg-ink/80"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Schedule a visit"
            data-theme="ink"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="relative max-h-[90dvh] w-full max-w-[560px] overflow-y-auto border border-cream/20 bg-ink p-8 text-cream sm:p-12"
          >
            <div className="flex items-start justify-between gap-6">
              <p className="type-subhead">Schedule a visit.</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="label mt-1 text-cream transition-colors duration-300 hover:text-orange"
              >
                Close
              </button>
            </div>
            <div className="mt-10">
              <LeadFlow idPrefix="modal" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
