import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, errorResponse, getClientIp, parseJsonBody } from "@/lib/api";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";
import { ageOnDate, parseDateOfBirth, registerSchema } from "@/lib/validation";
import { verifyCaptcha } from "@/lib/captcha";
import { EMAIL_VERIFICATION_TTL_MS, GUARDIAN_CONSENT_TTL_MS, issueAuthToken } from "@/lib/auth-tokens";
import { sendGuardianConsentEmail, sendVerificationEmail } from "@/lib/email";

const acceptedResponse = () =>
  NextResponse.json(
    {
      message: "If this registration can be processed, verification instructions will be sent by email.",
      next: "/check-email?mode=register",
    },
    { status: 202 },
  );

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    await enforceRateLimit(request, "register", 5, 15 * 60_000);
    const input = registerSchema.parse(await parseJsonBody(request));
    await verifyCaptcha(request, input.captchaToken);

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: input.email }, ...(input.phone ? [{ phone: input.phone }] : [])] },
      select: { id: true },
    });
    if (existing) return acceptedResponse();

    const dateOfBirth = parseDateOfBirth(input.dateOfBirth);
    const isMinor = ageOnDate(dateOfBirth) < 18;
    const guardianEmail = isMinor ? input.guardianEmail : null;
    const emailToken = issueAuthToken(EMAIL_VERIFICATION_TTL_MS);
    const guardianToken = guardianEmail ? issueAuthToken(GUARDIAN_CONSENT_TTL_MS) : null;
    const passwordHash = await bcrypt.hash(input.password, 12);
    const acceptedAt = new Date();

    let user: { id: string; name: string; email: string; guardianEmail: string | null };
    try {
      user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name: input.name,
            email: input.email,
            phone: input.phone || null,
            passwordHash,
            status: "PENDING_VERIFICATION",
            dateOfBirth,
            guardianEmail,
            termsAcceptedAt: acceptedAt,
            privacyAcceptedAt: acceptedAt,
            studentProfile: { create: {} },
            emailVerificationTokens: {
              create: { tokenHash: emailToken.tokenHash, expiresAt: emailToken.expiresAt },
            },
            ...(guardianToken && guardianEmail
              ? {
                  guardianConsentTokens: {
                    create: {
                      guardianEmail,
                      tokenHash: guardianToken.tokenHash,
                      expiresAt: guardianToken.expiresAt,
                    },
                  },
                }
              : {}),
          },
          select: { id: true, name: true, email: true, guardianEmail: true },
        });
        await tx.auditLog.create({
          data: {
            actorId: created.id,
            action: "AUTH_REGISTER_PENDING",
            resourceType: "User",
            resourceId: created.id,
            ipAddress: getClientIp(request),
          },
        });
        return created;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) return acceptedResponse();
      throw error;
    }

    try {
      await sendVerificationEmail(user.email, user.name, emailToken.token);
      if (guardianToken && user.guardianEmail) {
        await sendGuardianConsentEmail(user.guardianEmail, user.name, guardianToken.token);
      }
    } catch (error) {
      console.error("Registration email delivery failed", { userId: user.id, error });
      throw new ApiError(503, "EMAIL_DELIVERY_FAILED", "Account created, but email delivery failed. Please use resend verification shortly.");
    }

    return acceptedResponse();
  } catch (error) {
    return errorResponse(error);
  }
}
