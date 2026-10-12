// Which kind of deployment is this code running in? Used to keep side effects (assigning
// searches, sending agent/alert emails, Stripe refunds, the hourly sweeps) away from preview
// builds and local development, which all share the production database.
//
// VERCEL_ENV alone is NOT enough: `vercel env pull` writes VERCEL_ENV="production" into
// .env.local, so a local `next dev` would otherwise look like production. VERCEL_REGION is set
// only by Vercel's runtime (it is not in .env.local), and NODE_ENV is "development" only under
// `next dev`. Anything that isn't positively a Vercel production deployment counts as "not
// production", so the guards stay on by default (for example a local `next start`).
//
// Plain module (no "use server"), safe to import from server code and cron routes.

export type RuntimeEnv = "production" | "preview" | "local" | "other";

export function runtimeEnv(env: NodeJS.ProcessEnv = process.env): RuntimeEnv {
  if (env.NODE_ENV === "development") return "local";
  if (env.NODE_ENV === "production" && env.VERCEL_ENV === "production" && env.VERCEL_REGION) {
    return "production";
  }
  if (env.NODE_ENV === "production" && env.VERCEL_ENV === "preview") return "preview";
  return "other";
}

export function isProductionDeploy(env: NodeJS.ProcessEnv = process.env): boolean {
  return runtimeEnv(env) === "production";
}

export function isPreviewDeploy(env: NodeJS.ProcessEnv = process.env): boolean {
  return runtimeEnv(env) === "preview";
}

export function isLocalDev(env: NodeJS.ProcessEnv = process.env): boolean {
  return runtimeEnv(env) === "local";
}
