import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { classifyPlatform, extractClientIp } from "@/lib/deviceDetect";
import { recordAppDownload } from "@/lib/downloadsBackend";
import Wordmark from "@/components/Wordmark";

/**
 * maisondebuild.com/downloads — the single link behind the QR code and every
 * "Get the app" button on the site.
 *
 * iOS / Android: records the hit (server-to-server, best-effort — see
 * downloadsBackend.ts) then redirects straight to that store listing.
 * Anything else (desktop, an unrecognised UA): no store to guess, so this
 * renders a small branded landing with both links instead.
 *
 * Must stay dynamic — the redirect depends on the request's own UA/IP, so
 * this can never be statically prerendered or cached.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const APPLE_URL = "https://apps.apple.com/app/id6792065211";
const PLAY_URL = "https://play.google.com/store/apps/details?id=com.buildgym.app";

export default async function DownloadsPage() {
  const h = await headers();
  const userAgent = h.get("user-agent") ?? "";
  const platform = classifyPlatform(userAgent);

  if (platform === "ios" || platform === "android") {
    const ip = extractClientIp(h);
    await recordAppDownload(platform, ip, userAgent);
    redirect(platform === "ios" ? APPLE_URL : PLAY_URL);
  }

  return (
    <main
      data-theme="ink"
      className="flex min-h-dvh flex-col items-center justify-center bg-ink px-6 py-20 text-center text-cream"
    >
      <div className="w-[min(60vw,220px)] text-cream" aria-hidden="true">
        <Wordmark className="h-auto w-full" decorative />
      </div>

      <p className="type-subhead mt-12 max-w-[26ch]">
        Get the Build Gym app.
      </p>
      <p className="type-body mt-4 max-w-[38ch] text-cream/70">
        Book a bay, see your programme, and read your own record — every
        session, every lift.
      </p>

      <div className="mt-12 h-px w-10 bg-orange" aria-hidden="true" />

      <div className="mt-12 flex flex-wrap justify-center gap-5">
        <a
          href={APPLE_URL}
          className="label inline-block border border-cream/30 px-8 py-4 text-cream transition-colors duration-300 hover:border-orange"
        >
          App Store
        </a>
        <a
          href={PLAY_URL}
          className="label inline-block border border-cream/30 px-8 py-4 text-cream transition-colors duration-300 hover:border-orange"
        >
          Google Play
        </a>
      </div>
    </main>
  );
}
