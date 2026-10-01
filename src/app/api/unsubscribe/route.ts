import { NextRequest, NextResponse } from "next/server";
import { verifyUnpaidReminderUnsubscribeToken } from "@/lib/unsubscribe-token";
import { unsubscribeFromUnpaidReminders } from "@/lib/unpaid-reminders";

// One-click unsubscribe for the unpaid-search reminders (RFC 8058): mail
// clients POST here from the List-Unsubscribe header. A GET (someone opening
// the header URL) goes to the human page, which does the same thing.

export async function POST(request: NextRequest) {
  const customerId = verifyUnpaidReminderUnsubscribeToken(request.nextUrl.searchParams.get("token"));
  if (!customerId || !(await unsubscribeFromUnpaidReminders(customerId))) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  const url = new URL("/unsubscribe", request.nextUrl.origin);
  const token = request.nextUrl.searchParams.get("token");
  if (token) url.searchParams.set("token", token);
  return NextResponse.redirect(url, 303);
}
