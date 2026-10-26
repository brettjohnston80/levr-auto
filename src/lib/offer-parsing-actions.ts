"use server";

import { getAuthorizedAgent } from "./agent-auth";
import { getAnthropic } from "./anthropic";
import type Anthropic from "@anthropic-ai/sdk";
import { toParsedOffer, type ParsedOffer } from "./offer-parse-normalize";

export type ParseDealerOfferResult = { ok: true; parsed: ParsedOffer } | { ok: false; error: string };

// Deliberately no MSRP field anywhere in this schema -- dealers state their
// own price, not the vehicle's MSRP, and MSRP is guarantee-critical, so it
// stays human-only, exactly as LogOfferForm's existing manual field. Getting
// this from an AI guess would risk silently corrupting a guarantee
// determination.
const EXTRACT_OFFER_TOOL: Anthropic.Tool = {
  name: "extract_dealer_offer",
  description:
    "Extract structured offer details from a dealer's reply to a vehicle price negotiation -- either " +
    "pasted email/call-notes text or a scanned offer-sheet PDF. Only extract what's actually present; " +
    "never invent or estimate a value that isn't stated.",
  input_schema: {
    type: "object",
    properties: {
      dealer_name: {
        type: ["string", "null"],
        description: "The dealership's name, if mentioned. Null if not present.",
      },
      dealer_contact: {
        type: ["string", "null"],
        description: "A phone number or email for the dealer/salesperson, if mentioned. Null if not present.",
      },
      offer_price_dollars: {
        type: ["number", "null"],
        description:
          "The dealer's offered price for the vehicle itself, in dollars, as the dealer states it, NOT " +
          "including any itemized add-on fees (list those separately in addons) and NOT including a " +
          "destination charge the dealer lists separately (put that in destination_dollars). This is the " +
          "dealer's price, never the vehicle's MSRP or sticker price -- do not extract or infer MSRP under " +
          "any circumstances. Null if no clear vehicle price is stated.",
      },
      destination_dollars: {
        type: ["number", "null"],
        description:
          "The manufacturer's destination charge (also called destination and handling, freight, or " +
          "delivery, processing and handling), in dollars, ONLY when the dealer lists it as a separate " +
          "amount on top of the vehicle price. Null if it isn't listed separately or the dealer says the " +
          "price already includes it. Never put destination in addons.",
      },
      addons: {
        type: "array",
        description:
          "Itemized fees beyond the vehicle price itself (doc fee, dealer add-ons, etc.), never the " +
          "destination charge (that goes in destination_dollars), " +
          "each with its own description and dollar amount. Empty array if none are itemized.",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            amount_dollars: { type: "number" },
          },
          required: ["description", "amount_dollars"],
        },
      },
    },
    required: ["addons"],
  },
};

const SYSTEM_PROMPT =
  "You help a car-buying negotiation agent turn a dealer's reply into structured data. The agent will " +
  "review and can edit everything you extract before it's saved -- accuracy matters, but when something " +
  "is ambiguous or absent, leave it null/empty rather than guessing. Always respond by calling the " +
  "extract_dealer_offer tool.";

/**
 * Parses a dealer reply -- pasted text or an uploaded offer-sheet PDF --
 * into structured fields that pre-fill LogOfferForm. Nothing here persists
 * anything: this is a pure extraction call, the agent reviews/edits the
 * result, and only LogOfferForm's actual submit (logQualifyingOffer) writes
 * to the database. Forced tool use (not a freeform JSON prompt) for
 * reliable structured output.
 */
export async function parseDealerOffer(formData: FormData): Promise<ParseDealerOfferResult> {
  const agent = await getAuthorizedAgent();
  if (!agent) {
    return { ok: false, error: "Not authorized." };
  }

  const rawText = formData.get("raw_text")?.toString().trim();
  const pdf = formData.get("pdf");

  let content: Anthropic.MessageParam["content"];

  if (pdf instanceof File && pdf.size > 0) {
    const buffer = Buffer.from(await pdf.arrayBuffer());
    content = [
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") },
      },
      { type: "text", text: "Extract the dealer's offer details from this offer-sheet PDF." },
    ];
  } else if (rawText) {
    content = [{ type: "text", text: `Dealer reply:\n\n${rawText}` }];
  } else {
    return { ok: false, error: "Paste some dealer text or upload a PDF first." };
  }

  let message;
  try {
    message = await getAnthropic().messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [EXTRACT_OFFER_TOOL],
      tool_choice: { type: "tool", name: "extract_dealer_offer" },
      messages: [{ role: "user", content }],
    });
  } catch (err) {
    return { ok: false, error: `Claude API request failed: ${err instanceof Error ? err.message : "unknown error"}` };
  }

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === "extract_dealer_offer"
  );

  if (!toolUse || typeof toolUse.input !== "object" || toolUse.input === null) {
    return { ok: false, error: "Claude didn't return structured data -- try again or enter the offer manually." };
  }

  return { ok: true, parsed: toParsedOffer(toolUse.input as Record<string, unknown>) };
}
