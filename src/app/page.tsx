import { CtaSection } from "@/components/cta-section";
import { EmailCapture } from "@/components/email-capture";
import { FounderStory } from "@/components/founder-story";
import { Guarantee } from "@/components/guarantee";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { IntakeFilter } from "@/components/intake-filter";
import { PreLaunchBanner } from "@/components/pre-launch-banner";
import { WhyLevr } from "@/components/why-levr";

export default function Home() {
  return (
    <>
      <PreLaunchBanner />
      <Hero />
      <HowItWorks />
      <IntakeFilter />
      <Guarantee />
      <WhyLevr />
      <FounderStory />
      <CtaSection />
      <EmailCapture />
    </>
  );
}
