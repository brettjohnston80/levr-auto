"use client";

import { usePathname } from "next/navigation";

/**
 * The marketing header and footer, left out on the internal agent pages:
 * sign-in (/agent and below; Chunk 1b) and the agent dashboard pages
 * (/internal and below; Chunk 1d), which have their own agent header. The plan's route-group move of
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
  const internal = ["/agent", "/internal"].some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (internal) return <main className="flex-1">{children}</main>;
  return (
    <>
      {header}
      <main className="flex-1">{children}</main>
      {footer}
    </>
  );
}
