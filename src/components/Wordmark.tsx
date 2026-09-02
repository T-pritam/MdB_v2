import { WORDMARK_PATH, WORDMARK_VIEWBOX } from "@/lib/brand-paths";

/**
 * The drawn MAISON de BUILD wordmark. Artwork, never type.
 * Color comes from currentColor: Cream-on-Ink on dark, Ink-on-Cream on light.
 */
export default function Wordmark({
  className = "",
  decorative = false,
}: {
  className?: string;
  decorative?: boolean;
}) {
  return (
    <svg
      viewBox={WORDMARK_VIEWBOX}
      className={className}
      fill="currentColor"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "Maison de Build"}
      aria-hidden={decorative || undefined}
    >
      <path fillRule="evenodd" d={WORDMARK_PATH} />
    </svg>
  );
}
