import { createHash } from "node:crypto";
import { ApiError, getClientIp } from "@/lib/api";

type Bucket = { count: number; resetAt: number };
const developmentBuckets = new Map<string, Bucket>();

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function rateLimitKey(request: Request, scope: string) {
  const identity = `${scope}:${getClientIp(request)}`;
  return `ret:rate:${createHash("sha256").update(identity).digest("hex")}`;
}

function enforceDevelopmentRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = developmentBuckets.get(key);
  if (!current || current.resetAt <= now) {
    developmentBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) {
    throw new ApiError(429, "RATE_LIMITED", "Too many requests. Please wait and try again.");
  }
  current.count += 1;
}

/**
 * Atomic fixed-window limiter backed by the Upstash-compatible Redis REST API.
 * Production fails closed when Redis is unconfigured or unavailable. Local
 * development uses a process-local fallback so the application remains easy
 * to run without cloud credentials.
 */
export async function enforceRateLimit(request: Request, scope: string, limit: number, windowMs: number) {
  const key = rateLimitKey(request, scope);
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    if (isProduction()) {
      throw new ApiError(503, "RATE_LIMIT_UNAVAILABLE", "Request protection is temporarily unavailable.");
    }
    enforceDevelopmentRateLimit(key, limit, windowMs);
    return;
  }

  const script = [
    "local count = redis.call('INCR', KEYS[1])",
    "if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
    "return count",
  ].join("; ");

  try {
    const response = await fetch(redisUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${redisToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(["EVAL", script, "1", key, String(windowMs)]),
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) throw new Error(`Redis REST returned ${response.status}`);
    const payload = (await response.json()) as { result?: number | string; error?: string };
    if (payload.error) throw new Error("Redis REST command failed");
    const count = Number(payload.result);
    if (!Number.isFinite(count)) throw new Error("Redis REST returned an invalid count");
    if (count > limit) {
      throw new ApiError(429, "RATE_LIMITED", "Too many requests. Please wait and try again.");
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error("Distributed rate limiter unavailable", error);
    if (isProduction()) {
      throw new ApiError(503, "RATE_LIMIT_UNAVAILABLE", "Request protection is temporarily unavailable.");
    }
    enforceDevelopmentRateLimit(key, limit, windowMs);
  }
}

/** Reject cross-site cookie-authenticated mutations. Missing Origin is allowed for non-browser clients. */
export function assertTrustedMutation(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    throw new ApiError(403, "CROSS_SITE_REQUEST", "Cross-site request blocked.");
  }

  const origin = request.headers.get("origin");
  if (!origin) return;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, "INVALID_ORIGIN", "Invalid request origin.");
  }

  const allowedHosts = [request.headers.get("host"), request.headers.get("x-forwarded-host")]
    .filter(Boolean)
    .flatMap((host) => host!.split(",").map((value) => value.trim()));
  const appUrl = process.env.APP_URL;
  if (appUrl) {
    try {
      allowedHosts.push(new URL(appUrl).host);
    } catch {
      // Environment validation reports malformed APP_URL; do not trust it here.
    }
  }

  if (allowedHosts.length > 0 && !allowedHosts.includes(originHost)) {
    throw new ApiError(403, "INVALID_ORIGIN", "Request origin is not allowed.");
  }
}
