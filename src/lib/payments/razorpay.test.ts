import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { secureSignatureEquals, verifyCheckoutSignature, verifyWebhookSignature } from "@/lib/payments/razorpay";

const oldKeyId = process.env.RAZORPAY_KEY_ID;
const oldKeySecret = process.env.RAZORPAY_KEY_SECRET;
const oldWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

afterEach(() => {
  process.env.RAZORPAY_KEY_ID = oldKeyId;
  process.env.RAZORPAY_KEY_SECRET = oldKeySecret;
  process.env.RAZORPAY_WEBHOOK_SECRET = oldWebhookSecret;
});

describe("Razorpay signature verification", () => {
  it("accepts only the expected checkout HMAC", () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "checkout-secret";
    const orderId = "order_ABC123";
    const paymentId = "pay_DEF456";
    const signature = createHmac("sha256", "checkout-secret").update(`${orderId}|${paymentId}`).digest("hex");
    expect(verifyCheckoutSignature(orderId, paymentId, signature)).toBe(true);
    expect(verifyCheckoutSignature(orderId, "pay_WRONG", signature)).toBe(false);
  });

  it("verifies webhooks against the raw body, not re-serialized JSON", () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-secret";
    const raw = '{"event":"payment.captured","value":7}';
    const signature = createHmac("sha256", "webhook-secret").update(raw).digest("hex");
    expect(verifyWebhookSignature(raw, signature)).toBe(true);
    expect(verifyWebhookSignature(`${raw} `, signature)).toBe(false);
  });

  it("rejects malformed signatures before constant-time comparison", () => {
    expect(secureSignatureEquals("0".repeat(64), "not-hex")).toBe(false);
    expect(secureSignatureEquals("0".repeat(64), "0".repeat(62))).toBe(false);
  });
});
