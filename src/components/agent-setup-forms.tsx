"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  acceptAgentLink,
  enrollAgentFactor,
  requestAgentPasswordReset,
  setAgentPassword,
  type FormState,
} from "@/lib/agent-setup-actions";
import { AGENT_RESET_SENT } from "@/lib/agent-setup-copy";

export const agentInputClass =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-300 focus:outline-none";
const buttonClass =
  "w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60";

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className={buttonClass}>
      {pending ? busy : label}
    </button>
  );
}

export function AgentError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  );
}

export function AcceptForm({
  tokenHash,
  body,
  invalidHint,
}: {
  tokenHash: string;
  body: string;
  invalidHint: React.ReactNode;
}) {
  const [state, action] = useActionState(acceptAgentLink, {} as FormState);
  if (state.error) {
    return (
      <div className="space-y-4">
        <AgentError message={state.error} />
        <p className="text-sm text-zinc-600">{invalidHint}</p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-zinc-700">{body}</p>
      <input type="hidden" name="token_hash" value={tokenHash} />
      <Submit label="Continue" busy="Checking…" />
    </form>
  );
}

export function SetPasswordForm({ requirements }: { requirements: string }) {
  const [state, action] = useActionState(setAgentPassword, {} as FormState);
  return (
    <form action={action} className="space-y-4">
      <AgentError message={state.error} />
      <label className="block text-sm font-medium text-zinc-700">
        New password
        <input type="password" name="password" id="agent-new-password" required autoComplete="new-password" className={agentInputClass} />
      </label>
      <label className="block text-sm font-medium text-zinc-700">
        Confirm password
        <input type="password" name="confirm" id="agent-confirm-password" required autoComplete="new-password" className={agentInputClass} />
      </label>
      <p className="text-xs text-zinc-500">{requirements}</p>
      <Submit label="Continue" busy="Saving…" />
    </form>
  );
}

export function EnrollForm({ factorId }: { factorId: string }) {
  const [state, action] = useActionState(enrollAgentFactor, {} as FormState);
  return (
    <form action={action} className="space-y-4">
      <AgentError message={state.error} />
      <input type="hidden" name="factor_id" value={factorId} />
      <label className="block text-sm font-medium text-zinc-700">
        6-digit code
        <input
          type="text"
          name="code"
          required
          inputMode="numeric"
          pattern="[0-9 ]*"
          autoComplete="one-time-code"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={7}
          className={`${agentInputClass} tracking-widest`}
        />
      </label>
      <Submit label="Turn on" busy="Turning on…" />
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestAgentPasswordReset, {} as FormState);
  if (state.done) {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-800">
          {AGENT_RESET_SENT}
        </p>
        <Link href="/agent" className="block text-sm text-zinc-700 underline">
          Back to sign-in
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm font-medium text-zinc-700">
        Work email
        <input
          type="email"
          name="email"
          id="agent-reset-email"
          required
          autoComplete="username"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={agentInputClass}
        />
      </label>
      <Submit label="Send reset link" busy="Sending…" />
    </form>
  );
}
