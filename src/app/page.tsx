import { ComparisonTable } from "@/components/comparison-table";
import { CtaSection } from "@/components/cta-section";
import { EmailCapture } from "@/components/email-capture";
import { FounderStory } from "@/components/founder-story";
import { Guarantee } from "@/components/guarantee";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { IntakeFilter } from "@/components/intake-filter";
import { getIntakeMakeModelOptions, getIntakeModelYearOptions } from "@/lib/intake-vehicle-options";
import { PreLaunchBanner } from "@/components/pre-launch-banner";
import { WhyLevr } from "@/components/why-levr";

// async so intake's Make/Model options can be read from the promoted
// vehicle dataset server-side, then passed down -- same server-fetch-then-
// props shape /matchmaker/page.tsx already uses for the same data source.
export default async function Home() {
  // Both read the same cached scan of the live batch -- one query, not two.
  const [makeModelOptions, modelYearOptions] = await Promise.all([
    getIntakeMakeModelOptions(),
    getIntakeModelYearOptions(),
  ]);
  return (
    <>
      <PreLaunchBanner />
      <Hero />
      <HowItWorks />
      <IntakeFilter makeModelOptions={makeModelOptions} modelYearOptions={modelYearOptions} />
      <Guarantee />
      <WhyLevr />
      <ComparisonTable />
      <FounderStory />
      <CtaSection />
      <EmailCapture />
    </>
  );
}
