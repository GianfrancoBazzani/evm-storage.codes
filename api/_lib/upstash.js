// Upstash Redis is only used for the optional "already compiled this
// contract before" cache shortcut. External contributors running
// `yarn vercel dev` without access to the project's Vercel/Upstash
// credentials should get a clean cache-miss, not a Redis connection error.
export function hasUpstashCredentials() {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
      (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)
  );
}
