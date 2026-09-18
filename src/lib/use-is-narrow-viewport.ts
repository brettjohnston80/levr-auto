"use client";

import { useEffect, useState } from "react";

// Matches Tailwind's `sm` breakpoint (640px) from JS. Comparison-table
// components need this as a NUMBER, not a class, because the value feeds
// both a column-width calc() and a table min-width together -- a CSS-only
// `sm:` variant would let those two desync under `table-layout: fixed`
// (the exact 2026-09-02 mobile-squish bug in Matchmaker's own comparison
// tool, which this hook was extracted out of verbatim so a second
// comparison table -- the trim-comparison view, 2026-09-19 -- could reuse
// the identical, already-verified hook rather than re-deriving it).
//
// Starts false and corrects on mount, which is safe wherever this is used
// today: every comparison table it feeds only ever renders inside an
// already-open modal, so there is no server-rendered flash to worry about.
export function useIsNarrowViewport(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    // A plain `resize` listener rather than matchMedia's `change` event.
    // Both are correct in a real browser; this is the more conservative of
    // the two, since it re-reads on any viewport change rather than only
    // on a breakpoint crossing, and the handler is a single number compare
    // (React bails out when the value is unchanged).
    //
    // Honest note on verification (2026-09-07, matchmaker.tsx): live
    // switching could NOT be confirmed in this project's browser harness.
    // The page is tested inside a same-origin iframe, and resizing that
    // iframe from the parent updates its `innerWidth` while firing NEITHER
    // `resize` NOR matchMedia `change` inside it (measured: 0 of each
    // across repeated resizes). Both branches were instead verified by
    // mounting fresh at each width. On a real device -- window resize, or
    // a phone rotating -- these events fire normally.
    const update = () => setNarrow(window.innerWidth < 640);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return narrow;
}
