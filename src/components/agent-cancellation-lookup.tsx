"use client";

import { useState, type FormEvent } from "react";
import {
  searchCustomers,
  getCustomerSearchesForBypass,
  type CustomerCandidate,
  type CustomerSearchSummary,
} from "@/lib/agent-bypass-lookup";
import { AgentCancellationResolutionForm } from "@/components/agent-cancellation-resolution-form";

type Mode = "search" | "results" | "searches" | "resolve";

// Standalone entry point for resolving a cancellation that isn't already
// sitting in the "Cancellation calls requested" queue -- e.g. the agent
// handled it live on the call. Reuses the exact same two-stage lookup
// functions AgentBypassLookup already built (search by name/email ->
// disambiguated customer list -> their searches), not a new lookup, per
// the approved plan. Terminates in the same AgentCancellationResolutionForm
// the queue rows use.
export function AgentCancellationLookup() {
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<CustomerCandidate[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerCandidate | null>(null);
  const [customerSearches, setCustomerSearches] = useState<CustomerSearchSummary[]>([]);
  const [selectedSearch, setSelectedSearch] = useState<CustomerSearchSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMode("search");
    setQuery("");
    setCandidates([]);
    setSelectedCustomer(null);
    setCustomerSearches([]);
    setSelectedSearch(null);
    setError(null);
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setSearching(true);
    setError(null);

    const result = await searchCustomers(query);
    setSearching(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }
    setCandidates(result);
    setMode("results");
  }

  async function handlePickCustomer(customer: CustomerCandidate) {
    setSelectedCustomer(customer);
    setError(null);

    const result = await getCustomerSearchesForBypass(customer.id);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setCustomerSearches(result);
    setMode("searches");
  }

  if (mode === "resolve" && selectedSearch && selectedCustomer) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <p className="text-sm text-zinc-400">
          Resolving cancellation for {selectedCustomer.fullName ?? selectedCustomer.email}&rsquo;s{" "}
          {selectedSearch.make} {selectedSearch.model} search (currently{" "}
          {selectedSearch.searchStatus.replace(/_/g, " ")}).
        </p>
        <AgentCancellationResolutionForm searchId={selectedSearch.id} customerId={selectedCustomer.id} />
        <button type="button" onClick={reset} className="mt-3 text-sm text-zinc-400 underline hover:text-white">
          Start over
        </button>
      </div>
    );
  }

  if (mode === "searches" && selectedCustomer) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <p className="text-sm text-zinc-400">
          Searches for {selectedCustomer.fullName ?? "(no name on file)"} — {selectedCustomer.email}
        </p>
        {customerSearches.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No searches on this account.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {customerSearches.map((search) => (
              <button
                key={search.id}
                type="button"
                onClick={() => {
                  setSelectedSearch(search);
                  setMode("resolve");
                }}
                className="block w-full rounded-lg border border-white/10 px-4 py-2 text-left text-sm text-white hover:bg-white/5"
              >
                {search.make} {search.model} — {search.searchStatus.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setMode("results")}
          className="mt-4 text-sm text-zinc-400 underline hover:text-white"
        >
          Back to results
        </button>
      </div>
    );
  }

  if (mode === "results") {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        {candidates.length === 0 ? (
          <p className="text-sm text-zinc-500">No customers matched &ldquo;{query}&rdquo;.</p>
        ) : (
          <div className="space-y-2">
            {candidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => handlePickCustomer(candidate)}
                className="block w-full rounded-lg border border-white/10 px-4 py-2 text-left text-sm text-white hover:bg-white/5"
              >
                {candidate.fullName ?? "(no name on file)"} — {candidate.email}
              </button>
            ))}
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <button type="button" onClick={reset} className="mt-4 text-sm text-zinc-400 underline hover:text-white">
          New search
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSearch} className="flex gap-2">
      <input
        required
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by customer name or email…"
        className="flex-1 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
      />
      <button
        type="submit"
        disabled={searching}
        className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
      >
        {searching ? "Searching…" : "Search"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
