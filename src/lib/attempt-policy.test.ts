import { describe, expect, it } from "vitest";
import { hasReachedAttemptLimit } from "@/lib/attempt-policy";

describe("test-attempt policy", () => {
  it("never applies a per-test attempt cap during an active one-hour trial", () => {
    expect(hasReachedAttemptLimit(1, 1, "TRIAL")).toBe(false);
    expect(hasReachedAttemptLimit(1, 100, "TRIAL")).toBe(false);
  });

  it("retains configured test caps for permanent category access", () => {
    expect(hasReachedAttemptLimit(2, 1, "ENTITLEMENT")).toBe(false);
    expect(hasReachedAttemptLimit(2, 2, "ENTITLEMENT")).toBe(true);
  });

  it("treats an absent or non-positive cap as unlimited", () => {
    expect(hasReachedAttemptLimit(null, 10_000, "ENTITLEMENT")).toBe(false);
    expect(hasReachedAttemptLimit(0, 10_000, "ENTITLEMENT")).toBe(false);
  });
});
