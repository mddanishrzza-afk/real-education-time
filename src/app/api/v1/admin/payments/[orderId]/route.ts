import { NextResponse } from "next/server";
import { ApiError, errorResponse, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { reviewManualPayment } from "@/lib/payments/service";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";
import { manualPaymentReviewSchema } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    assertTrustedMutation(request);
    const user = await requireApiUser();
    if (user.role !== "ADMIN") throw new ApiError(403, "ADMIN_ONLY", "Administrator access is required.");
    await enforceRateLimit(request, `payment-review:${user.id}`, 60, 60 * 60_000);
    const { orderId } = await params;
    const input = manualPaymentReviewSchema.parse(await parseJsonBody(request));
    const result = await reviewManualPayment(user.id, orderId, input.approved, input.note);
    return NextResponse.json({ order: result.order, entitlement: result.entitlement });
  } catch (error) {
    return errorResponse(error);
  }
}
