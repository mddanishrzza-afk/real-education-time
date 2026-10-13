import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { findPaymentOrderByProviderId, grantVerifiedPayment } from "@/lib/payments/service";
import { verifyWebhookSignature } from "@/lib/payments/razorpay";

type RazorpayWebhook = {
  event?: string;
  payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string; status?: string } } };
};

const privateGatewayFields = new Set(["email", "contact", "vpa", "card", "token", "bank", "wallet", "acquirer_data"]);

function sanitizedPayload(value: unknown): Prisma.JsonValue {
  if (Array.isArray(value)) return value.map(sanitizedPayload);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, privateGatewayFields.has(key) ? "[REDACTED]" : sanitizedPayload(item)]),
    ) as Prisma.JsonObject;
  }
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

export async function processRazorpayWebhook(input: { rawBody: string; signature: string; externalEventId?: string | null }) {
  if (!verifyWebhookSignature(input.rawBody, input.signature)) throw new ApiError(401, "INVALID_WEBHOOK_SIGNATURE", "Invalid payment webhook signature.");

  let payload: RazorpayWebhook;
  try {
    payload = JSON.parse(input.rawBody) as RazorpayWebhook;
  } catch {
    throw new ApiError(400, "INVALID_WEBHOOK_BODY", "Invalid webhook JSON.");
  }
  const eventType = typeof payload.event === "string" ? payload.event : "unknown";
  const externalEventId = input.externalEventId?.slice(0, 200) || createHash("sha256").update(input.rawBody).digest("hex");
  const signatureHash = createHash("sha256").update(input.signature).digest("hex");

  const existing = await prisma.paymentWebhookEvent.findUnique({
    where: { provider_externalEventId: { provider: "RAZORPAY", externalEventId } },
  });
  if (existing && existing.signatureHash !== signatureHash) {
    throw new ApiError(409, "WEBHOOK_EVENT_ID_REUSED", "The webhook event identifier was reused with a different payload.");
  }
  if (existing?.status === "PROCESSED" || existing?.status === "IGNORED") return { duplicate: true, status: existing.status };

  // Upsert closes the concurrent first-delivery race where two workers both observe
  // no row and then attempt to create the same provider event identifier.
  const event = await prisma.paymentWebhookEvent.upsert({
    where: { provider_externalEventId: { provider: "RAZORPAY", externalEventId } },
    create: {
      provider: "RAZORPAY",
      externalEventId,
      eventType,
      signatureHash,
      payloadJson: sanitizedPayload(payload) as Prisma.InputJsonValue,
    },
    update: { status: "RECEIVED", attemptCount: { increment: 1 }, lastError: null },
  });

  try {
    if (!new Set(["payment.captured", "order.paid"]).has(eventType)) {
      await prisma.paymentWebhookEvent.update({ where: { id: event.id }, data: { status: "IGNORED", processedAt: new Date() } });
      return { duplicate: false, status: "IGNORED" as const };
    }

    const payment = payload.payload?.payment?.entity;
    if (!payment?.id || !payment.order_id || typeof payment.amount !== "number" || !payment.currency || payment.status !== "captured") {
      await prisma.paymentWebhookEvent.update({ where: { id: event.id }, data: { status: "IGNORED", processedAt: new Date(), lastError: "No captured payment entity" } });
      return { duplicate: false, status: "IGNORED" as const };
    }
    const order = await findPaymentOrderByProviderId(payment.order_id);
    if (!order || order.provider !== "RAZORPAY") {
      await prisma.paymentWebhookEvent.update({ where: { id: event.id }, data: { status: "IGNORED", processedAt: new Date(), lastError: "Order not owned by this application" } });
      return { duplicate: false, status: "IGNORED" as const };
    }

    await grantVerifiedPayment({
      internalOrderId: order.id,
      providerOrderId: payment.order_id,
      providerPaymentId: payment.id,
      amountPaise: payment.amount,
      currency: payment.currency,
    });
    await prisma.paymentWebhookEvent.update({ where: { id: event.id }, data: { status: "PROCESSED", processedAt: new Date(), lastError: null } });
    return { duplicate: false, status: "PROCESSED" as const };
  } catch (error) {
    // Another worker may have fulfilled the same captured payment after this worker
    // read CREATED but before its conditional update. Treat that verified state as a
    // successful duplicate instead of overwriting the shared event row as FAILED.
    const paymentId = payload.payload?.payment?.entity?.id;
    if (error instanceof ApiError && error.code === "PAYMENT_ALREADY_COMPLETED" && paymentId) {
      const paid = await prisma.paymentOrder.findUnique({ where: { providerPaymentId: paymentId }, select: { status: true } });
      if (paid?.status === "PAID") {
        await prisma.paymentWebhookEvent.update({ where: { id: event.id }, data: { status: "PROCESSED", processedAt: new Date(), lastError: null } });
        return { duplicate: true, status: "PROCESSED" as const };
      }
    }
    const message = error instanceof ApiError ? error.code : "WEBHOOK_PROCESSING_FAILED";
    await prisma.paymentWebhookEvent.update({ where: { id: event.id }, data: { status: "FAILED", lastError: message.slice(0, 500) } }).catch(() => undefined);
    throw error;
  }
}
