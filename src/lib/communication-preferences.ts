// Shared types/helpers for customers.communication_frequency/communication_channel.
// Deliberately not in auth-actions.ts: that file has "use server", which
// requires every export to be an async Server Action — a plain sync helper
// like channelRequiresPhone can't live there (Next silently fails to
// resolve it from client components at build time).

export type CommunicationFrequency = "real_time" | "daily_digest";
export type CommunicationChannel = "text" | "email" | "agent_callback";

export interface CommunicationPreferences {
  frequency?: CommunicationFrequency;
  channel?: CommunicationChannel;
  phone?: string;
}

// Both "text" and "agent_callback" need a real phone number to be usable —
// a personal agent can't call back with no number, same as a text can't
// send with no number. Only "email" has no phone dependency.
export function channelRequiresPhone(channel: CommunicationChannel | undefined): boolean {
  return channel === "text" || channel === "agent_callback";
}
