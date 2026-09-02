import { CREST_PATH, CREST_VIEWBOX } from "@/lib/brand-paths";

/**
 * The crossed-dumbbell crest with the wordmark beneath. Drawn artwork;
 * color from currentColor per the logo rules.
 */
export default function Crest({
  className = "",
  decorative = true,
}: {
  className?: string;
  decorative?: boolean;
}) {
  return (
    <svg
      viewBox={CREST_VIEWBOX}
      className={className}
      fill="currentColor"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "Maison de Build crest"}
      aria-hidden={decorative || undefined}
    >
      <path fillRule="evenodd" d={CREST_PATH} />
    </svg>
  );
}
