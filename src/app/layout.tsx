import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import Script from "next/script";
import "@/styles/globals.css";

// One typeface, no exceptions. 400 for display/body, 500 for titles/labels.
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute base for OG/Twitter images — WhatsApp link previews resolve
  // against this, and WhatsApp is the distribution channel for this site.
  metadataBase: new URL("https://mdb-phase1-v2-staging-pamd.vercel.app"),
  title: "Maison de Build — A house, not a gym.",
  description:
    "A private house of training. Members only. Four floors. Zero compromise. B Block, Kavuri Hills, Hyderabad.",
  openGraph: {
    title: "Maison de Build — A house, not a gym.",
    description:
      "A private house of training. Members only. Four floors. Zero compromise. B Block, Kavuri Hills, Hyderabad.",
    images: ["/og-image.jpg"],
  },
};

// Placeholder until the client supplies the GA4 ID (Open Decision 6).
const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body>
        {children}
        {GA4_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA4_ID}');`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
