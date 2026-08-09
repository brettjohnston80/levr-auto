import "server-only";
import Stripe from "stripe";

/**
 * Server-only Stripe client. Test mode for now — STRIPE_SECRET_KEY should be
 * a sk_test_... key until the business is actually ready to take real money.
 *
 * Lazily instantiated so importing this module never crashes a build/cold
 * start before STRIPE_SECRET_KEY is actually configured.
 */
let cachedClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!cachedClient) {
    cachedClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-07-29.dahlia",
    });
  }
  return cachedClient;
}
