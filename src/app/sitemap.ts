import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Only the real public routes that exist today -- everything else is
// auth-gated (/account, /internal/*, /finalize/*) or has no standalone
// public value (/auth/*, /payment/*, /forgot-password).
const ROUTES = ["/", "/faq", "/matchmaker", "/login", "/signup", "/terms", "/privacy"];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
  }));
}
