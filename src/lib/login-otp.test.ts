import { afterEach, describe, expect, it } from "vitest";
import {
  canExposeDevelopmentOtp,
  hashLoginOtp,
  loginOtpMatches,
  maskEmailAddress,
} from "@/lib/login-otp";

const originalNodeEnv = process.env.NODE_ENV;
const originalEmailProvider = process.env.EMAIL_PROVIDER;

function setNodeEnv(value: string | undefined) {
  if (value === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
  else Object.defineProperty(process.env, "NODE_ENV", {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

afterEach(() => {
  setNodeEnv(originalNodeEnv);
  if (originalEmailProvider === undefined) delete process.env.EMAIL_PROVIDER;
  else process.env.EMAIL_PROVIDER = originalEmailProvider;
});

describe("login email OTP security", () => {
  it("binds a code hash to its challenge and verifies it with a timing-safe comparison", () => {
    const challengeId = "challenge-id-that-is-long-and-random";
    const hash = hashLoginOtp(challengeId, "123456");

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(loginOtpMatches(challengeId, "123456", hash)).toBe(true);
    expect(loginOtpMatches(challengeId, "654321", hash)).toBe(false);
    expect(loginOtpMatches("another-challenge-id-that-is-long", "123456", hash)).toBe(false);
  });

  it("masks the account address shown on the OTP screen", () => {
    expect(maskEmailAddress("learner@example.com")).toBe("le•••••@example.com");
  });

  it("never exposes a development OTP in production", () => {
    setNodeEnv("production");
    process.env.EMAIL_PROVIDER = "CONSOLE";
    expect(canExposeDevelopmentOtp()).toBe(false);
  });
});
