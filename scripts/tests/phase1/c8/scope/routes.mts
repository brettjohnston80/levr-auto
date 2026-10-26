// Production-mode check of the six job routes (branch code), against a fake database address:
// fetch is replaced before anything loads, every read answers "no rows", nothing real is contacted.
// For each route: a call with no ?only= (as Vercel Cron makes it) and a manual call with ?only=.
const calls: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL) => {
  calls.push(decodeURIComponent(String(input instanceof Request ? input.url : input)).replace("https://stub.invalid/rest/v1/", ""));
  return new Response("[]", { status: 200, headers: { "content-type": "application/json", "content-range": "*/0" } });
}) as typeof fetch;
Object.assign(process.env, { NODE_ENV: "production", VERCEL_ENV: "production", VERCEL_REGION: "pdx1", CRON_SECRET: "stub-secret",
  NEXT_PUBLIC_SUPABASE_URL: "https://stub.invalid", SUPABASE_SERVICE_ROLE_KEY: "stub", NEXT_PUBLIC_SUPABASE_ANON_KEY: "stub" });
const logs: string[] = []; const orig = console.log;
console.log = (...a: unknown[]) => { logs.push(a.map(String).join(" ")); };
const root = process.argv[2];
const { NextRequest } = await import(`${root}/node_modules/next/server.js`);
const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222";
const jobs = ["day60-deadline-reminder", "day60-pause-overdue-searches", "day60-resume-reminder", "notification-digest", "article-reminder", "agent-sweeps"];
const out: unknown[] = [];
for (const job of jobs) {
  const mod = await import(`${root}/src/app/api/cron/${job}/route.ts`);
  for (const q of ["", `?only=${A},${B}`, ...(job === "agent-sweeps" ? [`?alerts=${B}`] : [])]) {
    calls.length = 0; logs.length = 0;
    const res = await mod.GET(new NextRequest(`https://www.levrauto.com/api/cron/${job}${q}`, { headers: { authorization: "Bearer stub-secret" } }));
    const body = await res.json();
    out.push({ job, query: q || "(none)", status: res.status, scoped: body.scoped, onlyIds: body.onlyIds,
      scopedLog: logs.filter((l) => l.includes("[job-scoped]")), idsInQueries: calls.some((c) => c.includes(A) || c.includes(B)), firstQuery: calls[0] });
  }
}
console.log = orig;
console.log(JSON.stringify(out, null, 1));
