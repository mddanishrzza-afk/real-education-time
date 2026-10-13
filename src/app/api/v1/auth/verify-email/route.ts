import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, errorResponse, getClientIp, parseJsonBody } from "@/lib/api";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";
import { tokenActionSchema } from "@/lib/validation";
import { hashAuthToken } from "@/lib/auth-tokens";

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    await enforceRateLimit(request, "email-verification", 10, 15 * 60_000);
    const input = tokenActionSchema.parse(await parseJsonBody(request));
    const tokenHash = hashAuthToken(input.token);

    const result = await prisma.$transaction(async (tx) => {
      const record = await tx.emailVerificationToken.findUnique({
        where: { tokenHash },
        include: {
          user: {
            select: { id: true, status: true, guardianEmail: true, guardianConsentAt: true },
          },
        },
      });
      if (!record || record.expiresAt <= new Date()) {
        throw new ApiError(400, "INVALID_VERIFICATION_TOKEN", "This verification link is invalid or has expired.");
      }

      await tx.emailVerificationToken.delete({ where: { id: record.id } });
      const activate =
        record.user.status === "PENDING_VERIFICATION" &&
        (!record.user.guardianEmail || Boolean(record.user.guardianConsentAt));
      await tx.user.update({
        where: { id: record.user.id },
        data: { emailVerifiedAt: new Date(), ...(activate ? { status: "ACTIVE" } : {}) },
      });
      await tx.auditLog.create({
        data: {
          actorId: record.user.id,
          action: activate ? "AUTH_EMAIL_VERIFIED_ACTIVATED" : "AUTH_EMAIL_VERIFIED",
          resourceType: "User",
          resourceId: record.user.id,
          ipAddress: getClientIp(request),
        },
      });
      return { activated: activate, guardianPending: Boolean(record.user.guardianEmail && !record.user.guardianConsentAt) };
    });

    return NextResponse.json({
      ...result,
      message: result.activated
        ? "Email verified. You can now sign in."
        : "Email verified. The account will activate after guardian consent is confirmed.",
      next: "/login?verified=1",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
