import { randomBytes } from "node:crypto";
import type { AccessCategory, PaymentProvider, Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createRazorpayOrder } from "@/lib/payments/razorpay";
import { buildUpiUri, resolvePaymentDestination } from "@/lib/payments/destination";

function configuredProvider(): PaymentProvider {
  const configured = process.env.PAYMENT_PROVIDER?.trim() || (process.env.NODE_ENV === "production" ? "" : "LOCAL_TEST");
  if (configured === "RAZORPAY") return "RAZORPAY";
  if (configured === "LOCAL_TEST" && process.env.NODE_ENV !== "production") return "LOCAL_TEST";
  throw new ApiError(503, "PAYMENT_GATEWAY_UNAVAILABLE", "A production payment gateway is not configured.");
}

function newReceipt() {
  return `ret_${Date.now().toString(36)}_${randomBytes(5).toString("hex")}`;
}

export type BankTransferDetails = {
  available: boolean;
  accountName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  reviewWindowHours: number;
};

/**
 * Manual NEFT/IMPS destination for net-banking customers.
 *
 * A bank transfer cannot be confirmed automatically without a payment gateway, so
 * this path is deliberately review-gated: the student transfers the exact amount,
 * submits the bank reference, and an administrator verifies the settlement before
 * access unlocks. It stays hidden until the destination account is configured, so
 * the app never shows payment details that cannot be honoured.
 */
export function bankTransferDetails(): BankTransferDetails {
  const accountNumber = process.env.BANK_ACCOUNT_NUMBER?.trim() ?? "";
  const ifsc = process.env.BANK_IFSC?.trim() ?? "";
  return {
    available: Boolean(accountNumber && ifsc),
    accountName: process.env.BANK_ACCOUNT_NAME?.trim() || "Real Education Time",
    accountNumber,
    ifsc,
    bankName: process.env.BANK_NAME?.trim() || "",
    reviewWindowHours: 24,
  };
}

async function assertReferenceUnused(reference: string) {
  const existing = await prisma.paymentOrder.findFirst({ where: { manualUtr: reference }, select: { id: true } });
  if (existing) {
    throw new ApiError(409, "REFERENCE_ALREADY_USED", "This transaction reference has already been submitted. Each payment reference can be used once.");
  }
}

async function ensureNotAlreadyUnlocked(userId: string, category: AccessCategory) {
  const now = new Date();
  const existing = await prisma.entitlement.findFirst({
    where: { userId, category, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    select: { id: true },
  });
  if (existing) throw new ApiError(409, "ALREADY_UNLOCKED", "This access category is already unlocked for your account.");
}

export async function listAccessPlans() {
  return prisma.accessPlan.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { amountPaise: "asc" }] });
}

export async function createPaymentOrder(userId: string, planCode: string) {
  const plan = await prisma.accessPlan.findFirst({ where: { code: planCode, isActive: true } });
  if (!plan) throw new ApiError(404, "PLAN_NOT_FOUND", "The selected access plan is not available.");
  await ensureNotAlreadyUnlocked(userId, plan.category);

  const provider = configuredProvider();
  const receipt = newReceipt();
  const internal = await prisma.paymentOrder.create({
    data: { userId, planId: plan.id, provider, receipt, amountPaise: plan.amountPaise, currency: plan.currency },
  });

  try {
    if (provider === "RAZORPAY") {
      const gateway = await createRazorpayOrder({
        amountPaise: plan.amountPaise,
        currency: plan.currency,
        receipt,
        internalOrderId: internal.id,
      });
      const order = await prisma.paymentOrder.update({
        where: { id: internal.id },
        data: { providerOrderId: gateway.id },
      });
      return {
        order,
        checkout: {
          provider: "RAZORPAY" as const,
          keyId: gateway.keyId,
          providerOrderId: gateway.id,
          amountPaise: order.amountPaise,
          currency: order.currency,
          title: plan.titleEn,
        },
      };
    }

    const providerOrderId = `local_order_${internal.id}`;
    const order = await prisma.paymentOrder.update({ where: { id: internal.id }, data: { providerOrderId } });
    return {
      order,
      checkout: {
        provider: "LOCAL_TEST" as const,
        keyId: null,
        providerOrderId,
        amountPaise: order.amountPaise,
        currency: order.currency,
        title: plan.titleEn,
      },
    };
  } catch (error) {
    await prisma.paymentOrder.update({
      where: { id: internal.id },
      data: { status: "FAILED", failureReason: error instanceof ApiError ? error.code : "GATEWAY_CREATE_FAILED" },
    }).catch(() => undefined);
    throw error;
  }
}

type VerifiedPayment = {
  internalOrderId: string;
  providerOrderId: string;
  providerPaymentId: string;
  amountPaise: number;
  currency: string;
};

export async function grantVerifiedPayment(input: VerifiedPayment) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.paymentOrder.findUnique({
      where: { id: input.internalOrderId },
      include: { plan: true, entitlement: true },
    });
    if (!order) throw new ApiError(404, "PAYMENT_ORDER_NOT_FOUND", "The payment order was not found.");
    const manualReferenceCanBeAttached = (order.provider === "STATIC_UPI" || order.provider === "NETBANKING") && !order.providerOrderId;
    if (!manualReferenceCanBeAttached && order.providerOrderId !== input.providerOrderId) {
      throw new ApiError(422, "PAYMENT_ORDER_MISMATCH", "Gateway order reference does not match.");
    }
    if (order.amountPaise !== input.amountPaise || order.currency !== input.currency) {
      throw new ApiError(422, "PAYMENT_AMOUNT_MISMATCH", "Payment amount or currency does not match the selected plan.");
    }
    if (order.status === "PAID") {
      if (order.providerPaymentId !== input.providerPaymentId) throw new ApiError(409, "PAYMENT_ALREADY_COMPLETED", "This order was completed by another payment.");
      return { order, entitlement: order.entitlement, replay: true as const };
    }
    if (order.status === "REFUNDED" || order.status === "CANCELLED") {
      throw new ApiError(409, "PAYMENT_ORDER_CLOSED", "This payment order is closed.");
    }

    const claimed = await tx.paymentOrder.updateMany({
      where: { id: order.id, status: { in: ["CREATED", "PENDING_REVIEW"] } },
      data: { status: "PAID", providerOrderId: input.providerOrderId, providerPaymentId: input.providerPaymentId, paidAt: new Date(), failureReason: null },
    });
    if (claimed.count !== 1) {
      const settled = await tx.paymentOrder.findUnique({ where: { id: order.id }, include: { entitlement: true } });
      if (settled?.status === "PAID" && settled.providerPaymentId === input.providerPaymentId) {
        return { order: settled, entitlement: settled.entitlement, replay: true as const };
      }
      throw new ApiError(409, "PAYMENT_ALREADY_COMPLETED", "This payment order is already completed or closed.");
    }

    const entitlement = await tx.entitlement.create({
      data: {
        userId: order.userId,
        planId: order.planId,
        paymentOrderId: order.id,
        category: order.plan.category,
        source: "PURCHASE",
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: order.userId,
        action: "PAYMENT_VERIFIED_ACCESS_GRANTED",
        resourceType: "PaymentOrder",
        resourceId: order.id,
        metadataJson: {
          provider: order.provider,
          planCode: order.plan.code,
          category: order.plan.category,
          amountPaise: order.amountPaise,
          currency: order.currency,
        },
      },
    });
    return { order: { ...order, status: "PAID" as const, providerPaymentId: input.providerPaymentId }, entitlement, replay: false as const };
  }, { timeout: 10_000 });
}

export async function findPaymentOrderByProviderId(providerOrderId: string) {
  return prisma.paymentOrder.findUnique({ where: { providerOrderId }, include: { plan: true } });
}

export async function confirmLocalTestPayment(userId: string, internalOrderId: string) {
  if (process.env.NODE_ENV === "production") throw new ApiError(404, "NOT_FOUND", "Route not found.");
  const order = await prisma.paymentOrder.findFirst({ where: { id: internalOrderId, userId, provider: "LOCAL_TEST" } });
  if (!order?.providerOrderId) throw new ApiError(404, "PAYMENT_ORDER_NOT_FOUND", "The development payment order was not found.");
  return grantVerifiedPayment({
    internalOrderId: order.id,
    providerOrderId: order.providerOrderId,
    providerPaymentId: `local_payment_${order.id}`,
    amountPaise: order.amountPaise,
    currency: order.currency,
  });
}

/**
 * Static-UPI (manual review) destination, read from the deployment environment only.
 *
 * `PAYMENT_QR_URI` is authoritative when present; `MANUAL_UPI_ID`/`MANUAL_UPI_NAME` remain as a
 * fallback. The QR itself is not stored anywhere — `/payment/qr` renders it from these values at
 * request time, so the code a student scans can never disagree with the UPI ID shown next to it.
 */
export function manualUpiDetails() {
  const resolved = resolvePaymentDestination();
  const destination = resolved.destination;
  const available = resolved.status === "ready" && Boolean(destination);
  return {
    status: resolved.status,
    available,
    upiId: destination?.upiId ?? "",
    payeeName: destination?.payeeName ?? "",
    upiLink: destination ? buildUpiUri(destination) : "",
    note: resolved.note,
    qrPath: available ? "/payment/qr" : "",
    /** Operator-facing reason when a configured destination had to be rejected. */
    error: resolved.error,
  };
}

export async function submitManualUpiReference(userId: string, planCode: string, manualUtr: string) {
  if (!manualUpiDetails().available) {
    throw new ApiError(503, "MANUAL_PAYMENT_UNAVAILABLE", "Manual UPI review is not configured.");
  }
  const plan = await prisma.accessPlan.findFirst({ where: { code: planCode, isActive: true } });
  if (!plan) throw new ApiError(404, "PLAN_NOT_FOUND", "The selected access plan is not available.");
  await ensureNotAlreadyUnlocked(userId, plan.category);
  const reference = manualUtr.trim().toUpperCase();
  await assertReferenceUnused(reference);
  return prisma.paymentOrder.create({
    data: {
      userId,
      planId: plan.id,
      provider: "STATIC_UPI",
      status: "PENDING_REVIEW",
      receipt: newReceipt(),
      amountPaise: plan.amountPaise,
      currency: plan.currency,
      manualUtr: reference,
    },
  });
}

/**
 * Manual net-banking (bank transfer) reference submission. Same review-gated
 * contract as the UPI fallback: nothing unlocks until an administrator matches
 * the bank reference against the settlement statement.
 */
export async function submitBankTransferReference(userId: string, planCode: string, bankReference: string) {
  const details = bankTransferDetails();
  if (!details.available) {
    throw new ApiError(503, "BANK_TRANSFER_UNAVAILABLE", "Bank transfer details are not configured yet. Please pay by UPI for now.");
  }
  const plan = await prisma.accessPlan.findFirst({ where: { code: planCode, isActive: true } });
  if (!plan) throw new ApiError(404, "PLAN_NOT_FOUND", "The selected access plan is not available.");
  await ensureNotAlreadyUnlocked(userId, plan.category);
  const reference = bankReference.trim().toUpperCase();
  await assertReferenceUnused(reference);
  return prisma.paymentOrder.create({
    data: {
      userId,
      planId: plan.id,
      provider: "NETBANKING",
      status: "PENDING_REVIEW",
      receipt: newReceipt(),
      amountPaise: plan.amountPaise,
      currency: plan.currency,
      manualUtr: reference,
    },
  });
}

export async function listUserPaymentHistory(userId: string) {
  return prisma.paymentOrder.findMany({
    where: { userId },
    include: { plan: { select: { code: true, titleEn: true, category: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function reviewManualPayment(adminId: string, orderId: string, approved: boolean, note?: string) {
  const order = await prisma.paymentOrder.findFirst({ where: { id: orderId, provider: { in: ["STATIC_UPI", "NETBANKING"] }, status: "PENDING_REVIEW" } });
  if (!order?.manualUtr) throw new ApiError(404, "PAYMENT_NOT_PENDING", "Pending manual payment was not found.");
  if (!approved) {
    const claimed = await prisma.paymentOrder.updateMany({
      where: { id: order.id, status: "PENDING_REVIEW" },
      data: { status: "FAILED", failureReason: note || "Manual verification rejected" },
    });
    if (claimed.count !== 1) throw new ApiError(409, "PAYMENT_ALREADY_REVIEWED", "This manual payment was already reviewed.");
    const rejected = await prisma.paymentOrder.findUniqueOrThrow({ where: { id: order.id } });
    await prisma.auditLog.create({ data: { actorId: adminId, action: "MANUAL_PAYMENT_REJECTED", resourceType: "PaymentOrder", resourceId: order.id, metadataJson: { note: note || null } } });
    return { order: rejected, entitlement: null };
  }
  const result = await grantVerifiedPayment({
    internalOrderId: order.id,
    providerOrderId: order.providerOrderId || `manual_order_${order.id}`,
    providerPaymentId: `manual_payment_${order.manualUtr}`,
    amountPaise: order.amountPaise,
    currency: order.currency,
  });
  if (result.replay) throw new ApiError(409, "PAYMENT_ALREADY_REVIEWED", "This manual payment was already approved.");
  await prisma.auditLog.create({ data: { actorId: adminId, action: "MANUAL_PAYMENT_APPROVED", resourceType: "PaymentOrder", resourceId: order.id, metadataJson: { note: note || null } } });
  return result;
}

export function publicPaymentOrder<T extends { id: string; status: string; amountPaise: number; currency: string; createdAt: Date; paidAt: Date | null }>(order: T) {
  return { id: order.id, status: order.status, amountPaise: order.amountPaise, currency: order.currency, createdAt: order.createdAt, paidAt: order.paidAt };
}

export type WebhookPayload = Prisma.InputJsonValue;
