import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AgentCard } from "@/components/agent-card";
import { EnrollForm } from "@/components/agent-setup-forms";
import { currentAgentLogin, verifiedTotpFactorId } from "@/lib/agent-session";

export const metadata: Metadata = { title: "LEVR Auto agent sign-in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Turn on two-factor sign-in. Every agent must finish this before reaching
 * anything else (enforced on every agent page in Chunk 1d). A new
 * authenticator is started on each visit; any earlier unfinished one is removed.
 */
export default async function AgentEnrollPage() {
  const login = await currentAgentLogin();
  if (!login) redirect("/agent");
  if (await verifiedTotpFactorId(login.supabase)) redirect("/agent");

  const { data: factors } = await login.supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.status !== "verified") await login.supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await login.supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Authenticator ${new Date().toISOString().slice(0, 19)}`,
  });
  if (error || !data) {
    console.error("[agent-enroll] could not start enrollment", error?.message);
    redirect("/agent");
  }

  return (
    <AgentCard heading="Turn on two-factor sign-in">
      <p className="text-sm text-zinc-700">
        Scan this code with an authenticator app (such as Google Authenticator, 1Password or Authy), then enter the
        6-digit code it shows.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element -- an SVG data URL from Supabase */}
      <img
        src={data.totp.qr_code}
        alt="QR code for your authenticator app"
        width={192}
        height={192}
        className="mx-auto my-4 h-48 w-48 rounded border border-zinc-200 bg-white p-2"
      />
      <details className="mb-4 text-sm text-zinc-700">
        <summary className="cursor-pointer underline">Can&apos;t scan? Enter this key instead:</summary>
        <code className="mt-2 block rounded bg-zinc-100 px-2 py-1 font-mono text-xs break-all select-all">
          {data.totp.secret}
        </code>
      </details>
      <EnrollForm factorId={data.id} />
    </AgentCard>
  );
}
