import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { CAPTIONS_TOOL, extractCaptions, type PlatformCaptions } from "@/lib/caption-tool";
import { chicagoTimeToUtc } from "@/lib/timezone";
import { THEMES, applicablePlatforms, weekStartFor, addDaysToDateString, type Theme } from "@/lib/social-schedule";

export type GenerateSocialPostResult = { ok: true } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Research + cleanup, shared by the 3 research-dependent themes
// (spotlight_monday, throwback_thursday, news_recap_saturday).
// ---------------------------------------------------------------------------

/**
 * System prompt reviewed and approved by Brett verbatim -- do not edit the
 * wording without going back through review. Deliberately NOT a reuse of
 * article-generation.ts's already-approved cleanup prompt (that one is
 * worded specifically around "a freshly-drafted blog article's body text")
 * -- this is a new, analogous prompt scoped to research summaries, so no
 * already-approved wording is silently touched.
 */
const CLEANUP_SYSTEM_PROMPT =
  "You clean up a freshly-drafted research summary. The draft may contain a leading meta-commentary " +
  'sentence or two before the real content starts (e.g., a stray remark like "I found some good ' +
  'material" or "Here\'s what I found"), left over from an earlier drafting step. Remove only that ' +
  "kind of leading commentary — do not rewrite, shorten, rephrase, or otherwise change anything " +
  "about the actual research content itself. If there's no such leading commentary, return the text " +
  "completely unchanged. Always respond by calling the clean_research_text tool.";

const CLEANUP_TOOL: Anthropic.Tool = {
  name: "clean_research_text",
  description: "Return a research summary with any leading meta-commentary preamble removed.",
  input_schema: {
    type: "object",
    properties: {
      cleaned_content: { type: "string" },
    },
    required: ["cleaned_content"],
  },
};

async function cleanResearchText(rawText: string): Promise<string> {
  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    system: CLEANUP_SYSTEM_PROMPT,
    tools: [CLEANUP_TOOL],
    tool_choice: { type: "tool", name: "clean_research_text" },
    messages: [{ role: "user", content: rawText }],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === "clean_research_text"
  );

  if (!toolUse || typeof toolUse.input !== "object" || toolUse.input === null) {
    throw new Error("Claude didn't return cleaned research text.");
  }

  const cleaned = String((toolUse.input as Record<string, unknown>).cleaned_content ?? "").trim();
  if (!cleaned) {
    throw new Error("Cleanup returned empty content.");
  }
  return cleaned;
}

/**
 * Web-search-grounded research call, no forced tool_choice (so the model
 * can call web_search before answering), followed by the cleanup call.
 * Same last-tool-block extraction fix already proven necessary for article
 * generation -- a multi-round web_search turn can leave interim commentary
 * text blocks between search rounds, so only text emitted after the last
 * tool interaction is taken.
 */
async function researchTopic(systemPrompt: string, userPrompt: string): Promise<string> {
  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 3000,
    system: systemPrompt,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
    messages: [{ role: "user", content: userPrompt }],
  });

  if (message.stop_reason === "max_tokens") {
    throw new Error("Research was truncated (hit max_tokens) before finishing.");
  }

  const lastToolIndex = message.content.reduce(
    (last, block, i) => (block.type === "server_tool_use" || block.type === "web_search_tool_result" ? i : last),
    -1
  );

  const text = message.content
    .slice(lastToolIndex + 1)
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n\n")
    .trim();

  if (!text) {
    throw new Error("Claude returned no research text.");
  }

  return cleanResearchText(text);
}

/**
 * `theme` determines which fields are actually validated non-empty
 * (applicablePlatforms(theme)) -- the two weekend themes ask the model for
 * a LinkedIn caption "anyway" purely to keep the tool schema uniform, but
 * it's discarded downstream (no LinkedIn slot exists for them), so an
 * empty one there shouldn't fail the whole generation the way a genuinely
 * missing X/Facebook/Instagram caption -- or a missing weekday LinkedIn
 * caption -- should.
 */
async function generateCaptions(systemPrompt: string, userContent: string, theme: Theme): Promise<PlatformCaptions> {
  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    system: systemPrompt,
    tools: [CAPTIONS_TOOL],
    tool_choice: { type: "tool", name: "generate_social_captions" },
    messages: [{ role: "user", content: userContent }],
  });

  return extractCaptions(message, applicablePlatforms(theme));
}

// ---------------------------------------------------------------------------
// Spotlight Monday
// ---------------------------------------------------------------------------

const SPOTLIGHT_MONDAY_RESEARCH_PROMPT =
  "You are researching one specific new vehicle for a \"Spotlight Monday\" social media feature for " +
  "LEVR Auto, a nationwide car-buying negotiation service. Pick one specific, currently-available " +
  "new vehicle (a real make, model, and model year) that's genuinely interesting this week — " +
  "something newly redesigned, unusually popular, a strong value pick, or otherwise worth " +
  "spotlighting. Use the web_search tool to find real, current, accurate facts: starting MSRP, key " +
  "specs (powertrain, range or MPG, standout features), and what makes it stand out. Write a short " +
  "research summary (3–5 sentences) covering the vehicle and the real facts you found — this is raw " +
  "material for a social caption, not the caption itself. Never state a specific number or spec you " +
  "haven't actually found via search.";

const SPOTLIGHT_MONDAY_CAPTIONS_PROMPT =
  "You write social media captions for LEVR Auto's \"Spotlight Monday\" feature, highlighting one " +
  "specific new vehicle's real specs and appeal. You'll be given a short research summary about the " +
  "vehicle to work from. Write one caption per platform: X, Facebook, Instagram, and LinkedIn " +
  "(LinkedIn may be discarded if this falls on a weekend, but generate it anyway). Ground every " +
  "specific fact (price, specs) only in what's given to you in the research summary — never invent " +
  "or add a number that isn't there. Match LEVR Auto's plain, direct voice — no hype-filled " +
  "marketing language. Platform conventions: X — short and punchy, well under 280 characters, 0–2 " +
  "hashtags. Facebook — conversational, 1–3 short sentences. Instagram — similar to Facebook but " +
  "more casual, 2–4 relevant hashtags. LinkedIn — more professional, can be a bit longer. None " +
  "should sound like generic marketing copy. Always respond by calling the generate_social_captions " +
  "tool.";

async function generateSpotlightMondayCaptions(): Promise<PlatformCaptions> {
  const research = await researchTopic(SPOTLIGHT_MONDAY_RESEARCH_PROMPT, "Research a vehicle to spotlight this week.");
  return generateCaptions(SPOTLIGHT_MONDAY_CAPTIONS_PROMPT, `Research summary:\n\n${research}`, "spotlight_monday");
}

// ---------------------------------------------------------------------------
// Ask-Around Tuesday
// ---------------------------------------------------------------------------

const ASK_AROUND_TUESDAY_CAPTIONS_PROMPT =
  "You write social media captions for LEVR Auto's \"Ask-Around Tuesday\" feature — a genuine " +
  "engagement question about cars or car-buying, meant to get real people commenting with their own " +
  "opinions (favorite road trip car, most annoying dealership experience, dream car, etc.). Write " +
  "one caption per platform: X, Facebook, Instagram, and LinkedIn. Each should ask essentially the " +
  "same underlying question, phrased naturally for that platform's voice and length. Keep it light, " +
  "genuinely curious, and easy to answer in one line — not a survey, not a sales pitch. Match LEVR " +
  "Auto's plain, direct voice. Platform conventions: X — short and punchy, well under 280 " +
  "characters. Facebook — conversational, inviting. Instagram — casual, 1–3 relevant hashtags. " +
  "LinkedIn — can lean slightly more toward a professional/industry angle (e.g. car-buying " +
  "experiences) while still being a real question. Always respond by calling the " +
  "generate_social_captions tool.";

async function generateAskAroundTuesdayCaptions(): Promise<PlatformCaptions> {
  return generateCaptions(ASK_AROUND_TUESDAY_CAPTIONS_PROMPT, "Generate this week's Ask-Around Tuesday engagement question.", "ask_around_tuesday");
}

// ---------------------------------------------------------------------------
// Customer Testimonial -- real data, select vs. build kept structurally
// separate (see the module-level comment near generateWeeklySocialBatch).
// ---------------------------------------------------------------------------

const CUSTOMER_TESTIMONIAL_CAPTIONS_PROMPT =
  "You write social media captions for LEVR Auto's \"Customer Testimonial\" feature, sharing a real " +
  "customer's rating and comment about their experience with LEVR Auto. You'll be given the real " +
  "star rating, the real comment text, and the vehicle make/model they bought — use only what's " +
  "given, never invent additional details, and never include the customer's name or any identifying " +
  "details (none will be given to you). Write one caption per platform: X, Facebook, Instagram, and " +
  "LinkedIn, each featuring the real comment (quoted or lightly paraphrased, never altering its " +
  "meaning) with light framing around it. Match LEVR Auto's plain, direct voice — let the real " +
  "testimonial carry the weight, don't oversell it. Platform conventions: X — short and punchy, " +
  "well under 280 characters. Facebook — conversational, can include a bit more of the quote. " +
  "Instagram — similar tone, 2–3 relevant hashtags. LinkedIn — slightly more professional framing. " +
  "Always respond by calling the generate_social_captions tool.";

export interface TestimonialSource {
  surveyId: string;
  rating: number;
  comment: string;
  make: string;
  model: string;
}

/**
 * SELECTION query -- picks which real testimonial this week's post will
 * feature. Only ever called by generateWeeklySocialBatch. Regenerate never
 * calls this -- it re-fetches the already-selected source directly by id
 * (buildTestimonialSource), so a re-run can never surface different real
 * data, only re-word the same data.
 */
async function selectTestimonialForWeek(weekDataStartIso: string, weekDataEndIso: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("post_deal_surveys")
    .select("id, levr_overall_rating, levr_overall_comment, submitted_at")
    .not("submitted_at", "is", null)
    .gte("submitted_at", weekDataStartIso)
    .lt("submitted_at", weekDataEndIso)
    .not("levr_overall_comment", "is", null)
    .gte("levr_overall_rating", 4)
    .order("levr_overall_rating", { ascending: false })
    .order("submitted_at", { ascending: false });

  const winner = (data ?? []).find((s) => (s.levr_overall_comment ?? "").trim().length > 0);
  return winner?.id ?? null;
}

/**
 * Builds full caption context from an already-known survey id -- called
 * right after selection in the batch path, and directly by Regenerate
 * (never re-selecting).
 */
async function buildTestimonialSource(surveyId: string): Promise<TestimonialSource | null> {
  const admin = createAdminClient();
  const { data: survey } = await admin
    .from("post_deal_surveys")
    .select("id, customer_search_id, levr_overall_rating, levr_overall_comment")
    .eq("id", surveyId)
    .maybeSingle();

  if (!survey || survey.levr_overall_rating === null || !survey.levr_overall_comment) return null;

  const { data: search } = await admin
    .from("customer_searches")
    .select("make, model")
    .eq("id", survey.customer_search_id)
    .maybeSingle();

  if (!search) return null;

  return {
    surveyId: survey.id,
    rating: survey.levr_overall_rating,
    comment: survey.levr_overall_comment,
    make: search.make,
    model: search.model,
  };
}

async function generateTestimonialCaptions(source: TestimonialSource): Promise<PlatformCaptions> {
  const context =
    `Star rating: ${source.rating}/5\n` +
    `Vehicle purchased: ${source.make} ${source.model}\n` +
    `Customer comment: "${source.comment}"`;
  return generateCaptions(CUSTOMER_TESTIMONIAL_CAPTIONS_PROMPT, context, "customer_testimonial");
}

// ---------------------------------------------------------------------------
// Throwback Thursday
// ---------------------------------------------------------------------------

const THROWBACK_THURSDAY_RESEARCH_PROMPT =
  "You are researching a \"Throwback Thursday\" automotive history fact for LEVR Auto's social " +
  "media, ideally tied to this week's actual date (an \"on this day in automotive history\" angle) " +
  "if a genuinely interesting one exists, or otherwise any real, verifiable automotive history story " +
  "worth sharing. Use the web_search tool to find a real, accurate historical fact or story — a " +
  "landmark car launch, a notable automotive milestone, an interesting bit of industry history. " +
  "Write a short research summary (3–5 sentences) covering what you found and why it's interesting " +
  "— this is raw material for a social caption, not the caption itself. Never state a specific date, " +
  "name, or fact you haven't actually verified via search.";

const THROWBACK_THURSDAY_CAPTIONS_PROMPT =
  "You write social media captions for LEVR Auto's \"Throwback Thursday\" feature, sharing a real " +
  "piece of automotive history. You'll be given a short research summary to work from. Write one " +
  "caption per platform: X, Facebook, Instagram, and LinkedIn. Ground every specific fact (dates, " +
  "names, details) only in what's given to you in the research summary — never invent or add a " +
  "detail that isn't there. Match LEVR Auto's plain, direct voice — genuinely interesting, not a dry " +
  "trivia recitation. Platform conventions: X — short and punchy, well under 280 characters, can use " +
  "a #tbt-style hashtag. Facebook — conversational, a bit more storytelling room. Instagram — " +
  "similar tone, 2–4 relevant hashtags. LinkedIn — can frame around the industry/business angle of " +
  "the history. Always respond by calling the generate_social_captions tool.";

async function generateThrowbackThursdayCaptions(): Promise<PlatformCaptions> {
  const research = await researchTopic(
    THROWBACK_THURSDAY_RESEARCH_PROMPT,
    "Research an automotive history story for this week."
  );
  return generateCaptions(THROWBACK_THURSDAY_CAPTIONS_PROMPT, `Research summary:\n\n${research}`, "throwback_thursday");
}

// ---------------------------------------------------------------------------
// Deal of the Week -- real data, select vs. build kept structurally
// separate, same reasoning as Customer Testimonial above.
// ---------------------------------------------------------------------------

const DEAL_OF_THE_WEEK_CAPTIONS_PROMPT =
  "You write social media captions for LEVR Auto's \"Deal of the Week\" feature, announcing a real " +
  "deal LEVR closed for a customer this week. You'll be given the real vehicle make/model, the real " +
  "MSRP, and the real discount amount below MSRP — use only these facts, never invent additional " +
  "details, and never include any customer name, location, or identifying detail (none will be given " +
  "to you, and none should ever be implied). Write one caption per platform: X, Facebook, Instagram, " +
  "and LinkedIn, each highlighting the real discount as proof of LEVR's negotiation work. Match LEVR " +
  "Auto's plain, direct voice — no hype, let the real number speak for itself. Platform conventions: " +
  "X — short and punchy, well under 280 characters. Facebook — conversational, can restate the " +
  "discount clearly. Instagram — similar tone, 2–4 relevant hashtags. LinkedIn — can frame around " +
  "the practical value/proof-of-results angle. Always respond by calling the generate_social_captions " +
  "tool.";

export interface DealSource {
  searchId: string;
  make: string;
  model: string;
  trim: string | null;
  msrpCents: number;
  offerPriceCents: number;
}

/**
 * SELECTION query -- picks which real closed deal this week's post will
 * feature. Only ever called by generateWeeklySocialBatch, same rule as
 * selectTestimonialForWeek above. Never selects customer name, email, or
 * zip -- structurally impossible to leak, not just a formatting discipline.
 */
async function selectDealForWeek(weekDataStartIso: string, weekDataEndIso: string): Promise<string | null> {
  const admin = createAdminClient();

  const { data: searches } = await admin
    .from("customer_searches")
    .select("id, purchased_at, purchased_qualifying_offer_id")
    .eq("search_status", "purchased")
    .gte("purchased_at", weekDataStartIso)
    .lt("purchased_at", weekDataEndIso)
    .not("purchased_qualifying_offer_id", "is", null);

  if (!searches || searches.length === 0) return null;

  const offerIds = searches.map((s) => s.purchased_qualifying_offer_id as string);
  const { data: offers } = await admin
    .from("qualifying_offers")
    .select("id, offer_price_cents, msrp_cents, is_below_msrp")
    .in("id", offerIds)
    .eq("is_below_msrp", true);

  const offerById = new Map((offers ?? []).map((o) => [o.id, o]));

  let best: { searchId: string; discountCents: number } | null = null;
  for (const search of searches) {
    const offer = offerById.get(search.purchased_qualifying_offer_id as string);
    if (!offer) continue;
    const discountCents = offer.msrp_cents - offer.offer_price_cents;
    if (!best || discountCents > best.discountCents) {
      best = { searchId: search.id, discountCents };
    }
  }

  return best?.searchId ?? null;
}

/**
 * Builds full caption context from an already-known search id -- called
 * right after selection in the batch path, and directly by Regenerate
 * (never re-selecting). Re-verifies is_below_msrp itself rather than
 * trusting the earlier selection, in case the underlying offer somehow
 * changed between selection and a later regenerate.
 */
async function buildDealSource(searchId: string): Promise<DealSource | null> {
  const admin = createAdminClient();
  const { data: search } = await admin
    .from("customer_searches")
    .select("id, make, model, trim, purchased_qualifying_offer_id")
    .eq("id", searchId)
    .maybeSingle();

  if (!search || !search.purchased_qualifying_offer_id) return null;

  const { data: offer } = await admin
    .from("qualifying_offers")
    .select("offer_price_cents, msrp_cents, is_below_msrp")
    .eq("id", search.purchased_qualifying_offer_id)
    .maybeSingle();

  if (!offer || !offer.is_below_msrp) return null;

  return {
    searchId: search.id,
    make: search.make,
    model: search.model,
    trim: search.trim,
    msrpCents: offer.msrp_cents,
    offerPriceCents: offer.offer_price_cents,
  };
}

async function generateDealCaptions(source: DealSource): Promise<PlatformCaptions> {
  const discountDollars = ((source.msrpCents - source.offerPriceCents) / 100).toFixed(0);
  const msrpDollars = (source.msrpCents / 100).toFixed(0);
  const vehicleLabel = [source.make, source.model, source.trim].filter(Boolean).join(" ");
  const context = `Vehicle: ${vehicleLabel}\nMSRP: $${msrpDollars}\nDiscount below MSRP: $${discountDollars}`;
  return generateCaptions(DEAL_OF_THE_WEEK_CAPTIONS_PROMPT, context, "deal_of_the_week");
}

// ---------------------------------------------------------------------------
// News Recap Saturday
// ---------------------------------------------------------------------------

const NEWS_RECAP_SATURDAY_RESEARCH_PROMPT =
  "You are researching the single most interesting real automotive news story from the past 7 days " +
  "for LEVR Auto's \"News Recap Saturday\" social media feature. Use the web_search tool to find " +
  "real, current automotive industry news — new model announcements, pricing changes, industry " +
  "trends, recalls, or other genuinely newsworthy stories from the past week. Pick the one story " +
  "most relevant and interesting to someone shopping for a new car. Write a short research summary " +
  "(3–5 sentences) covering the story and the real facts you found — this is raw material for a " +
  "social caption, not the caption itself. Never state a specific number, date, or fact you haven't " +
  "actually found via search.";

const NEWS_RECAP_SATURDAY_CAPTIONS_PROMPT =
  "You write social media captions for LEVR Auto's \"News Recap Saturday\" feature, sharing the most " +
  "interesting real automotive news story from the past week. You'll be given a short research " +
  "summary to work from. Write one caption per platform: X, Facebook, Instagram, and LinkedIn. " +
  "Ground every specific fact only in what's given to you in the research summary — never invent or " +
  "add a detail that isn't there. Match LEVR Auto's plain, direct voice. Platform conventions: X — " +
  "short and punchy, well under 280 characters, news-headline energy. Facebook — conversational, a " +
  "bit more context. Instagram — similar tone, 2–4 relevant hashtags. LinkedIn — can frame around " +
  "the industry/business implications. Always respond by calling the generate_social_captions tool.";

async function generateNewsRecapSaturdayCaptions(): Promise<PlatformCaptions> {
  const research = await researchTopic(
    NEWS_RECAP_SATURDAY_RESEARCH_PROMPT,
    "Research the most interesting automotive news story from the past 7 days."
  );
  return generateCaptions(NEWS_RECAP_SATURDAY_CAPTIONS_PROMPT, `Research summary:\n\n${research}`, "news_recap_saturday");
}

// ---------------------------------------------------------------------------
// Sunday Question
// ---------------------------------------------------------------------------

const SUNDAY_QUESTION_CAPTIONS_PROMPT =
  "You write social media captions for LEVR Auto's \"Sunday Question\" feature — a light, personal " +
  "engagement prompt, less car-specific than Ask-Around Tuesday and more about weekend/lifestyle " +
  "vibes with a car-adjacent angle (best road trip destination, car you learned to drive in, weekend " +
  "errands playlist, etc.). Write one caption per platform: X, Facebook, Instagram, and LinkedIn " +
  "(LinkedIn may be discarded since this falls on a weekend, but generate it anyway). Keep it " +
  "genuinely light and easy to answer in one line. Match LEVR Auto's plain, direct voice — friendly, " +
  "not salesy, no need to mention LEVR's service directly. Platform conventions: X — short and " +
  "punchy, well under 280 characters. Facebook — warm, conversational. Instagram — casual, 1–3 " +
  "relevant hashtags. LinkedIn — tone doesn't matter much since it won't actually post, just keep it " +
  "consistent. Always respond by calling the generate_social_captions tool.";

async function generateSundayQuestionCaptions(): Promise<PlatformCaptions> {
  return generateCaptions(SUNDAY_QUESTION_CAPTIONS_PROMPT, "Generate this week's Sunday Question.", "sunday_question");
}

// ---------------------------------------------------------------------------
// Shared dispatch for the 5 non-data themes (spotlight/throwback/news/
// ask-around/sunday) -- used by both the batch orchestrator and Regenerate.
// customer_testimonial/deal_of_the_week are deliberately excluded from this
// signature -- they need real source data threaded through, handled by
// their own dedicated branches in each caller instead.
// ---------------------------------------------------------------------------

type NonDataTheme = Exclude<Theme, "customer_testimonial" | "deal_of_the_week">;

async function generateCaptionsForNonDataTheme(theme: NonDataTheme): Promise<PlatformCaptions> {
  switch (theme) {
    case "spotlight_monday":
      return generateSpotlightMondayCaptions();
    case "ask_around_tuesday":
      return generateAskAroundTuesdayCaptions();
    case "throwback_thursday":
      return generateThrowbackThursdayCaptions();
    case "news_recap_saturday":
      return generateNewsRecapSaturdayCaptions();
    case "sunday_question":
      return generateSundayQuestionCaptions();
  }
}

function isNonDataTheme(theme: Theme): theme is NonDataTheme {
  return theme !== "customer_testimonial" && theme !== "deal_of_the_week";
}

// ---------------------------------------------------------------------------
// Weekly batch orchestrator (cron entry point)
// ---------------------------------------------------------------------------

export interface GenerateWeeklyBatchSummary {
  generated: Theme[];
  skipped: Theme[];
  errors: { theme: Theme; error: string }[];
}

/**
 * Targets exactly one deterministic week per run -- unlike articles'
 * month-ahead pre-seeding, there's nothing to search across multiple
 * candidate rows for. weekStartFor(referenceDate) resolves to the Monday
 * of the week containing referenceDate ("the week just ending" when run on
 * its real Sunday-evening schedule); posts are generated for the following
 * Monday (postingWeekStart), and Testimonial/Deal-of-the-Week pull real
 * data from the just-completed week (dataWeekStart through dataWeekStart+7).
 * Idempotent per theme via a pre-check against the unique (theme,
 * week_start) constraint -- a theme that already has a row for the target
 * week is skipped, not overwritten (Regenerate is the explicit, agent-
 * triggered way to redo one).
 */
export async function generateWeeklySocialBatch(referenceDate: Date = new Date()): Promise<GenerateWeeklyBatchSummary> {
  const admin = createAdminClient();
  const summary: GenerateWeeklyBatchSummary = { generated: [], skipped: [], errors: [] };

  const dataWeekStart = weekStartFor(referenceDate);
  const postingWeekStart = addDaysToDateString(dataWeekStart, 7);
  const weekDataStartIso = chicagoTimeToUtc(dataWeekStart, 0, 0).toISOString();
  const weekDataEndIso = chicagoTimeToUtc(addDaysToDateString(dataWeekStart, 7), 0, 0).toISOString();

  for (const theme of THEMES) {
    try {
      const { data: existing } = await admin
        .from("social_posts")
        .select("id")
        .eq("theme", theme)
        .eq("week_start", postingWeekStart)
        .maybeSingle();

      if (existing) {
        summary.skipped.push(theme);
        continue;
      }

      let captions: PlatformCaptions;
      let sourceSurveyId: string | null = null;
      let sourceSearchId: string | null = null;

      if (theme === "customer_testimonial") {
        const surveyId = await selectTestimonialForWeek(weekDataStartIso, weekDataEndIso);
        if (!surveyId) {
          summary.skipped.push(theme);
          continue;
        }
        const source = await buildTestimonialSource(surveyId);
        if (!source) {
          summary.skipped.push(theme);
          continue;
        }
        captions = await generateTestimonialCaptions(source);
        sourceSurveyId = surveyId;
      } else if (theme === "deal_of_the_week") {
        const searchId = await selectDealForWeek(weekDataStartIso, weekDataEndIso);
        if (!searchId) {
          summary.skipped.push(theme);
          continue;
        }
        const source = await buildDealSource(searchId);
        if (!source) {
          summary.skipped.push(theme);
          continue;
        }
        captions = await generateDealCaptions(source);
        sourceSearchId = searchId;
      } else {
        captions = await generateCaptionsForNonDataTheme(theme);
      }

      const includesLinkedin = applicablePlatforms(theme).includes("linkedin");

      const { error } = await admin.from("social_posts").insert({
        theme,
        week_start: postingWeekStart,
        status: "draft",
        caption_x: captions.x,
        caption_facebook: captions.facebook,
        caption_instagram: captions.instagram,
        caption_linkedin: includesLinkedin ? captions.linkedin : null,
        source_post_deal_survey_id: sourceSurveyId,
        source_customer_search_id: sourceSearchId,
      });

      if (error) {
        summary.errors.push({ theme, error: error.message });
      } else {
        summary.generated.push(theme);
      }
    } catch (err) {
      summary.errors.push({ theme, error: err instanceof Error ? err.message : "Generation failed." });
    }
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Regenerate (agent-triggered, one post at a time)
// ---------------------------------------------------------------------------

/**
 * Re-runs generation for one existing social_posts row, in place.
 *
 * For customer_testimonial/deal_of_the_week: re-fetches the SAME
 * already-selected source row via the row's own stored
 * source_post_deal_survey_id/source_customer_search_id
 * (buildTestimonialSource/buildDealSource) and re-runs only the captions
 * call against it -- selectTestimonialForWeek/selectDealForWeek (the
 * selection queries) are never called here, so a Regenerate can only ever
 * produce different wording of the same real facts, never surface a
 * different testimonial or deal.
 *
 * For the 5 non-data themes: re-runs the full pipeline (research + cleanup
 * + captions, or captions alone) via the same shared dispatch the weekly
 * batch uses -- there's no "selected source" to hold constant for these,
 * each attempt is genuinely fresh, same as article Regenerate.
 */
export async function regenerateSocialPostContent(postId: string): Promise<GenerateSocialPostResult> {
  const admin = createAdminClient();

  const { data: post, error: fetchError } = await admin
    .from("social_posts")
    .select("id, theme, source_post_deal_survey_id, source_customer_search_id")
    .eq("id", postId)
    .maybeSingle();

  if (fetchError || !post) {
    return { ok: false, error: "Post not found." };
  }

  const theme = post.theme as Theme;
  let captions: PlatformCaptions;

  try {
    if (theme === "customer_testimonial") {
      if (!post.source_post_deal_survey_id) {
        return { ok: false, error: "No source testimonial recorded for this post." };
      }
      const source = await buildTestimonialSource(post.source_post_deal_survey_id);
      if (!source) {
        return { ok: false, error: "The original testimonial is no longer available." };
      }
      captions = await generateTestimonialCaptions(source);
    } else if (theme === "deal_of_the_week") {
      if (!post.source_customer_search_id) {
        return { ok: false, error: "No source deal recorded for this post." };
      }
      const source = await buildDealSource(post.source_customer_search_id);
      if (!source) {
        return { ok: false, error: "The original deal is no longer available." };
      }
      captions = await generateDealCaptions(source);
    } else if (isNonDataTheme(theme)) {
      captions = await generateCaptionsForNonDataTheme(theme);
    } else {
      return { ok: false, error: "Unknown theme." };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Generation failed." };
  }

  const includesLinkedin = applicablePlatforms(theme).includes("linkedin");

  const { error: updateError } = await admin
    .from("social_posts")
    .update({
      caption_x: captions.x,
      caption_facebook: captions.facebook,
      caption_instagram: captions.instagram,
      caption_linkedin: includesLinkedin ? captions.linkedin : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);

  if (updateError) {
    return { ok: false, error: `Generated but failed to save: ${updateError.message}` };
  }

  return { ok: true };
}
