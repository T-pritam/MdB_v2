import SmoothScroll from "@/components/SmoothScroll";
import ScrollProgress from "@/components/ScrollProgress";
import CustomCursor from "@/components/CustomCursor";
import Nav from "@/components/Nav";
import ScrollGate from "@/components/ScrollGate";
import BrochureButton from "@/components/BrochureButton";
import Threshold from "@/components/Threshold";
import StoryHouse from "@/components/StoryHouse";
import Marquee from "@/components/Marquee";
import FiveFloors from "@/components/FiveFloors";
import Activities from "@/components/Activities";
import Gallery from "@/components/Gallery";
import Membership from "@/components/Membership";
import AppInstall from "@/components/AppInstall";
import FounderClose from "@/components/FounderClose";
import Footer from "@/components/Footer";
import ScrollRefresh from "@/components/ScrollRefresh";
import AccentLine from "@/components/AccentLine";

/**
 * The conversion-first spine: Threshold · Five Floors · Activities ·
 * Gallery · Marquee · Membership · Story · App ·
 * Founder/Close · accent · Footer. The house and the offer lead; the
 * narrative and proof follow for the visitor who keeps reading.
 * (Manifesto was folded into Threshold; the inline Visit section was
 * removed — the gate captures details up front; the Schedule-a-visit
 * CTAs and their modal were removed sitewide at the client's request,
 * so VisitModal/LeadFlow are unmounted; the Method/Numbers section was
 * cancelled by the client.)
 */
export default function Home() {
  return (
    <>
      <ScrollGate />
      <SmoothScroll />
      <ScrollProgress />
      <CustomCursor />
      <Nav />
      <main>
        <Threshold />
        <FiveFloors />
        <Activities />
        <Gallery />
        <Marquee />
        <Membership />
        <StoryHouse />
        <AppInstall />
        <FounderClose />
        <AccentLine theme="cream" text="Every seat coached. Every rep on record." />
        {/* Placement TBD — Irfan to confirm the section; above the footer for now. */}
        <BrochureButton />
      </main>
      <Footer />
      <div className="grain" aria-hidden="true" />
      <ScrollRefresh />
    </>
  );
}
