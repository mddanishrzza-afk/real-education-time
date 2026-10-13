import { NextResponse } from "next/server";
import { ApiError, errorResponse, parseJsonBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { createPaymentOrder, listUserPaymentHistory, publicPaymentOrder } from "@/lib/payments/service";
import { assertTrustedMutation, enforceRateLimit } from "@/lib/security";
import { createPaymentOrderSchema } from "@/lib/validation";

function assertStudent(user: Awaited<ReturnType<typeof requireApiUser>>) {
  if (user.role !== "STUDENT" || !user.studentProfile) throw new ApiError(403, "STUDENT_ONLY", "A student account is required.");
  if (!user.emailVerifiedAt) throw new ApiError(403, "EMAIL_NOT_VERIFIED", "Verify your email before purchasing access.");
}

export async function GET() {
  try {
    const user = await requireApiUser();
    assertStudent(user);
    const orders = await listUserPaymentHistory(user.id);
    return NextResponse.json({
      orders: orders.map((order) => ({ ...publicPaymentOrder(order), plan: order.plan })),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const user = await requireApiUser();
    assertStudent(user);
    await enforceRateLimit(request, `payment-order:${user.id}`, 10, 60 * 60_000);
    const input = createPaymentOrderSchema.parse(await parseJsonBody(request));
    const result = await createPaymentOrder(user.id, input.planCode);
    return NextResponse.json({ order: publicPaymentOrder(result.order), checkout: result.checkout }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
