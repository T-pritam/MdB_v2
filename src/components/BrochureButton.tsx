/**
 * The brochure download — a secondary CTA: Ink border, Ink text, no
 * fill; hover fills Ink with Cream text. Downloads the file behind
 * NEXT_PUBLIC_BROCHURE_PATH (the swappable placeholder PDF by default).
 *
 * Placement in page.tsx: TBD — Irfan will confirm the section. For now
 * it renders just above <Footer />.
 */

const BROCHURE_PATH =
  process.env.NEXT_PUBLIC_BROCHURE_PATH || "/brochure/maison-de-build.pdf";

export default function BrochureButton() {
  return (
    <section
      data-theme="cream"
      aria-label="Membership brochure"
      className="relative bg-cream py-16 text-ink"
    >
      <div className="content-wrap flex justify-center">
        <a
          href={BROCHURE_PATH}
          download
          className="label inline-block border border-ink px-8 py-4 text-ink transition-colors duration-300 hover:bg-ink hover:text-cream"
        >
          Download Membership Brochure
        </a>
      </div>
    </section>
  );
}
