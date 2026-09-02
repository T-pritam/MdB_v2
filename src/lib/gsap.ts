import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
  if (process.env.NODE_ENV === "development") {
    // Debug aid: lets browser automation inspect trigger positions.
    (window as unknown as Record<string, unknown>).__ST = ScrollTrigger;
  }
}

export { gsap, ScrollTrigger, useGSAP };
