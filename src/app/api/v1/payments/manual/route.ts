import { NextResponse } from "next/server";
import { ApiError, errorResponse, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { publicPaymentOrder, submitManualUpiReference } from "@/lib/payments/service";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";
import { manualUpiSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const user = await requireApiUser();
    if (user.role !== "STUDENT" || !user.studentProfile) throw new ApiError(403, "STUDENT_ONLY", "A student account is required.");
    if (!user.emailVerifiedAt) throw new ApiError(403, "EMAIL_NOT_VERIFIED", "Verify your email before submitting a payment.");
    await enforceRateLimit(request, `manual-payment:${user.id}`, 5, 24 * 60 * 60_000);
    const input = manualUpiSchema.parse(await parseJsonBody(request));
    const order = await submitManualUpiReference(user.id, input.planCode, input.utr);
    return NextResponse.json({
      order: publicPaymentOrder(order),
      status: "PENDING_REVIEW",
      message: "UPI reference submitted. Access will unlock only after an administrator verifies receipt.",
    }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      return errorResponse(new ApiError(409, "UPI_REFERENCE_ALREADY_USED", "This UPI transaction reference has already been submitted."));
    }
    return errorResponse(error);
  }
}
