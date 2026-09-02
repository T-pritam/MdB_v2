import type Lenis from "lenis";

let lenisInstance: Lenis | null = null;

export function setLenis(lenis: Lenis | null) {
  lenisInstance = lenis;
}

export function getLenis(): Lenis | null {
  return lenisInstance;
}

export function scrollToId(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  if (lenisInstance) {
    lenisInstance.scrollTo(target, { duration: 1.4 });
  } else {
    target.scrollIntoView({ behavior: "smooth" });
  }
}
