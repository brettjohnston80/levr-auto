import "server-only";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * Shared forced-tool schema for "write one caption per platform," used by
 * every caption-generation call in this codebase -- article-generation.ts
 * and social-generation.ts both import this rather than each defining
 * their own copy. The tool shape itself doesn't vary by theme/context; only
 * the system prompt guiding tone/content does.
 */
export const CAPTIONS_TOOL: Anthropic.Tool = {
  name: "generate_social_captions",
  description: "Generate one social media caption per platform.",
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

export interface PlatformCaptions {
  x: string;
  facebook: string;
  instagram: string;
  linkedin: string;
}

/**
 * Extracts the 4 captions from a forced generate_social_captions tool_use
 * response, validating only `requiredFields` are non-empty (default: all
 * 4). Found via real data that a strict "always all 4" validation was
 * wrong: the two weekend social themes ask the model to write a LinkedIn
 * caption "anyway" purely so the tool schema stays uniform, even though
 * it's discarded downstream (no LinkedIn slot exists for those themes) --
 * so an empty LinkedIn caption there isn't a real failure worth retrying
 * over, unlike every other field on every other call. Callers that do need
 * every field (articles always; social posts' weekday themes) pass the
 * default. This was tightened from "always validate all 4," which itself
 * was tightened from "no validation at all" after a throwback_thursday run
 * (weekday, LinkedIn genuinely required) satisfied the tool schema with a
 * blank linkedin_caption that nothing had caught before.
 */
export function extractCaptions(
  message: Anthropic.Message,
  requiredFields: (keyof PlatformCaptions)[] = ["x", "facebook", "instagram", "linkedin"]
): PlatformCaptions {
  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === "generate_social_captions"
  );

  if (!toolUse || typeof toolUse.input !== "object" || toolUse.input === null) {
    throw new Error("Claude didn't return structured captions.");
  }

  const input = toolUse.input as Record<string, unknown>;
  const captions: PlatformCaptions = {
    x: String(input.x_caption ?? "").trim(),
    facebook: String(input.facebook_caption ?? "").trim(),
    instagram: String(input.instagram_caption ?? "").trim(),
    linkedin: String(input.linkedin_caption ?? "").trim(),
  };

  const empty = requiredFields.filter((k) => captions[k].length === 0);
  if (empty.length > 0) {
    throw new Error(`Claude returned empty caption(s) for: ${empty.join(", ")}.`);
  }

  return captions;
}
