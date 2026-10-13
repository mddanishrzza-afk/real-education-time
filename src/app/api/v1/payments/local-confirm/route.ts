import { NextResponse } from "next/server";
import { ApiError, errorResponse, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { confirmLocalTestPayment, publicPaymentOrder } from "@/lib/payments/service";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";
import { localPaymentSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV === "production") throw new ApiError(404, "NOT_FOUND", "Route not found.");
    assertTrustedMutation(request);
    const user = await requireApiUser();
    await enforceRateLimit(request, `local-payment:${user.id}`, 10, 60_000);
    const input = localPaymentSchema.parse(await parseJsonBody(request));
    const result = await confirmLocalTestPayment(user.id, input.internalOrderId);
    return NextResponse.json({ order: publicPaymentOrder(result.order), status: "PAID", next: "/access?payment=success" });
  } catch (error) {
    return errorResponse(error);
  }
}
