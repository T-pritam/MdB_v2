import type { Platform } from "./deviceDetect";

/**
 * Server-to-server bridge from /downloads to Build_GYM_Backend's click
 * counter (POST /api/app-downloads/record). Never called from the browser —
 * BUILD_GYM_BACKEND_URL and WEBSITE_DOWNLOADS_SECRET stay server-side.
 *
 * Best-effort only: any failure (unconfigured, network, non-2xx, timeout) is
 * logged and swallowed. The visitor's redirect to the store must never wait
 * on, or fail because of, the counter.
 */
export async function recordAppDownload(
  platform: Exclude<Platform, "other">,
  ip: string,
  userAgent: string
): Promise<void> {
  const backendUrl = process.env.BUILD_GYM_BACKEND_URL;
  const secret = process.env.WEBSITE_DOWNLOADS_SECRET;

  if (!backendUrl || !secret) {
    console.warn("[downloads] backend not configured — skipping count");
    return;
  }

  try {
    const res = await fetch(`${backendUrl.replace(/\/$/, "")}/api/app-downloads/record`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": secret,
        "X-Forwarded-For": ip,
        "X-Client-User-Agent": userAgent.slice(0, 300),
      },
      body: JSON.stringify({ platform }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      console.error("[downloads] record failed:", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("[downloads] record error:", err);
  }
}
