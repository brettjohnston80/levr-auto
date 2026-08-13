import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PandaDoc signs webhooks with HMAC-SHA256 over the raw request body,
 * passed as a `signature` query param — not a header, and not the parsed
 * JSON (whitespace/key-order differences would break a re-serialized
 * comparison). Must read the body as raw text before any JSON.parse.
 */
function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.PANDADOC_WEBHOOK_SECRET;
  if (!secret || !signature) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const signatureBuf = Buffer.from(signature, "utf8");

  if (expectedBuf.length !== signatureBuf.length) {
    return false;
  }

  return timingSafeEqual(expectedBuf, signatureBuf);
}

/**
 * Marks a service_agreement document signed once PandaDoc reports it
 * completed. The exact payload shape here hasn't been confirmed against a
 * real webhook delivery (see CLAUDE.md) — localhost can't receive one, and
 * PandaDoc doesn't store/replay a sample. Extraction is deliberately
 * defensive (tries a couple of likely shapes, logs anything it can't
 * parse) so the first real delivery is diagnosable via Vercel logs rather
 * than silently dropped.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.nextUrl.searchParams.get("signature");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let events: unknown;
  try {
    events = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventList = Array.isArray(events) ? events : [events];
  const admin = createAdminClient();

  for (const event of eventList) {
    const record = event as Record<string, unknown>;
    const data = (record.data ?? record) as Record<string, unknown>;
    const documentId = typeof data.id === "string" ? data.id : null;
    const status = typeof data.status === "string" ? data.status : null;

    if (!documentId || !status) {
      console.warn("Unrecognized PandaDoc webhook event shape:", JSON.stringify(event));
      continue;
    }

    if (!status.includes("completed")) {
      continue;
    }

    const { error } = await admin
      .from("documents")
      .update({ signed_at: new Date().toISOString() })
      .eq("external_signature_id", documentId)
      .eq("type", "service_agreement")
      .is("signed_at", null);

    if (error) {
      console.error("Failed to mark service agreement signed:", error.message);
    }
  }

  return NextResponse.json({ ok: true });
}
