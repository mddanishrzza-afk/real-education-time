import { NextResponse } from "next/server";
import { ApiError, errorResponse, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { bankTransferDetails, publicPaymentOrder, submitBankTransferReference } from "@/lib/payments/service";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";
import { bankTransferSchema } from "@/lib/validation";

/**
 * Manual net-banking (bank transfer) payments.
 *
 * GET  — the configured destination account, so the access center only ever shows
 *        bank details that truly exist.
 * POST — a NEFT/IMPS reference for administrator review; access never unlocks
 *        from this route automatically.
 */
export async function GET() {
  try {
    await requireApiUser();
    return NextResponse.json({ netbanking: bankTransferDetails() }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const user = await requireApiUser();
    if (user.role !== "STUDENT" || !user.studentProfile) throw new ApiError(403, "STUDENT_ONLY", "A student account is required.");
    if (!user.emailVerifiedAt) throw new ApiError(403, "EMAIL_NOT_VERIFIED", "Verify your email before submitting a payment.");
    await enforceRateLimit(request, `netbanking-payment:${user.id}`, 5, 24 * 60 * 60_000);
    const input = bankTransferSchema.parse(await parseJsonBody(request));
    const order = await submitBankTransferReference(user.id, input.planCode, input.utr);
    return NextResponse.json(
      {
        order: publicPaymentOrder(order),
        status: "PENDING_REVIEW",
        message: "Bank reference submitted. Access unlocks only after an administrator verifies the transfer in the bank statement.",
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
