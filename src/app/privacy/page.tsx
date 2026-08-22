import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — LEVR Auto",
};

export default function PrivacyPage() {
  return (
    <section className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-3xl px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Privacy Policy</h1>
        <p className="mt-3 text-sm text-zinc-500">Last updated: August 21, 2026</p>
        <p className="mt-2 text-sm text-zinc-500 italic">
          This is an interim privacy policy, effective while our full Terms of Service remain under
          attorney review. This policy will be updated once that review is complete.
        </p>

        <p className="mt-8 text-sm leading-relaxed text-zinc-400 sm:text-base">
          LEVR Auto (&ldquo;LEVR,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) operates levrauto.com, a
          service that negotiates new-vehicle purchases on your behalf. This policy explains what
          information we collect, how we use it, and who we share it with.
        </p>

        <h2 className="mt-10 text-lg font-semibold text-white">Information we collect</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
          When you create an account, we collect your email address. Once you complete your account
          settings, we also collect your first and last name and phone number. We ask for your phone
          number because it&apos;s how we reach you — by email, text, or a phone call from your
          agent, depending on the contact preference you choose.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
          When you start a search, we collect the vehicle make, model, ZIP code, and (once you
          finalize) trim, color, and any required options you specify.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
          If you choose to have LEVR negotiate financing on your behalf, we may collect general
          financing information you provide, such as your financing preference, income range,
          desired down payment, and loan term.{" "}
          <strong className="font-semibold text-zinc-300">
            We do not perform credit checks or pull your credit report at any point.
          </strong>
        </p>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
          If a deal moves forward, we record the reservation deposit amount and the date it was
          confirmed by the dealer.{" "}
          <strong className="font-semibold text-zinc-300">
            LEVR never processes or holds this deposit — it&apos;s paid directly from you to the
            dealer.
          </strong>
        </p>

        <h2 className="mt-10 text-lg font-semibold text-white">How we use your information</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
          We use your information to operate your search: contacting dealers on your behalf,
          communicating offers to you, coordinating your accepted deal, and reaching you about your
          account or your search&apos;s status.
        </p>

        <h2 className="mt-10 text-lg font-semibold text-white">Who we share it with</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
          We share information with the following third parties, only as needed to provide our
          service:
        </p>
        <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-relaxed text-zinc-400 sm:text-base">
          <li>
            <strong className="text-white">Stripe</strong>, to process your $699 search fee and any
            applicable extension or switch fees. LEVR does not store your card number — Stripe
            handles that directly.
          </li>
          <li>
            <strong className="text-white">MarketCheck</strong>, to source real-time vehicle
            inventory and pricing. This is a one-way inventory lookup — only vehicle search criteria
            is sent, never any personal information about you.
          </li>
          <li>
            <strong className="text-white">Anthropic</strong>, whose Claude API helps our team read
            and structure a dealer&apos;s reply into offer details. This processes the dealer&apos;s
            correspondence, not your personal account information.
          </li>
          <li>
            <strong className="text-white">ZeptoMail</strong>, to deliver transactional email —
            account confirmation, password reset, and search-related notices like renewal reminders.
          </li>
          <li>
            <strong className="text-white">PandaDoc</strong>, if your deal reaches the paperwork
            stage, to create and send your service agreement for e-signature. Your name and email are
            shared with PandaDoc for this purpose.
          </li>
          <li>
            <strong className="text-white">Dealers you&apos;re matched with</strong>, but only once
            you&apos;ve accepted an offer — your contact information is not shared with a dealer
            before that point.
          </li>
          <li>
            <strong className="text-white">Supabase</strong>, our database, authentication, and
            file-storage provider, which stores your account information and any documents you
            upload (such as financing proof) securely on our behalf.
          </li>
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
          We do not sell your personal information, and we do not share it with third parties for
          their own marketing purposes.
        </p>

        <h2 className="mt-10 text-lg font-semibold text-white">Data retention</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
          We retain your account and search information for as long as your account is active, and
          as needed to comply with our legal and financial obligations.
        </p>

        <h2 className="mt-10 text-lg font-semibold text-white">Your choices</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
          You can update your contact preferences at any time from your account settings. To request
          a copy of your information, or to request that we delete it, contact us at{" "}
          <a href="mailto:support@levrauto.com" className="text-emerald-400 underline hover:text-emerald-300">
            support@levrauto.com
          </a>
          .
        </p>

        <h2 className="mt-10 text-lg font-semibold text-white">Security</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
          We use industry-standard safeguards, including encrypted connections and access controls,
          to protect your information. No system is completely secure, and we can&apos;t guarantee
          absolute security.
        </p>

        <h2 className="mt-10 text-lg font-semibold text-white">Children&apos;s privacy</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
          LEVR Auto is not directed at, and is not intended for use by, anyone under 18.
        </p>

        <h2 className="mt-10 text-lg font-semibold text-white">Changes to this policy</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
          We&apos;ll update the date at the top of this page if this policy changes, and we&apos;ll
          provide more prominent notice for material changes.
        </p>

        <h2 className="mt-10 text-lg font-semibold text-white">Contact us</h2>
        <p className="mt-3 mb-2 text-sm leading-relaxed text-zinc-400 sm:text-base">
          Questions about this policy:{" "}
          <a href="mailto:support@levrauto.com" className="text-emerald-400 underline hover:text-emerald-300">
            support@levrauto.com
          </a>
        </p>
      </div>
    </section>
  );
}
