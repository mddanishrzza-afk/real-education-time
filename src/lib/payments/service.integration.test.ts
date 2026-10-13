import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { grantVerifiedPayment, reviewManualPayment } from "@/lib/payments/service";
import { processRazorpayWebhook } from "@/lib/payments/webhook";

const prefix = "payment-integration-";
const oldWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
let sequence = 0;
const next = (label: string) => `${prefix}${label}-${Date.now()}-${sequence++}`;

async function ensurePlan() {
  return prisma.accessPlan.upsert({
    where: { code: "SCHOOL_6_12_FULL" },
    update: { amountPaise: 700, currency: "INR", isActive: true },
    create: { code: "SCHOOL_6_12_FULL", category: "SCHOOL_6_12", titleEn: "Class 6–12 complete access", amountPaise: 700, currency: "INR" },
  });
}

async function createUser(label: string, role: "STUDENT" | "ADMIN" = "STUDENT") {
  const token = next(label);
  return prisma.user.create({ data: { name: `Payment ${label}`, email: `${token}@example.test`, passwordHash: "test-only-hash", role, status: "ACTIVE", emailVerifiedAt: new Date() } });
}

async function createOrder(userId: string, input?: { provider?: "RAZORPAY" | "STATIC_UPI"; status?: "CREATED" | "PENDING_REVIEW"; manualUtr?: string }) {
  const plan = await ensurePlan();
  const token = next("order");
  return prisma.paymentOrder.create({
    data: {
      userId, planId: plan.id, provider: input?.provider || "RAZORPAY", status: input?.status || "CREATED",
      receipt: `receipt_${token}`, amountPaise: 700, currency: "INR",
      providerOrderId: input?.provider === "STATIC_UPI" ? null : `order_${token.replaceAll("-", "")}`,
      manualUtr: input?.manualUtr,
    },
  });
}

beforeEach(() => { process.env.RAZORPAY_WEBHOOK_SECRET = "payment-integration-webhook-secret"; });
afterEach(async () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = oldWebhookSecret;
  await prisma.paymentWebhookEvent.deleteMany({ where: { externalEventId: { startsWith: prefix } } });
  const users = await prisma.user.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } });
  const userIds = users.map((user) => user.id);
  if (!userIds.length) return;
  await prisma.entitlement.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.paymentOrder.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

describe("verified payment fulfillment", () => {
  it("grants exactly one entitlement and treats the same payment as an idempotent replay", async () => {
    const user = await createUser("fulfillment");
    const order = await createOrder(user.id);
    const input = { internalOrderId: order.id, providerOrderId: order.providerOrderId!, providerPaymentId: `pay_${next("paid").replaceAll("-", "")}`, amountPaise: 700, currency: "INR" };

    const first = await grantVerifiedPayment(input);
    const replay = await grantVerifiedPayment(input);

    expect(first.replay).toBe(false);
    expect(replay.replay).toBe(true);
    expect(await prisma.entitlement.count({ where: { paymentOrderId: order.id } })).toBe(1);
    expect((await prisma.paymentOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
  });

  it("does not fulfill an amount mismatch", async () => {
    const user = await createUser("mismatch");
    const order = await createOrder(user.id);
    await expect(grantVerifiedPayment({ internalOrderId: order.id, providerOrderId: order.providerOrderId!, providerPaymentId: `pay_${next("wrong").replaceAll("-", "")}`, amountPaise: 900, currency: "INR" })).rejects.toMatchObject({ code: "PAYMENT_AMOUNT_MISMATCH" });
    expect(await prisma.entitlement.count({ where: { paymentOrderId: order.id } })).toBe(0);
    expect((await prisma.paymentOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CREATED");
  });
});

describe("webhook idempotency", () => {
  it("processes a captured payment once and safely acknowledges a duplicate event", async () => {
    const user = await createUser("webhook");
    const order = await createOrder(user.id);
    const eventId = next("event");
    const paymentId = `pay_${next("webhookpay").replaceAll("-", "")}`;
    const rawBody = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: paymentId, order_id: order.providerOrderId, amount: 700, currency: "INR", status: "captured" } } } });
    const signature = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!).update(rawBody).digest("hex");

    const first = await processRazorpayWebhook({ rawBody, signature, externalEventId: eventId });
    const second = await processRazorpayWebhook({ rawBody, signature, externalEventId: eventId });

    expect(first.status).toBe("PROCESSED");
    expect(second).toEqual({ duplicate: true, status: "PROCESSED" });
    expect(await prisma.entitlement.count({ where: { paymentOrderId: order.id } })).toBe(1);
    expect(await prisma.paymentWebhookEvent.count({ where: { externalEventId: eventId } })).toBe(1);
  });

  it("rejects reuse of an event identifier with a different signed payload", async () => {
    const eventId = next("event-reuse");
    const ignored = JSON.stringify({ event: "payment.failed" });
    const ignoredSignature = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!).update(ignored).digest("hex");
    await processRazorpayWebhook({ rawBody: ignored, signature: ignoredSignature, externalEventId: eventId });
    const changed = JSON.stringify({ event: "order.paid" });
    const changedSignature = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!).update(changed).digest("hex");
    await expect(processRazorpayWebhook({ rawBody: changed, signature: changedSignature, externalEventId: eventId })).rejects.toMatchObject({ code: "WEBHOOK_EVENT_ID_REUSED" });
  });
});

describe("manual payment review", () => {
  it("makes rejection final and never grants an entitlement", async () => {
    const [student, admin] = await Promise.all([createUser("manual"), createUser("admin", "ADMIN")]);
    const order = await createOrder(student.id, { provider: "STATIC_UPI", status: "PENDING_REVIEW", manualUtr: next("utr").replaceAll("-", "").slice(0, 30).toUpperCase() });

    await reviewManualPayment(admin.id, order.id, false, "Settlement not found");
    await expect(reviewManualPayment(admin.id, order.id, true)).rejects.toMatchObject({ code: "PAYMENT_NOT_PENDING" });
    expect(await prisma.entitlement.count({ where: { paymentOrderId: order.id } })).toBe(0);
    expect((await prisma.paymentOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("FAILED");
  });
});
