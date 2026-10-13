import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as cleanupExpiredAuth } from "@/app/api/internal/cron/cleanup/route";
import { verifyCaptcha } from "@/lib/captcha";
import { enforceRateLimit } from "@/lib/security";

function request(headers?: HeadersInit) {
  return new Request("https://learn.example.test/api/test", { headers });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("production abuse-control failure behavior", () => {
  it("fails closed when Turnstile is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");

    await expect(verifyCaptcha(request(), "token")).rejects.toMatchObject({
      status: 503,
      code: "CAPTCHA_UNAVAILABLE",
    });
  });

  it("fails closed when Redis is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    await expect(enforceRateLimit(request(), "test", 1, 60_000)).rejects.toMatchObject({
      status: 503,
      code: "RATE_LIMIT_UNAVAILABLE",
    });
  });

  it("fails closed when configured providers are unreachable", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "turnstile-secret");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "redis-token");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("provider offline"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(verifyCaptcha(request(), "token")).rejects.toMatchObject({ status: 503, code: "CAPTCHA_UNAVAILABLE" });
    await expect(enforceRateLimit(request(), "test", 1, 60_000)).rejects.toMatchObject({ status: 503, code: "RATE_LIMIT_UNAVAILABLE" });
    expect(errorLog).toHaveBeenCalledTimes(2);
  });
});

describe("cleanup cron authorization", () => {
  it("rejects missing and incorrect bearer credentials", async () => {
    vi.stubEnv("CRON_SECRET", "a-production-length-cron-secret");

    expect((await cleanupExpiredAuth(request())).status).toBe(401);
    expect((await cleanupExpiredAuth(request({ authorization: "Bearer incorrect" }))).status).toBe(401);
  });

  it("accepts the configured bearer credential", async () => {
    const secret = "a-production-length-cron-secret";
    vi.stubEnv("CRON_SECRET", secret);

    expect((await cleanupExpiredAuth(request({ authorization: `Bearer ${secret}` }))).status).toBe(200);
  });
});
