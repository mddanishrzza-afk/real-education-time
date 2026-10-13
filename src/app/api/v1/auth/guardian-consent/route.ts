import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, errorResponse, getClientIp, parseJsonBody } from "@/lib/api";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";
import { guardianConsentSchema } from "@/lib/validation";
import { hashAuthToken } from "@/lib/auth-tokens";

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    await enforceRateLimit(request, "guardian-consent", 10, 15 * 60_000);
    const input = guardianConsentSchema.parse(await parseJsonBody(request));
    const tokenHash = hashAuthToken(input.token);

    const result = await prisma.$transaction(async (tx) => {
      const record = await tx.guardianConsentToken.findUnique({
        where: { tokenHash },
        include: { user: { select: { id: true, status: true, emailVerifiedAt: true } } },
      });
      if (!record || record.expiresAt <= new Date()) {
        throw new ApiError(400, "INVALID_GUARDIAN_TOKEN", "This guardian-consent link is invalid or has expired.");
      }

      await tx.guardianConsentToken.delete({ where: { id: record.id } });
      const activate = record.user.status === "PENDING_VERIFICATION" && Boolean(record.user.emailVerifiedAt);
      await tx.user.update({
        where: { id: record.user.id },
        data: { guardianConsentAt: new Date(), ...(activate ? { status: "ACTIVE" } : {}) },
      });
      await tx.auditLog.create({
        data: {
          actorId: record.user.id,
          action: activate ? "AUTH_GUARDIAN_CONSENT_ACTIVATED" : "AUTH_GUARDIAN_CONSENT_RECEIVED",
          resourceType: "User",
          resourceId: record.user.id,
          ipAddress: getClientIp(request),
        },
      });
      return { activated: activate };
    });

    return NextResponse.json({
      ...result,
      message: result.activated
        ? "Guardian consent recorded. The learner account is now active."
        : "Guardian consent recorded. The learner must still verify their email before the account activates.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
