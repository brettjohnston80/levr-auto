"use client";

import { useState } from "react";
import { startServiceAgreementSigning, confirmServiceAgreementSigned } from "@/lib/service-agreement-actions";

export function ServiceAgreementSigning({
  offerId,
  initiallySigned,
}: {
  offerId: string;
  initiallySigned: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "signing" | "signed" | "error">(
    initiallySigned ? "signed" : "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const containerId = `service-agreement-signing-${offerId}`;

  async function handleStart() {
    setStatus("loading");
    setError(null);

    const res = await startServiceAgreementSigning(offerId);

    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      setStatus("error");
      return;
    }
    if (res.alreadySigned) {
      setStatus("signed");
      return;
    }
    if (!res.sessionId) {
      setError("Could not start the signing session.");
      setStatus("error");
      return;
    }

    setStatus("signing");

    // Dynamically imported — no reason to load the embed script until the
    // customer actually asks to sign. The Signing constructor takes the
    // target container's DOM element id (a string), not a node reference.
    const { Signing } = await import("pandadoc-signing");

    const signing = new Signing(
      containerId,
      { sessionId: res.sessionId, width: "100%", height: 600 },
      { region: "com" }
    );

    // This is the primary way signed_at gets set — webhooks aren't
    // available on the current PandaDoc plan, so there's no server push.
    // A closed tab or failed call here can miss it; that gap is what the
    // agent-facing "Check signing status" button (asks PandaDoc directly)
    // exists to close.
    signing.on("document.completed", () => {
      setStatus("signed");
      void confirmServiceAgreementSigned(offerId);
    });

    await signing.open();
  }

  if (status === "signed") {
    return (
      <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] p-4">
        <p className="text-xs font-semibold text-emerald-400 uppercase">Service agreement signed</p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-semibold text-zinc-400 uppercase">LEVR service agreement</p>
      {status === "idle" || status === "loading" || status === "error" ? (
        <>
          <button
            type="button"
            disabled={status === "loading"}
            onClick={handleStart}
            className="mt-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-50"
          >
            {status === "loading" ? "Preparing…" : "Review & sign"}
          </button>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </>
      ) : null}
      <div id={containerId} className={status === "signing" ? "mt-3" : "hidden"} />
    </div>
  );
}
