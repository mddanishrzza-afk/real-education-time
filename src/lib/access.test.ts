import { describe, expect, it } from "vitest";
import { evaluateAccess, TRIAL_DURATION_MS } from "@/lib/access";

const now = new Date("2026-08-17T06:00:00.000Z");

describe("access decisions", () => {
  it("allows a valid permanent category entitlement", () => {
    const decision = evaluateAccess("SCHOOL_6_12", {
      entitlements: [{ category: "SCHOOL_6_12", startsAt: new Date(now.getTime() - 1_000), expiresAt: null, revokedAt: null }],
      trial: null,
    }, now);
    expect(decision).toEqual({ allowed: true, source: "ENTITLEMENT", expiresAt: null });
  });

  it("does not let an entitlement unlock a different category", () => {
    const decision = evaluateAccess("BOARD_COMPETITIVE", {
      entitlements: [{ category: "SCHOOL_6_12", startsAt: new Date(now.getTime() - 1_000), expiresAt: null, revokedAt: null }],
      trial: null,
    }, now);
    expect(decision).toEqual({ allowed: false, source: "NONE", reason: "NOT_STARTED" });
  });

  it("allows both categories only while the one-time trial is active", () => {
    const trial = { startsAt: now, expiresAt: new Date(now.getTime() + TRIAL_DURATION_MS) };
    expect(evaluateAccess("SCHOOL_6_12", { entitlements: [], trial }, now).source).toBe("TRIAL");
    expect(evaluateAccess("BOARD_COMPETITIVE", { entitlements: [], trial }, now).source).toBe("TRIAL");
    expect(evaluateAccess("SCHOOL_6_12", { entitlements: [], trial }, trial.expiresAt)).toEqual({
      allowed: false,
      source: "NONE",
      reason: "TRIAL_EXPIRED",
    });
  });

  it("rejects revoked and expired entitlements", () => {
    const decision = evaluateAccess("SCHOOL_6_12", {
      entitlements: [
        { category: "SCHOOL_6_12", startsAt: new Date(now.getTime() - 2_000), expiresAt: new Date(now.getTime() - 1), revokedAt: null },
        { category: "SCHOOL_6_12", startsAt: new Date(now.getTime() - 2_000), expiresAt: null, revokedAt: now },
      ],
      trial: null,
    }, now);
    expect(decision.allowed).toBe(false);
  });
});
