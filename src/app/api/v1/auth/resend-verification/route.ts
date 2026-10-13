import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse, getClientIp, parseJsonBody } from "@/lib/api";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";
import { emailActionSchema } from "@/lib/validation";
import { verifyCaptcha } from "@/lib/captcha";
import { EMAIL_VERIFICATION_TTL_MS, GUARDIAN_CONSENT_TTL_MS, issueAuthToken } from "@/lib/auth-tokens";
import { sendGuardianConsentEmail, sendVerificationEmail } from "@/lib/email";

const genericResponse = () =>
  NextResponse.json({ message: "If the account is awaiting verification, fresh instructions will be sent." }, { status: 202 });

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    await enforceRateLimit(request, "verification-resend", 3, 30 * 60_000);
    const input = emailActionSchema.parse(await parseJsonBody(request));
    await verifyCaptcha(request, input.captchaToken);

    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        emailVerifiedAt: true,
        guardianEmail: true,
        guardianConsentAt: true,
      },
    });
    if (!user || user.status !== "PENDING_VERIFICATION") return genericResponse();

    const emailToken = user.emailVerifiedAt ? null : issueAuthToken(EMAIL_VERIFICATION_TTL_MS);
    const guardianToken = user.guardianEmail && !user.guardianConsentAt ? issueAuthToken(GUARDIAN_CONSENT_TTL_MS) : null;

    await prisma.$transaction(async (tx) => {
      if (emailToken) {
        await tx.emailVerificationToken.deleteMany({ where: { userId: user.id } });
        await tx.emailVerificationToken.create({
          data: { userId: user.id, tokenHash: emailToken.tokenHash, expiresAt: emailToken.expiresAt },
        });
      }
      if (guardianToken && user.guardianEmail) {
        await tx.guardianConsentToken.deleteMany({ where: { userId: user.id } });
        await tx.guardianConsentToken.create({
          data: {
            userId: user.id,
            guardianEmail: user.guardianEmail,
            tokenHash: guardianToken.tokenHash,
            expiresAt: guardianToken.expiresAt,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "AUTH_VERIFICATION_RESENT",
          resourceType: "User",
          resourceId: user.id,
          ipAddress: getClientIp(request),
        },
      });
    });

    try {
      if (emailToken) await sendVerificationEmail(user.email, user.name, emailToken.token);
      if (guardianToken && user.guardianEmail) {
        await sendGuardianConsentEmail(user.guardianEmail, user.name, guardianToken.token);
      }
    } catch (error) {
      console.error("Verification email delivery failed", { userId: user.id, error });
    }

    return genericResponse();
  } catch (error) {
    return errorResponse(error);
  }
}
