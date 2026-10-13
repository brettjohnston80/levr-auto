"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { agentSigninAction, type AgentSigninState } from "@/lib/agent-signin-actions";

const inputClass =
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

function ErrorLine({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  );
}

export function AgentSigninForm({ initialStep }: { initialStep: AgentSigninState["step"] }) {
  const [state, action] = useActionState(agentSigninAction, { step: initialStep } as AgentSigninState);

  if (state.step === "two_factor") {
    return (
      <form action={action} className="space-y-4" key="two_factor">
        <input type="hidden" name="step" value="two_factor" />
        <h2 className="text-base font-semibold text-zinc-900">Enter your authenticator code</h2>
        <ErrorLine message={state.error} />
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
            className={`${inputClass} tracking-widest`}
          />
        </label>
        <Submit label="Verify" busy="Verifying…" />
        <p className="text-xs text-zinc-500">Lost access to your authenticator? Contact your lead.</p>
      </form>
    );
  }

  return (
    <form action={action} className="space-y-4" key="password">
      <input type="hidden" name="step" value="password" />
      <ErrorLine message={state.error} />
      <label className="block text-sm font-medium text-zinc-700">
        Work email
        <input
          type="email"
          name="email"
          id="agent-email"
          required
          autoComplete="username"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={inputClass}
        />
      </label>
      <label className="block text-sm font-medium text-zinc-700">
        Password
        <input
          type="password"
          name="password"
          id="agent-password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </label>
      <Submit label="Sign in" busy="Signing in…" />
    </form>
  );
}
