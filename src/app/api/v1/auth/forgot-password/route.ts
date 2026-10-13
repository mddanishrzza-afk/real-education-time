import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse, getClientIp, parseJsonBody } from "@/lib/api";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";
import { emailActionSchema } from "@/lib/validation";
import { verifyCaptcha } from "@/lib/captcha";
import { issueAuthToken, PASSWORD_RESET_TTL_MS } from "@/lib/auth-tokens";
import { sendPasswordResetEmail } from "@/lib/email";

const GENERIC_MESSAGE = "अगर यह email registered है, तो password-reset link भेज दिया जाएगा। सुरक्षा के लिए हम यह नहीं बताते कि account मौजूद है या नहीं।";

const genericResponse = (developmentActionPath?: string) =>
  NextResponse.json(
    {
      message: GENERIC_MESSAGE,
      ...(process.env.NODE_ENV !== "production" && developmentActionPath
        ? { developmentActionPath }
        : {}),
    },
    { status: 202 },
  );

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    await enforceRateLimit(request, "forgot-password", 3, 30 * 60_000);
    const input = emailActionSchema.parse(await parseJsonBody(request));
    await verifyCaptcha(request, input.captchaToken);

    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, email: true, name: true, status: true },
    });
    if (!user || !["ACTIVE", "PENDING_VERIFICATION"].includes(user.status)) return genericResponse();

    const resetToken = issueAuthToken(PASSWORD_RESET_TTL_MS);
    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await tx.passwordResetToken.create({
        data: { userId: user.id, tokenHash: resetToken.tokenHash, expiresAt: resetToken.expiresAt },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "AUTH_PASSWORD_RESET_REQUESTED",
          resourceType: "User",
          resourceId: user.id,
          ipAddress: getClientIp(request),
        },
      });
    });

    try {
      await sendPasswordResetEmail(user.email, user.name, resetToken.token);
    } catch (error) {
      console.error("Password reset email delivery failed", { userId: user.id, error });
    }
    const usesDevelopmentConsole =
      process.env.NODE_ENV !== "production" &&
      (process.env.EMAIL_PROVIDER || "CONSOLE") === "CONSOLE";
    return genericResponse(
      usesDevelopmentConsole
        ? `/reset-password?token=${encodeURIComponent(resetToken.token)}`
        : undefined,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
