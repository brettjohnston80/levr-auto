"use client";

import { useState, type FormEvent } from "react";
import { searchDealerships, type DealershipSearchResult } from "@/lib/dealership-queue";

// Simpler than agent-bypass-lookup.ts's two-stage customer lookup -- merging
// an alias only needs one level (pick the target dealership directly), no
// intermediate disambiguation stage.
export function DealershipSearchPicker({
  onPick,
  disabled,
}: {
  onPick: (dealership: DealershipSearchResult) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DealershipSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setSearching(true);
    setError(null);

    const result = await searchDealerships(query);
    setSearching(false);
    setSearched(true);

    if ("error" in result) {
      setError(result.error);
      return;
    }
    setResults(result);
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          required
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search dealerships by name, city, or state…"
          className="flex-1 rounded border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-white placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={searching}
          className="rounded bg-white px-3 py-1.5 text-xs font-semibold text-zinc-950 disabled:opacity-50"
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {searched && !error && results.length === 0 && (
        <p className="mt-2 text-xs text-zinc-500">No dealerships matched &ldquo;{query}&rdquo;.</p>
      )}
      {results.length > 0 && (
        <div className="mt-2 space-y-1">
          {results.map((d) => (
            <button
              key={d.id}
              type="button"
              disabled={disabled}
              onClick={() => onPick(d)}
              className="block w-full rounded border border-white/10 px-3 py-1.5 text-left text-sm text-white hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {d.name}
              {[d.city, d.state].filter(Boolean).length > 0 && (
                <span className="text-zinc-500"> — {[d.city, d.state].filter(Boolean).join(", ")}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
