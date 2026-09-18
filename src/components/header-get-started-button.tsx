"use client";

import { GetStartedButton } from "@/components/get-started-button";
import { useSignedIn } from "@/lib/use-signed-in";

/**
 * The header's own "Get Started" -- hidden once a customer is signed in
 * (2026-09-18), since showing it alongside their name is redundant/
 * confusing for someone who likely already has a search in progress.
 * Deliberately NOT the same component the homepage hero and CTA section
 * use directly (`GetStartedButton`, unmodified) -- those stay visible
 * unconditionally, and are the real entry point for a signed-in customer
 * who wants to start an additional search (reachable from "/" regardless
 * of auth state; nothing new needed for that).
 *
 * Renders nothing while sign-in state is still resolving, same "don't
 * guess wrong in either direction" tradeoff HeaderAccountLink already
 * makes -- showing it and then hiding it a moment later (or the reverse)
 * would be worse than the brief blank state this produces on first paint.
 */
export function HeaderGetStartedButton({
  className,
  children,
  wrapperClassName,
  onClick,
}: {
  className: string;
  children: React.ReactNode;
  /** MobileNavMenu positions this at the bottom of its flex-col overlay
   *  (`mt-auto pb-4`) -- passed through here, not applied unconditionally
   *  in the caller, so that div genuinely doesn't exist in the tree when
   *  signed in, rather than rendering empty (which would still take up its
   *  own padding as a stray gap at the bottom of the menu). */
  wrapperClassName?: string;
  /** MobileNavMenu's own `close`, so tapping this also collapses the
   *  full-screen overlay, same as every other link/button in it. */
  onClick?: () => void;
}) {
  const signedIn = useSignedIn();

  if (signedIn === null || signedIn) return null;

  const button = (
    <GetStartedButton className={className} onBeforeNavigate={onClick}>
      {children}
    </GetStartedButton>
  );

  if (!wrapperClassName) return button;

  return <div className={wrapperClassName}>{button}</div>;
}
