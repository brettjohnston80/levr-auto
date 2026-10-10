# LEVR Auto — Website Audit & Competitive Research (2026-08-21)

Commissioned by Brett to (1) survey design patterns across 27 popular automotive-space sites, (2) benchmark price/positioning against 10 direct car-buying-negotiation competitors, and (3) audit levrauto.com itself against the live production source in this repo. Full narrative report (with the complete 27-site research and 10-competitor comparison table) was delivered to Brett separately as a Word doc — **this file is the actionable subset**: the 20 site findings, in priority order, each pointing at the exact file to fix. Read this before picking up any of the items below; no code has been changed yet, this is queued work.

**How this was produced:** audited by reading the live production source directly (this repo, branch `main`) and cross-referencing `CLAUDE.md`'s build log — not a live browser/screenshot pass (the auditing session's sandbox didn't permit browser automation against external sites). That means every finding below is a verified code-level fact (a hidden class, a missing file, a literal string), not a visual guess. On-device pixel-level spacing/alignment was **not** checked and would benefit from an actual phone walkthrough at some point.

**Suggested sequencing:** the 3 Critical items are small, well-scoped, and already live in production — worth a short focused pass before or alongside other priorities (the dealer outreach spike remains the single highest-leverage open item per the Roadmap doc; this doesn't try to outrank that, just to sit visibly alongside it). High-priority items are mostly copy/config changes, cheap to batch together. Medium and Strategic items are fine to pick up opportunistically.

---

## Critical — broken or missing functionality, verified in code

### 1. Mobile navigation menu doesn't exist
`src/components/site-header.tsx` — the nav links (How It Works, Matchmaker, FAQ) are `hidden items-center gap-8 ... sm:flex`, and the Log In link is `hidden ... sm:block`. Both render only at the `sm` breakpoint (640px) and up. Below that — effectively every phone — the header shows only the logo and Get Started. There is no hamburger icon, no slide-out drawer, no mobile menu component anywhere in `src/` (confirmed by grep for menu/hamburger/nav patterns — no matches). A mobile visitor cannot reach `/faq`, `/matchmaker`, the `#how-it-works` anchor, or `/login` through navigation at all.

**Fix:** build a real mobile menu (hamburger → slide-out drawer or full-screen overlay) in `site-header.tsx` surfacing the same links. Highest-priority item in this doc.

### 2. Custom typeface is silently overridden
`src/app/layout.tsx` loads Geist Sans/Mono via `next/font` and exposes them as CSS vars on `<html>` (lines 8–16). But `src/app/globals.css` sets `body { font-family: Arial, Helvetica, sans-serif; }` unconditionally, and nothing in `src/` applies Tailwind's `font-sans` utility anywhere. Net effect: the loaded Geist font is dead weight and the site is very likely rendering in the browser's default Arial/Helvetica stack.

**Fix:** remove the hardcoded `font-family` from `globals.css` (or set it to `var(--font-geist-sans)`), then confirm on a real device that Geist is actually rendering.

### 3. Terms of Service and Privacy Policy are placeholder text
`src/app/terms/page.tsx` and `src/app/privacy/page.tsx` each render one sentence: "Final terms/privacy language is pending attorney review and will be published here before launch." Meanwhile the live site already creates real Supabase Auth accounts and stores phone numbers, and per the pre-launch banner is one step from live payment. Footer links to both.

**Fix:** treat as a pre-launch blocker — get at least an interim privacy policy live before real payment goes live (Stripe and most providers require one) even if full Terms stay pending final attorney sign-off.

---

## High — trust, legal, conversion

### 4. The no-dealer-kickback claim is never stated in plain words
`src/components/why-levr.tsx` and `src/app/faq/page.tsx` — "No dealership pressure" and "one flat fee" imply but never state outright that LEVR takes zero dealer compensation. Competitive research shows this exact claim is the leading trust signal for every close comparable (Your Car Buying Advocate, National Auto Deal Negotiators, Policygenius, Consumer Reports).

**Fix:** add one explicit, bolded sentence to `why-levr.tsx` and a new FAQ entry ("How do you make money — are you paid by dealers?") stating LEVR never accepts dealer compensation.

### 5. No visible contact channel on any public page
`support@levrauto.com` is real and working but only surfaces inside the authenticated `/account` FAQ panel (`account-faq-section.tsx`). Nothing in `site-footer.tsx`, the header, or `/faq` gives a prospective customer a way to ask a question before paying $699.

**Fix:** add the support email (and phone, if staffed) to `site-footer.tsx`.

### 6. No Open Graph / Twitter Card metadata
`src/app/layout.tsx`'s `metadata` export has only `title`/`description` — no `openGraph`, no `twitter`, no `metadataBase`, no OG image anywhere. Shared links (text, social, Slack) show no preview image and possibly no description.

**Fix:** add an `openGraph`/`twitter` block with a real 1200×630 OG image to the root layout metadata — standard Next.js Metadata API config.

### 7. Intake has no state-eligibility check
`src/components/intake-filter.tsx` — zip validation is `/^\d{5}$/` only (format, not eligibility). But the FAQ ("we're rolling out carefully, state by state") and footer ("state availability rolling out") both imply not every state is served yet. Nothing blocks or flags an out-of-area zip before checkout.

**Fix:** add a state-eligibility check (even a simple allow-list) at intake before real payment goes live.

### 8. No trust content standing in for the still-absent testimonials
Understandable pre-launch with zero customers — but nothing fills the gap between the Guarantee section and the final CTA on the homepage.

**Fix:** add a short founder-credibility block (who's behind LEVR, why) as a stand-in trust signal.

### 9. Footer is too thin
`src/components/site-footer.tsx` — logo, Terms, Privacy, and the state-availability note only. No FAQ/How It Works/Matchmaker links, no contact info, no social.

**Fix:** expand to include the core nav links (a second, always-visible path to them until #1 ships), the support contact from #5, and social links once they exist.

---

## Medium — polish and best practice

### 10. No `robots.txt` or `sitemap.xml`
No `src/app/robots.ts` or `src/app/sitemap.ts` exists. Next.js Metadata Routes API makes both a ~20-minute add.

### 11. Drive-transition animation ignores `prefers-reduced-motion`
`src/components/drive-transition-provider.tsx` — every "Get Started" click runs a fixed ~960ms car-driving animation (`OUT_MS`/`IN_MS` = 480 each) with no motion-preference check and no skip. Adds a mandatory ~1s delay before the intake form appears, on every click.

**Fix:** check `window.matchMedia('(prefers-reduced-motion: reduce)')` and skip straight to the scroll when set.

### 12. No low-commitment path for visitors not ready to pay $699
Only conversion paths today are full checkout or the Matchmaker quiz. No email-capture/"notify me" option, which matters more given the site says outright it's pre-launch.

**Fix:** add a simple email-capture CTA as a lower-friction alternative.

### 13. ~2.6MB of unused logo files in `/public`
`public/levr-auto-logo-final.png` (1.26MB) and `public/levr-holdings-llc-logo-final.png` (1.36MB) are not referenced anywhere in `src/` (only the much smaller `-white.png` versions are used, in header/footer). Confirmed via grep.

**Fix:** delete, or move out of `/public` into a non-bundled brand-assets location if they're meant for future use.

### 14. Dead legacy CSS theme variables
`src/app/globals.css` still carries the default `create-next-app` `--background`/`--foreground` light/dark vars and a `prefers-color-scheme: dark` media query, unused since every page hardcodes `bg-zinc-950` directly (`layout.tsx`).

**Fix:** remove the unused `:root` vars and media query; keep `globals.css` to the Tailwind import and the `drive-car` animation that's actually in use.

### 15. No stable `#pricing` anchor for external linking
Pricing shows clearly on the homepage (a real strength — matches "never hide pricing" best practice), but there's no dedicated `/pricing` page or `#pricing` anchor id for an ad/press/social link to point at.

**Fix:** add `id="pricing"` to the flat-fee section in `intake-filter.tsx`.

### 16. Thin password requirements
`src/app/signup/page.tsx` and `src/components/auth-gate-modal.tsx` — 6-character minimum only, no confirm-password field, no strength guidance.

**Fix:** raise the minimum (8+) and add a confirm-password field, at minimum on `/signup`.

---

## Strategic / lower priority — positioning enhancements

### 17. Add a "the usual way vs. the LEVR way" comparison table
CarEdge's side-by-side format (who initiates dealer contact, who sees pricing data, negotiation approach, fee transparency) is one of the most reusable patterns found in the research. LEVR's `how-it-works.tsx` is solid but doesn't yet contrast against the pain of buying alone.

### 18. Prepare messaging addressing the CarEdge AI-negotiator competitor
CarEdge's ~$40/mo AI product is the closest existing threat to LEVR's core mechanism (see the full competitor comparison in the delivered report). A short "why not just use an AI tool" FAQ entry, leaning into the guarantee and the fully-done-for-you dashboard, would get ahead of it.

### 19. Plan to cite specific, dated savings figures once real transaction data exists
Consumer Reports' "$2,860 average savings, 10/01/24–12/31/24" pattern beats a generic "save thousands" claim. No action pre-launch — flag for the first post-launch content pass.

### 20. Design the future testimonials section around specific objections
Purple's pattern (matching each testimonial to a specific doubt) outperforms generic praise. Worth collecting testimonials with this framing from day one of real customers.

---

*Full narrative version (27-site design research by theme, 10-competitor pricing/positioning table with synthesis) was delivered to Brett as a Word doc on 2026-08-21 and is not duplicated here — this file is the build-facing checklist.*
