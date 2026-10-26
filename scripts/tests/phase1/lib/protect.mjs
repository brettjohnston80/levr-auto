// Brett's identities, which no test may act as, sign in as, or write to (Brett, 2026-10-12 and
// 2026-10-24): his agent row (LEVRID 1) and the logins for bjohnston@levrauto.com,
// brett@levrauto.com and brettjohnston80@yahoo.com. Looked up at runtime, never hard-coded.
export const PROTECTED_EMAILS = ["bjohnston@levrauto.com", "brett@levrauto.com", "brettjohnston80@yahoo.com"];

/** Every id and email to protect. `client` must be an unguarded service-role client. */
export async function loadProtected(client) {
  const values = new Set(PROTECTED_EMAILS);
  const { data: row, error } = await client.from("agents").select("id, email, auth_user_id").eq("levrid", 1).maybeSingle();
  if (error) throw new Error(`protected identities: ${error.message}`);
  if (row) { values.add(row.id); if (row.auth_user_id) values.add(row.auth_user_id); if (row.email) values.add(row.email.toLowerCase()); }
  for (let page = 1; ; page++) {
    const { data, error: e } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (e) throw new Error(`protected identities: ${e.message}`);
    for (const u of data.users) if (values.has((u.email ?? "").toLowerCase())) values.add(u.id);
    if (data.users.length < 1000) break;
  }
  return values;
}

/**
 * A fetch for the service-role client that refuses any request, other than a read (GET/HEAD),
 * whose URL or body names a protected id or email: inserts, updates, deletes, database function
 * calls, auth admin changes, links, password or factor changes, sign-ins.
 */
export function guardedFetch(getProtected) {
  return async (input, init = {}) => {
    const method = (init.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      const url = String(input instanceof Request ? input.url : input).toLowerCase();
      const body = typeof init.body === "string" ? init.body.toLowerCase() : "";
      for (const v of await getProtected()) {
        const needle = v.toLowerCase();
        if (url.includes(needle) || body.includes(needle)) {
          throw new Error(`TEST GUARD: refused a ${method} naming Brett's account (${needle.includes("@") ? needle : needle.slice(0, 8) + "…"}) to ${url.split("?")[0].replace(/^https?:\/\/[^/]+/, "")}`);
        }
      }
    }
    return fetch(input, init);
  };
}
