import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Server-only Anthropic client, lazily instantiated so importing this module
 * never crashes a build/cold start before ANTHROPIC_API_KEY is configured --
 * same pattern as getStripe() (stripe.ts).
 */
let cachedClient: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return cachedClient;
}
