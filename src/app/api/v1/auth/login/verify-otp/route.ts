import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { ApiError, errorResponse, getClientIp, parseJsonBody } from "@/lib/api";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";
import { loginOtpSchema } from "@/lib/validation";
import { LOGIN_OTP_MAX_ATTEMPTS, loginOtpMatches } from "@/lib/login-otp";

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    await enforceRateLimit(request, "login-otp-verify", 10, 15 * 60_000);
    const input = loginOtpSchema.parse(await parseJsonBody(request));
    const now = new Date();

    const result = await prisma.$transaction(
      async (tx) => {
        const challenge = await tx.loginOtpChallenge.findUnique({
          where: { id: input.challengeId },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                status: true,
                studentProfile: { select: { onboardingCompleted: true } },
              },
            },
          },
        });

        if (!challenge) return { verified: false as const };
        if (
          challenge.expiresAt <= now ||
          challenge.attempts >= LOGIN_OTP_MAX_ATTEMPTS ||
          challenge.user.status !== "ACTIVE"
        ) {
          await tx.loginOtpChallenge.delete({ where: { id: challenge.id } });
          return { verified: false as const };
        }

        if (!loginOtpMatches(challenge.id, input.code, challenge.codeHash)) {
          const nextAttempts = challenge.attempts + 1;
          if (nextAttempts >= LOGIN_OTP_MAX_ATTEMPTS) {
            await tx.loginOtpChallenge.delete({ where: { id: challenge.id } });
          } else {
            await tx.loginOtpChallenge.update({
              where: { id: challenge.id },
              data: { attempts: { increment: 1 } },
            });
          }
          await tx.auditLog.create({
            data: {
              actorId: challenge.user.id,
              action: "AUTH_LOGIN_OTP_REJECTED",
              resourceType: "LoginOtpChallenge",
              resourceId: challenge.id,
              ipAddress: getClientIp(request),
            },
          });
          return { verified: false as const };
        }

        await tx.loginOtpChallenge.delete({ where: { id: challenge.id } });
        await tx.session.deleteMany({
          where: { userId: challenge.user.id, expiresAt: { lt: now } },
        });
        await tx.user.update({
          where: { id: challenge.user.id },
          data: { lastLoginAt: now },
        });
        await tx.auditLog.create({
          data: {
            actorId: challenge.user.id,
            action: "AUTH_LOGIN_OTP_VERIFIED",
            resourceType: "User",
            resourceId: challenge.user.id,
            ipAddress: getClientIp(request),
          },
        });

        return { verified: true as const, user: challenge.user };
      },
      { maxWait: 10_000, timeout: 10_000 },
    );

    if (!result.verified) {
      throw new ApiError(400, "INVALID_OTP", "OTP is incorrect or has expired.");
    }

    await createSession(result.user.id, request);
    const next =
      result.user.role === "STUDENT" && !result.user.studentProfile?.onboardingCompleted
        ? "/onboarding"
        : "/dashboard";

    return NextResponse.json({
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
      next,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
