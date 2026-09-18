/**
 * Server-side device/IP detection for the /downloads redirect.
 * No client-side equivalent needed — this only ever runs in the page's
 * server component render.
 */

export type Platform = "ios" | "android" | "other";

/**
 * Classified from the UA header alone — this runs server-side, before any
 * client JS, so there is no navigator.maxTouchPoints to disambiguate iPadOS
 * (which reports as "Macintosh"). A desktop-Safari-on-iPad visitor lands on
 * the fallback landing page instead of an App Store redirect; rare, and the
 * page still gets them there in one tap.
 */
export function classifyPlatform(userAgent: string): Platform {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "other";
}

/**
 * First hop of x-forwarded-for (the original client, closest to the browser),
 * falling back to x-real-ip. Both are set by essentially every reverse proxy /
 * edge platform; "unknown" only shows up in a raw local dev server with no
 * proxy in front of it.
 */
export function extractClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
