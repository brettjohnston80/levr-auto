"use client";

import { useDriveTransition } from "@/components/drive-transition-provider";

type Props = {
  targetId?: string;
  className: string;
  children: React.ReactNode;
};

export function GetStartedButton({ targetId = "get-started", className, children }: Props) {
  const { goTo } = useDriveTransition();

  return (
    <button type="button" onClick={() => goTo(targetId)} className={className}>
      {children}
    </button>
  );
}
