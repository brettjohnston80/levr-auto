// Records every database request the five changed jobs would send in production with no ?only=, for
// the branch code and for main's code, against a fake database address (nothing real is contacted:
// fetch is replaced before anything loads). Every read answers "no rows", so each job stops after its
// first query, which is exactly the query that decides what it touches.
const calls: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL) => {
  calls.push(decodeURIComponent(String(input instanceof Request ? input.url : input)).replace("https://stub.invalid/rest/v1/", ""));
  return new Response("[]", { status: 200, headers: { "content-type": "application/json", "content-range": "*/0" } });
}) as typeof fetch;
Object.assign(process.env, { NODE_ENV: "production", VERCEL_ENV: "production", VERCEL_REGION: "pdx1",
  NEXT_PUBLIC_SUPABASE_URL: "https://stub.invalid", SUPABASE_SERVICE_ROLE_KEY: "stub", NEXT_PUBLIC_SUPABASE_ANON_KEY: "stub" });
const root = process.argv[2];
const day60 = await import(`${root}/src/lib/day60-extension`);
const digest = await import(`${root}/src/lib/notification-digest`);
const articles = await import(`${root}/src/lib/article-reminders`);
const out: Record<string, string[]> = {};
for (const [name, fn] of [["day60-deadline-reminder", day60.sendDay60Reminders], ["day60-pause-overdue-searches", day60.pauseOverdueSearches],
  ["day60-resume-reminder", day60.sendResumeReminders], ["notification-digest", digest.sendNotificationDigests], ["article-reminder", articles.sendArticleReminders]] as const) {
  calls.length = 0;
  try { await (fn as () => Promise<unknown>)(); } catch (e) { calls.push(`threw: ${e instanceof Error ? e.message : e}`); }
  out[name] = [...calls];
}
console.log(JSON.stringify(out));
