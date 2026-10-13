"use client";

import { usePathname } from "next/navigation";

/**
 * The marketing header and footer, left out on the internal agent sign-in
 * pages (/agent and below; Phase 1, Chunk 1b). The plan's route-group move of
 * every page is deferred to the Phase 3 shell; this keeps the 1b change to
 * one wrapper instead of moving every route folder.
 */
export function SiteChrome({
  header,
  footer,
  children,
}: {
  header: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const internal = pathname === "/agent" || pathname.startsWith("/agent/");
  if (internal) return <main className="flex-1">{children}</main>;
  return (
    <>
      {header}
      <main className="flex-1">{children}</main>
      {footer}
    </>
  );
}
