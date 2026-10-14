"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { startAgentEnrollment, type EnrollStart } from "@/lib/agent-setup-actions";
import { EnrollForm } from "@/components/agent-setup-forms";
import { AgentKeyBox } from "@/components/agent-key-box";

/** Starts the authenticator exactly once per visit, then shows the QR code, the key and the code form. */
export function AgentEnrollSetup() {
  const router = useRouter();
  const started = useRef(false);
  const [setup, setSetup] = useState<EnrollStart | null>(null);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startAgentEnrollment().then((r) => {
      if (!r.ok) router.replace("/agent");
      else setSetup(r);
    });
  }, [router]);

  if (!setup || !setup.ok) {
    return (
      <div aria-busy="true" className="mx-auto my-4 h-48 w-48 animate-pulse rounded border border-zinc-200 bg-zinc-100" />
    );
  }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- an SVG data URL from Supabase */}
      <img
        src={setup.qrCode}
        alt="QR code for your authenticator app"
        width={192}
        height={192}
        className="mx-auto my-4 h-48 w-48 rounded border border-zinc-200 bg-white p-2"
      />
      <details className="mb-4 text-sm text-zinc-700">
        <summary className="cursor-pointer underline">Can&apos;t scan? Enter this key instead:</summary>
        <AgentKeyBox secret={setup.secret} />
      </details>
      <EnrollForm factorId={setup.factorId} />
    </>
  );
}
