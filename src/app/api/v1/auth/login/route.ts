import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, errorResponse, getClientIp, parseJsonBody } from "@/lib/api";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";
import { loginSchema } from "@/lib/validation";
import { verifyCaptcha } from "@/lib/captcha";
import { sendLoginOtpEmail } from "@/lib/email";
import {
  canExposeDevelopmentOtp,
  issueLoginOtp,
  LOGIN_OTP_TTL_MS,
  maskEmailAddress,
} from "@/lib/login-otp";

const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    await enforceRateLimit(request, "login", 10, 15 * 60_000);
    const input = loginSchema.parse(await parseJsonBody(request));
    await verifyCaptcha(request, input.captchaToken);

    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, email: true, name: true, passwordHash: true, status: true, emailVerifiedAt: true },
    });
    const valid = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    }
    if (user.status === "PENDING_VERIFICATION") {
      if (!user.emailVerifiedAt) {
        throw new ApiError(403, "EMAIL_VERIFICATION_REQUIRED", "Verify your email before signing in. You can resend the verification email below.");
      }
      throw new ApiError(403, "GUARDIAN_CONSENT_REQUIRED", "This learner account is waiting for guardian consent.");
    }
    if (user.status !== "ACTIVE") {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    }

    const otp = await issueLoginOtp(user.id);
    try {
      await sendLoginOtpEmail(user.email, user.name, otp.code);
    } catch (error) {
      await prisma.loginOtpChallenge.deleteMany({ where: { id: otp.challengeId } });
      console.error("Login OTP delivery failed", { userId: user.id, error });
      throw new ApiError(503, "OTP_DELIVERY_FAILED", "We could not send the sign-in OTP. Please try again shortly.");
    }

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "AUTH_LOGIN_OTP_SENT",
        resourceType: "LoginOtpChallenge",
        resourceId: otp.challengeId,
        ipAddress: getClientIp(request),
      },
    });

    return NextResponse.json(
      {
        requiresOtp: true,
        challengeId: otp.challengeId,
        maskedEmail: maskEmailAddress(user.email),
        expiresInSeconds: Math.floor(LOGIN_OTP_TTL_MS / 1_000),
        ...(canExposeDevelopmentOtp() ? { developmentOtp: otp.code } : {}),
      },
      { status: 202, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
