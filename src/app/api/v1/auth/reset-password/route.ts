import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, errorResponse, getClientIp, parseJsonBody } from "@/lib/api";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";
import { resetPasswordSchema } from "@/lib/validation";
import { hashAuthToken } from "@/lib/auth-tokens";

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    await enforceRateLimit(request, "reset-password", 5, 30 * 60_000);
    const input = resetPasswordSchema.parse(await parseJsonBody(request));
    const tokenHash = hashAuthToken(input.token);
    const passwordHash = await bcrypt.hash(input.password, 12);

    await prisma.$transaction(
      async (tx) => {
        const record = await tx.passwordResetToken.findUnique({
          where: { tokenHash },
          select: { id: true, userId: true, expiresAt: true },
        });
        if (!record || record.expiresAt <= new Date()) {
          throw new ApiError(400, "INVALID_RESET_TOKEN", "This password-reset link is invalid or has expired.");
        }
        await tx.passwordResetToken.delete({ where: { id: record.id } });
        await tx.passwordResetToken.deleteMany({ where: { userId: record.userId } });
        await tx.session.deleteMany({ where: { userId: record.userId } });
        await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
        await tx.auditLog.create({
          data: {
            actorId: record.userId,
            action: "AUTH_PASSWORD_RESET_COMPLETED",
            resourceType: "User",
            resourceId: record.userId,
            ipAddress: getClientIp(request),
          },
        });
      },
      { maxWait: 10_000, timeout: 30_000 },
    );

    return NextResponse.json({ message: "Password changed. Sign in with your new password.", next: "/login?reset=1" });
  } catch (error) {
    return errorResponse(error);
  }
}
