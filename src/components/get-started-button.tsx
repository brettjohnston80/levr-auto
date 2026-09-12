"use client";

import { useDriveTransition } from "@/components/drive-transition-provider";

type Props = {
  targetId?: string;
  className: string;
  children: React.ReactNode;
  /**
   * Runs immediately before navigating. Added for the Matchmaker's
   * "choose this car" hand-off, which needs to stash a pre-fill while the
   * chosen vehicle is still in scope -- `/matchmaker` has no `#get-started`
   * element, so goTo() falls through to a real `router.push("/#get-started")`
   * and the component doing the choosing is gone by the time intake mounts.
   *
   * Optional, and the four existing call sites (hero, site header, mobile
   * nav, CTA section) deliberately do not pass it -- their behaviour is
   * unchanged. Must stay synchronous: navigation is not awaited on it.
   */
  onBeforeNavigate?: () => void;
};

export function GetStartedButton({
  targetId = "get-started",
  className,
  children,
  onBeforeNavigate,
}: Props) {
  const { goTo } = useDriveTransition();

  return (
    <button
      type="button"
      onClick={() => {
        onBeforeNavigate?.();
        goTo(targetId);
      }}
      className={className}
    >
      {children}
    </button>
  );
}
