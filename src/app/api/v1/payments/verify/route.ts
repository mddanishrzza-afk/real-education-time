import { NextResponse } from "next/server";
import { ApiError, errorResponse, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchRazorpayPayment, verifyCheckoutSignature } from "@/lib/payments/razorpay";
import { grantVerifiedPayment, publicPaymentOrder } from "@/lib/payments/service";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";
import { verifyPaymentSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const user = await requireApiUser();
    if (user.role !== "STUDENT") throw new ApiError(403, "STUDENT_ONLY", "A student account is required.");
    await enforceRateLimit(request, `payment-verify:${user.id}`, 20, 60 * 60_000);
    const input = verifyPaymentSchema.parse(await parseJsonBody(request));
    const order = await prisma.paymentOrder.findFirst({ where: { id: input.internalOrderId, userId: user.id, provider: "RAZORPAY" } });
    if (!order?.providerOrderId) throw new ApiError(404, "PAYMENT_ORDER_NOT_FOUND", "The payment order was not found.");
    if (!verifyCheckoutSignature(order.providerOrderId, input.providerPaymentId, input.signature)) {
      throw new ApiError(422, "INVALID_PAYMENT_SIGNATURE", "Payment verification failed.");
    }

    const payment = await fetchRazorpayPayment(input.providerPaymentId);
    if (payment.order_id !== order.providerOrderId || payment.amount !== order.amountPaise || payment.currency !== order.currency) {
      throw new ApiError(422, "PAYMENT_MISMATCH", "Gateway payment details do not match this order.");
    }
    if (payment.status !== "captured" || !payment.captured) {
      return NextResponse.json({ order: publicPaymentOrder(order), status: "PROCESSING", message: "Payment received and awaiting capture confirmation." }, { status: 202 });
    }

    const result = await grantVerifiedPayment({
      internalOrderId: order.id,
      providerOrderId: order.providerOrderId,
      providerPaymentId: payment.id,
      amountPaise: payment.amount,
      currency: payment.currency,
    });
    return NextResponse.json({ order: publicPaymentOrder(result.order), status: "PAID", next: "/access?payment=success" });
  } catch (error) {
    return errorResponse(error);
  }
}
