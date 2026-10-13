import { NextResponse } from "next/server";
import { ApiError, errorResponse } from "@/lib/api";
import { processRazorpayWebhook } from "@/lib/payments/webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (declaredLength > 1_000_000) throw new ApiError(413, "WEBHOOK_TOO_LARGE", "Webhook payload is too large.");
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > 1_000_000) throw new ApiError(413, "WEBHOOK_TOO_LARGE", "Webhook payload is too large.");
    const signature = request.headers.get("x-razorpay-signature") || "";
    const externalEventId = request.headers.get("x-razorpay-event-id");
    const result = await processRazorpayWebhook({ rawBody, signature, externalEventId });
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
