import "server-only";
import { readFile } from "fs/promises";
import path from "path";

const PANDADOC_API_BASE = "https://api.pandadoc.com/public/v1";

function apiKey(): string {
  const key = process.env.PANDADOC_API_KEY;
  if (!key) {
    throw new Error("PANDADOC_API_KEY is not set.");
  }
  return key;
}

async function pandadocFetch(urlPath: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${PANDADOC_API_BASE}${urlPath}`, {
    ...init,
    headers: {
      Authorization: `API-Key ${apiKey()}`,
      ...init.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PandaDoc API error (${res.status}): ${text}`);
  }

  return res.json();
}

export interface CreateServiceAgreementInput {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

/**
 * Uploads the static service-agreement template and sends it to the
 * customer for signature. PandaDoc doesn't store uploaded files — the
 * template has to be re-uploaded on every document creation, not just
 * referenced by id. Document content is deliberately generic (no per-
 * customer text interpolation) — the signing record itself, tied to this
 * specific document and the customer's real email, is what identifies who
 * signed; deal specifics already live in our own DB.
 */
export async function createAndSendServiceAgreement(
  input: CreateServiceAgreementInput
): Promise<string> {
  const templatePath = path.join(process.cwd(), "src/lib/pandadoc/service-agreement-template.rtf");
  const fileBuffer = await readFile(templatePath);

  const form = new FormData();
  form.append("file", new Blob([fileBuffer], { type: "application/rtf" }), "service-agreement.rtf");
  form.append(
    "data",
    JSON.stringify({
      name: `LEVR Auto Service Agreement — ${input.email}`,
      recipients: [
        {
          email: input.email,
          first_name: input.firstName ?? undefined,
          last_name: input.lastName ?? undefined,
          role: "customer",
        },
      ],
    })
  );

  const created = (await pandadocFetch("/documents?upload", {
    method: "POST",
    body: form,
  })) as { id: string };

  const documentId = created.id;

  // Newly uploaded documents sit in 'document.uploaded' for a few seconds
  // while PandaDoc finishes processing into 'document.draft', which is
  // required before the document can be sent.
  await waitForDraftStatus(documentId);

  await pandadocFetch(`/documents/${documentId}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: "Please sign your LEVR Auto service agreement",
      message: "Please review and sign the attached service agreement to continue.",
    }),
  });

  return documentId;
}

async function waitForDraftStatus(documentId: string, maxAttempts = 10): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = (await pandadocFetch(`/documents/${documentId}`, { method: "GET" })) as {
      status: string;
    };
    if (status.status === "document.draft" || status.status === "document.sent") {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Timed out waiting for the PandaDoc document to finish processing.");
}

export interface SigningSession {
  sessionId: string;
  expiresAt: string;
}

/**
 * A signing session is what gets embedded client-side — short-lived (1h
 * default, matches PandaDoc's own default), distinct from the underlying
 * document, which persists in PandaDoc regardless of session expiry.
 */
export async function createSigningSession(
  documentId: string,
  recipientEmail: string
): Promise<SigningSession> {
  const result = (await pandadocFetch(`/documents/${documentId}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: recipientEmail, lifetime: 3600 }),
  })) as { id: string; expires_at: string };

  return { sessionId: result.id, expiresAt: result.expires_at };
}

/**
 * Authoritative status check against PandaDoc's own server — used for
 * manual reconciliation (the "Check signing status" button) rather than
 * relying solely on the client-side document.completed event, which can
 * miss a completion if the tab closes or the browser call fails
 * mid-flow. No webhook dependency (webhooks aren't available on the
 * current PandaDoc plan) — this just asks PandaDoc directly.
 */
export async function getDocumentStatus(documentId: string): Promise<string> {
  const result = (await pandadocFetch(`/documents/${documentId}`, { method: "GET" })) as {
    status: string;
  };
  return result.status;
}
