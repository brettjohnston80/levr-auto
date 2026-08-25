import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublishedArticles } from "@/lib/articles";
import { scheduledPublishAt, DRAFT_GENERATION_LEAD_DAYS } from "@/lib/article-schedule";

export interface ArticleCaptions {
  x: string;
  facebook: string;
  instagram: string;
  linkedin: string;
}

export type GenerateArticleDraftResult = { ok: true } | { ok: false; error: string };

/**
 * System prompt reviewed and approved by Brett verbatim -- do not edit the
 * wording without going back through review, per the "the app is generating
 * real content with no one watching until review" standard this phase was
 * built to.
 */
function buildGenerationSystemPrompt(styleRefs: { title: string; content: string }[]): string {
  const referenceBlock = styleRefs
    .map((a) => `---\nTitle: ${a.title}\n\n${a.content}\n---`)
    .join("\n\n");

  return `You are writing a blog article for LEVR Auto's public website (levrauto.com/articles). LEVR Auto is a nationwide car-buying negotiation service: a customer picks one exact new-vehicle make and model, pays a flat $699 fee, and LEVR sources matching dealer inventory nationwide and negotiates on their behalf. Offers land in the customer's dashboard for them to accept or decline — no obligation. LEVR's guarantee: if it can't bring the customer at least one real offer below MSRP within 30 days, the $699 is refunded automatically. LEVR takes no commission or markup and never processes the vehicle payment itself. Use these facts about LEVR exactly as given if you reference the business — do not search the web for information about LEVR Auto itself, and do not invent details about how it works beyond what's stated here.

You have a web_search tool. Use it to find current, accurate, real information for the article's actual subject matter — pricing data, rankings, dates, statistics, dealer practices, whatever the topic requires. Never state a specific number, ranking, date, or statistic you haven't actually found via search; if you can't verify something, write around it rather than guessing.

Style: match the tone of LEVR Auto's other published articles, provided below as reference. Plain, direct, no hype-filled marketing language, no fabricated quotes or testimonials. Explain the actual mechanics of whatever the topic is the way a knowledgeable friend would, not a sales pitch. It's fine, and expected, to end with a short, natural tie back to LEVR's own pitch where it's relevant to the topic — but don't force it into every paragraph.

Formatting: respond with the article body only, in Markdown. Do not include the title as a heading (it's rendered separately) — start directly with the opening paragraph. Use "## " for section headers where they help the piece (2 to 4 sections is typical), and never use a single "#". Avoid bullet lists and bold text except where they genuinely aid readability — the reference articles below use almost none. Aim for roughly 500–900 words.

Reference articles (match this voice):

${referenceBlock}`;
}

/**
 * System prompt reviewed and approved by Brett verbatim -- same standard as
 * buildGenerationSystemPrompt above. Added after real generation runs twice
 * showed the model opening its final answer with a leading meta-commentary
 * sentence (e.g. "I have enough here. Now writing the article.") despite
 * the generation prompt's own "start directly with the opening paragraph"
 * instruction -- a forced-tool cleanup call is far more reliable than a
 * text heuristic, and matches the structured-extraction pattern already
 * used elsewhere in this codebase (offer-parsing-actions.ts).
 */
const CLEANUP_SYSTEM_PROMPT =
  "You clean up a freshly-drafted blog article's body text. The draft may contain a leading " +
  "meta-commentary sentence or two before the real content starts (e.g., a stray remark like " +
  '"Here\'s the article" or "I have enough information now"), left over from an earlier drafting ' +
  "step. Remove only that kind of leading commentary — do not rewrite, shorten, rephrase, or " +
  "otherwise change anything about the actual article content itself, including its markdown " +
  "formatting. If there's no such leading commentary, return the text completely unchanged. " +
  "Always respond by calling the clean_article_text tool.";

const CLEANUP_TOOL: Anthropic.Tool = {
  name: "clean_article_text",
  description: "Return the article body with any leading meta-commentary preamble removed.",
  input_schema: {
    type: "object",
    properties: {
      cleaned_content: { type: "string" },
    },
    required: ["cleaned_content"],
  },
};

async function cleanArticleBody(rawContent: string): Promise<string> {
  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 8000,
    system: CLEANUP_SYSTEM_PROMPT,
    tools: [CLEANUP_TOOL],
    tool_choice: { type: "tool", name: "clean_article_text" },
    messages: [{ role: "user", content: rawContent }],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === "clean_article_text"
  );

  if (!toolUse || typeof toolUse.input !== "object" || toolUse.input === null) {
    throw new Error("Claude didn't return cleaned article text.");
  }

  const cleaned = String((toolUse.input as Record<string, unknown>).cleaned_content ?? "").trim();
  if (!cleaned) {
    throw new Error("Cleanup returned empty content.");
  }
  return cleaned;
}

/**
 * System prompt reviewed and approved by Brett verbatim -- same standard as
 * buildGenerationSystemPrompt above.
 */
const CAPTIONS_SYSTEM_PROMPT =
  "You write social media captions announcing a new LEVR Auto blog article, one caption per " +
  "platform: X, Facebook, Instagram, and LinkedIn. Each caption must include the article's URL " +
  "exactly as given, written as plain text (not a markdown link). Match each platform's real " +
  "conventions: X — short and punchy, well under 280 characters including the URL, 0–2 hashtags " +
  "at most. Facebook — conversational, 1–3 short sentences, can pose a question or hook. " +
  "Instagram — similar to Facebook but can lean more casual, 2–4 relevant hashtags at the end. " +
  "LinkedIn — more professional, can be a bit longer, frame around the practical takeaway. None " +
  "should sound like generic marketing copy — write like a real person sharing something " +
  "genuinely useful, matching LEVR Auto's plain, direct voice. No hype, no exclamation-point " +
  "stacking. Always respond by calling the generate_social_captions tool.";

const CAPTIONS_TOOL: Anthropic.Tool = {
  name: "generate_social_captions",
  description: "Generate one social media caption per platform announcing a new LEVR Auto blog article.",
  input_schema: {
    type: "object",
    properties: {
      x_caption: { type: "string" },
      facebook_caption: { type: "string" },
      instagram_caption: { type: "string" },
      linkedin_caption: { type: "string" },
    },
    required: ["x_caption", "facebook_caption", "instagram_caption", "linkedin_caption"],
  },
};

async function generateArticleBody(title: string, topic: string): Promise<string> {
  const styleRefs = (await getPublishedArticles()).slice(0, 3);

  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 8000,
    system: buildGenerationSystemPrompt(styleRefs),
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
    messages: [{ role: "user", content: `Title: "${title}"\nTopic: "${topic}"` }],
  });

  if (message.stop_reason === "max_tokens") {
    throw new Error("Generation was truncated (hit max_tokens) before finishing.");
  }

  // Take only text emitted AFTER the last tool interaction -- a multi-round
  // web_search turn can include interim commentary text blocks between
  // search rounds (e.g. "I've got solid material to write this from, here's
  // the article"), and naively joining every text block in the response
  // leaks that commentary into the saved content. The real final answer is
  // whatever text follows the last server_tool_use/web_search_tool_result
  // block, whether or not it happens to be split across multiple blocks.
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
    throw new Error("Claude returned no article text.");
  }

  return text;
}

async function generateArticleCaptions(
  title: string,
  topic: string,
  content: string,
  articleUrl: string
): Promise<ArticleCaptions> {
  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    system: CAPTIONS_SYSTEM_PROMPT,
    tools: [CAPTIONS_TOOL],
    tool_choice: { type: "tool", name: "generate_social_captions" },
    messages: [
      {
        role: "user",
        content: `Title: "${title}"\nTopic: "${topic}"\nURL: ${articleUrl}\n\nArticle:\n\n${content}`,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === "generate_social_captions"
  );

  if (!toolUse || typeof toolUse.input !== "object" || toolUse.input === null) {
    throw new Error("Claude didn't return structured captions.");
  }

  const input = toolUse.input as Record<string, unknown>;
  return {
    x: String(input.x_caption ?? "").trim(),
    facebook: String(input.facebook_caption ?? "").trim(),
    instagram: String(input.instagram_caption ?? "").trim(),
    linkedin: String(input.linkedin_caption ?? "").trim(),
  };
}

/**
 * Generates a fresh draft (body + all 4 captions) for one article and
 * writes it in a single update -- shared by the cron entry point below and
 * the agent-triggered Regenerate action, which is why this takes an id
 * rather than a full row (Regenerate needs to re-read title/topic/slug
 * fresh, not trust stale props from the review page).
 */
export async function generateArticleDraft(articleId: string): Promise<GenerateArticleDraftResult> {
  const admin = createAdminClient();

  const { data: article, error: fetchError } = await admin
    .from("articles")
    .select("id, slug, title, topic")
    .eq("id", articleId)
    .maybeSingle();

  if (fetchError || !article) {
    return { ok: false, error: "Article not found." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const articleUrl = `${siteUrl}/articles/${article.slug}`;

  let content: string;
  let captions: ArticleCaptions;
  try {
    const rawContent = await generateArticleBody(article.title, article.topic);
    content = await cleanArticleBody(rawContent);
    captions = await generateArticleCaptions(article.title, article.topic, content, articleUrl);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Generation failed." };
  }

  const { error: updateError } = await admin
    .from("articles")
    .update({
      status: "draft",
      content,
      caption_x: captions.x,
      caption_facebook: captions.facebook,
      caption_instagram: captions.instagram,
      caption_linkedin: captions.linkedin,
      updated_at: new Date().toISOString(),
    })
    .eq("id", articleId);

  if (updateError) {
    return { ok: false, error: `Generated but failed to save: ${updateError.message}` };
  }

  return { ok: true };
}

export interface GenerateDueArticleDraftsSummary {
  generated: string[];
  errors: { slug: string; error: string }[];
}

/**
 * Cron entry point. Finds every not_started article whose scheduled publish
 * instant is within DRAFT_GENERATION_LEAD_DAYS -- an *at-least* check (same
 * catch-up-tolerant idiom as the Day-30/Day-60 jobs), so a missed run or a
 * repeated generation failure just gets retried the next day, indefinitely,
 * even past the scheduled date. Continues past individual failures, same
 * convention as runBatchSync in marketcheck-scheduler.ts.
 */
export async function generateDueArticleDrafts(): Promise<GenerateDueArticleDraftsSummary> {
  const admin = createAdminClient();
  const summary: GenerateDueArticleDraftsSummary = { generated: [], errors: [] };

  const { data: candidates, error } = await admin
    .from("articles")
    .select("id, slug, scheduled_month")
    .eq("status", "not_started");

  if (error) {
    throw new Error(`Failed to load not_started articles: ${error.message}`);
  }
  if (!candidates || candidates.length === 0) return summary;

  const now = Date.now();
  const leadMs = DRAFT_GENERATION_LEAD_DAYS * 24 * 60 * 60 * 1000;
  const due = candidates.filter((a) => scheduledPublishAt(a.scheduled_month).getTime() - now <= leadMs);

  for (const article of due) {
    const result = await generateArticleDraft(article.id);
    if (result.ok) {
      summary.generated.push(article.slug);
    } else {
      summary.errors.push({ slug: article.slug, error: result.error });
    }
  }

  return summary;
}
