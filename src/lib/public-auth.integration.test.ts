import bcrypt from "bcryptjs";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { hashAuthToken } from "@/lib/auth-tokens";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { POST as login } from "@/app/api/v1/auth/login/route";
import { POST as verifyEmail } from "@/app/api/v1/auth/verify-email/route";
import { POST as guardianConsent } from "@/app/api/v1/auth/guardian-consent/route";
import { POST as resetPassword } from "@/app/api/v1/auth/reset-password/route";
import { POST as forgotPassword } from "@/app/api/v1/auth/forgot-password/route";
import { POST as verifyLoginOtp } from "@/app/api/v1/auth/login/verify-otp/route";

const emails = ["public-auth-adult@example.test", "public-auth-child@example.test"];

function post(path: string, body: unknown) {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `test-${path}` },
    body: JSON.stringify(body),
  });
}

afterEach(async () => {
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
});

describe("public account lifecycle", () => {
  it("refuses login and does not create a session while email verification is pending", async () => {
    const email = emails[0];
    const user = await prisma.user.create({
      data: {
        name: "Pending Learner",
        email,
        passwordHash: await bcrypt.hash("Secure123", 4),
        status: "PENDING_VERIFICATION",
        studentProfile: { create: {} },
      },
    });

    const response = await login(post("/api/v1/auth/login", {
      email,
      password: "Secure123",
      captchaToken: "",
    }));

    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("EMAIL_VERIFICATION_REQUIRED");
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("requires a one-time email OTP after valid credentials and limits incorrect OTP attempts", async () => {
    const email = emails[0];
    const originalProvider = process.env.EMAIL_PROVIDER;
    process.env.EMAIL_PROVIDER = "CONSOLE";

    try {
      const user = await prisma.user.create({
        data: {
          name: "OTP Learner",
          email,
          passwordHash: await bcrypt.hash("Secure123", 4),
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
          studentProfile: { create: {} },
        },
      });

      const response = await login(post("/api/v1/auth/login", {
        email,
        password: "Secure123",
        captchaToken: "",
      }));
      const payload = await response.json();

      expect(response.status).toBe(202);
      expect(payload.requiresOtp).toBe(true);
      expect(payload.developmentOtp).toMatch(/^\d{6}$/);
      expect(payload.maskedEmail).not.toBe(email);
      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
      expect(await prisma.loginOtpChallenge.count({ where: { userId: user.id } })).toBe(1);

      const rejected = await verifyLoginOtp(post("/api/v1/auth/login/verify-otp", {
        challengeId: payload.challengeId,
        code: payload.developmentOtp === "000000" ? "111111" : "000000",
      }));
      expect(rejected.status).toBe(400);
      expect((await rejected.json()).error.code).toBe("INVALID_OTP");
      expect((await prisma.loginOtpChallenge.findUniqueOrThrow({
        where: { id: payload.challengeId },
      })).attempts).toBe(1);
    } finally {
      if (originalProvider === undefined) delete process.env.EMAIL_PROVIDER;
      else process.env.EMAIL_PROVIDER = originalProvider;
    }
  });

  it("registers an adult as pending and activates only after one-time email verification", async () => {
    const email = emails[0];
    const response = await register(post("/api/v1/auth/register", {
      name: "Adult Learner",
      email,
      phone: "",
      password: "Secure123",
      dateOfBirth: "2000-01-01",
      guardianEmail: "",
      termsAccepted: true,
      privacyAccepted: true,
      captchaToken: "",
    }));
    expect(response.status).toBe(202);

    const pending = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { emailVerificationTokens: true },
    });
    expect(pending.status).toBe("PENDING_VERIFICATION");
    expect(pending.emailVerifiedAt).toBeNull();
    expect(pending.termsAcceptedAt).toBeInstanceOf(Date);
    expect(pending.privacyAcceptedAt).toBeInstanceOf(Date);
    expect(pending.emailVerificationTokens).toHaveLength(1);

    const rawToken = "adult-email-verification-token-that-is-long-enough";
    await prisma.emailVerificationToken.deleteMany({ where: { userId: pending.id } });
    await prisma.emailVerificationToken.create({
      data: { userId: pending.id, tokenHash: hashAuthToken(rawToken), expiresAt: new Date(Date.now() + 60_000) },
    });
    const verified = await verifyEmail(post("/api/v1/auth/verify-email", { token: rawToken }));
    expect(verified.status).toBe(200);
    expect((await verified.json()).activated).toBe(true);

    const active = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(active.status).toBe("ACTIVE");
    expect(active.emailVerifiedAt).toBeInstanceOf(Date);
    expect(await prisma.emailVerificationToken.count({ where: { userId: active.id } })).toBe(0);

    const replay = await verifyEmail(post("/api/v1/auth/verify-email", { token: rawToken }));
    expect(replay.status).toBe(400);
  });

  it("requires both learner verification and guardian consent for a minor", async () => {
    const email = emails[1];
    const response = await register(post("/api/v1/auth/register", {
      name: "Child Learner",
      email,
      phone: "",
      password: "Secure123",
      dateOfBirth: "2012-01-01",
      guardianEmail: "guardian@example.test",
      termsAccepted: true,
      privacyAccepted: true,
      captchaToken: "",
    }));
    expect(response.status).toBe(202);
    const learner = await prisma.user.findUniqueOrThrow({ where: { email } });

    const emailToken = "minor-email-verification-token-that-is-long-enough";
    const guardianToken = "minor-guardian-consent-token-that-is-long-enough";
    await prisma.$transaction([
      prisma.emailVerificationToken.deleteMany({ where: { userId: learner.id } }),
      prisma.guardianConsentToken.deleteMany({ where: { userId: learner.id } }),
      prisma.emailVerificationToken.create({ data: { userId: learner.id, tokenHash: hashAuthToken(emailToken), expiresAt: new Date(Date.now() + 60_000) } }),
      prisma.guardianConsentToken.create({ data: { userId: learner.id, guardianEmail: "guardian@example.test", tokenHash: hashAuthToken(guardianToken), expiresAt: new Date(Date.now() + 60_000) } }),
    ]);

    const verified = await verifyEmail(post("/api/v1/auth/verify-email", { token: emailToken }));
    expect((await verified.json()).activated).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { email } })).status).toBe("PENDING_VERIFICATION");

    const consented = await guardianConsent(post("/api/v1/auth/guardian-consent", { token: guardianToken, consentAccepted: true }));
    expect(consented.status).toBe(200);
    expect((await consented.json()).activated).toBe(true);
    const active = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(active.status).toBe("ACTIVE");
    expect(active.guardianConsentAt).toBeInstanceOf(Date);
  });

  it("keeps forgot-password responses generic while exposing a reset action only for local console-email testing", async () => {
    const email = emails[0];
    const originalProvider = process.env.EMAIL_PROVIDER;
    process.env.EMAIL_PROVIDER = "CONSOLE";

    try {
      const user = await prisma.user.create({
        data: {
          name: "Recovery Learner",
          email,
          passwordHash: await bcrypt.hash("OldPass123", 4),
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
          studentProfile: { create: {} },
        },
      });

      const knownResponse = await forgotPassword(post("/api/v1/auth/forgot-password", {
        email,
        captchaToken: "",
      }));
      const knownPayload = await knownResponse.json();
      const unknownResponse = await forgotPassword(post("/api/v1/auth/forgot-password", {
        email: "missing-recovery-user@example.test",
        captchaToken: "",
      }));
      const unknownPayload = await unknownResponse.json();

      expect(knownResponse.status).toBe(202);
      expect(unknownResponse.status).toBe(202);
      expect(knownPayload.message).toBe(unknownPayload.message);
      expect(knownPayload.message).not.toContain("eligible account");
      expect(knownPayload.developmentActionPath).toMatch(/^\/reset-password\?token=.+/);
      expect(unknownPayload.developmentActionPath).toBeUndefined();
      expect(await prisma.passwordResetToken.count({ where: { userId: user.id } })).toBe(1);
    } finally {
      if (originalProvider === undefined) delete process.env.EMAIL_PROVIDER;
      else process.env.EMAIL_PROVIDER = originalProvider;
    }
  });

  it("uses a one-time reset token, changes the hash, and revokes sessions", async () => {
    const email = emails[0];
    const user = await prisma.user.create({
      data: { name: "Reset Learner", email, passwordHash: await bcrypt.hash("OldPass123", 4), status: "ACTIVE", studentProfile: { create: {} } },
    });
    const rawToken = "password-reset-token-that-is-long-enough-for-validation";
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashAuthToken(rawToken), expiresAt: new Date(Date.now() + 60_000) },
    });
    await prisma.session.create({
      data: { userId: user.id, tokenHash: hashAuthToken("old-session"), expiresAt: new Date(Date.now() + 60_000) },
    });

    const response = await resetPassword(post("/api/v1/auth/reset-password", { token: rawToken, password: "NewPass456" }));
    expect(response.status).toBe(200);
    const changed = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await bcrypt.compare("NewPass456", changed.passwordHash)).toBe(true);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.passwordResetToken.count({ where: { userId: user.id } })).toBe(0);
  });
});
