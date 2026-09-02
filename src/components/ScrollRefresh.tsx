"use client";

import { useEffect } from "react";
import { ScrollTrigger } from "@/lib/gsap";

/**
 * Mounted after every section: runs one full ScrollTrigger refresh once all
 * triggers exist, so positions account for the Five Floors pin spacer no
 * matter how hydration timing falls against the window load event. Without
 * this, triggers created before the pin keep pre-spacer positions.
 */
export default function ScrollRefresh() {
  useEffect(() => {
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, []);
  return null;
}
