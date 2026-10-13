import { describe, expect, it } from "vitest";
import { ageOnDate, registerSchema } from "@/lib/validation";
import { hashAuthToken, issueAuthToken } from "@/lib/auth-tokens";

describe("public-auth validation and tokens", () => {
  const base = {
    name: "Learner Name",
    email: "learner@example.test",
    phone: "",
    password: "Secure123",
    termsAccepted: true as const,
    privacyAccepted: true as const,
    captchaToken: "",
  };

  it("calculates age at the birthday boundary", () => {
    expect(ageOnDate(new Date("2008-08-16T00:00:00Z"), new Date("2026-08-16T00:00:00Z"))).toBe(18);
    expect(ageOnDate(new Date("2008-08-17T00:00:00Z"), new Date("2026-08-16T00:00:00Z"))).toBe(17);
  });

  it("requires a distinct guardian email for a minor", () => {
    const missing = registerSchema.safeParse({ ...base, dateOfBirth: "2012-01-01", guardianEmail: "" });
    expect(missing.success).toBe(false);
    const same = registerSchema.safeParse({ ...base, dateOfBirth: "2012-01-01", guardianEmail: base.email });
    expect(same.success).toBe(false);
    const valid = registerSchema.safeParse({ ...base, dateOfBirth: "2012-01-01", guardianEmail: "guardian@example.test" });
    expect(valid.success).toBe(true);
  });

  it("stores only a deterministic digest while issuing unpredictable tokens", () => {
    const first = issueAuthToken(60_000);
    const second = issueAuthToken(60_000);
    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).toBe(hashAuthToken(first.token));
    expect(first.tokenHash).not.toContain(first.token);
    expect(first.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
