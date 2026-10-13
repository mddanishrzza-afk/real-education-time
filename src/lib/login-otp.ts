import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";

export const LOGIN_OTP_TTL_MS = 10 * 60 * 1_000;
export const LOGIN_OTP_MAX_ATTEMPTS = 5;

function otpSecret() {
  const configured = process.env.SESSION_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required to protect login OTPs");
  }
  return "real-education-time-local-otp-secret";
}

export function hashLoginOtp(challengeId: string, code: string) {
  return createHmac("sha256", otpSecret()).update(`${challengeId}:${code}`).digest("hex");
}

export function loginOtpMatches(challengeId: string, code: string, expectedHash: string) {
  const actual = Buffer.from(hashLoginOtp(challengeId, code), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function canExposeDevelopmentOtp() {
  return (
    process.env.NODE_ENV !== "production" &&
    (process.env.EMAIL_PROVIDER || "CONSOLE") === "CONSOLE"
  );
}

export function maskEmailAddress(email: string) {
  const [localPart, domain] = email.split("@");
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${"•".repeat(Math.max(3, Math.min(8, localPart.length - visible.length)))}@${domain}`;
}

export async function issueLoginOtp(userId: string) {
  const challengeId = randomBytes(24).toString("base64url");
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const expiresAt = new Date(Date.now() + LOGIN_OTP_TTL_MS);

  await prisma.$transaction([
    prisma.loginOtpChallenge.deleteMany({ where: { userId } }),
    prisma.loginOtpChallenge.create({
      data: {
        id: challengeId,
        userId,
        codeHash: hashLoginOtp(challengeId, code),
        expiresAt,
      },
    }),
  ]);

  return { challengeId, code, expiresAt };
}
