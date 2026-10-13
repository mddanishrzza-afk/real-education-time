import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "@/lib/api";

const API_BASE = "https://api.razorpay.com/v1";

type RazorpayOrder = { id: string; amount: number; currency: string; receipt?: string; status: string };
export type RazorpayPayment = { id: string; order_id: string; amount: number; currency: string; status: string; captured: boolean };

function credentials() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) {
    throw new ApiError(503, "PAYMENT_GATEWAY_UNAVAILABLE", "The payment gateway is not configured.");
  }
  return { keyId, keySecret };
}

async function razorpayRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { keyId, keySecret } = credentials();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "content-type": "application/json",
        ...init?.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error("Razorpay request unavailable", error);
    throw new ApiError(503, "PAYMENT_GATEWAY_UNAVAILABLE", "The payment gateway is temporarily unavailable.");
  }
  if (!response.ok) {
    const requestId = response.headers.get("x-request-id");
    console.error("Razorpay request failed", { status: response.status, requestId });
    throw new ApiError(502, "PAYMENT_GATEWAY_ERROR", "The payment gateway could not process this request.");
  }
  return response.json() as Promise<T>;
}

export async function createRazorpayOrder(input: { amountPaise: number; currency: string; receipt: string; internalOrderId: string }) {
  const order = await razorpayRequest<RazorpayOrder>("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt,
      notes: { internal_order_id: input.internalOrderId, product: "Real Education Time access" },
    }),
  });
  if (order.amount !== input.amountPaise || order.currency !== input.currency || order.receipt !== input.receipt) {
    throw new ApiError(502, "PAYMENT_ORDER_MISMATCH", "The gateway returned an invalid order.");
  }
  return { ...order, keyId: credentials().keyId };
}

export function secureSignatureEquals(expectedHex: string, receivedHex: string) {
  if (!/^[a-f0-9]{64}$/i.test(receivedHex)) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const received = Buffer.from(receivedHex, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function verifyCheckoutSignature(providerOrderId: string, providerPaymentId: string, signature: string) {
  const secret = credentials().keySecret;
  const expected = createHmac("sha256", secret).update(`${providerOrderId}|${providerPaymentId}`).digest("hex");
  return secureSignatureEquals(expected, signature);
}

export function verifyWebhookSignature(rawBody: string, signature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) throw new ApiError(503, "PAYMENT_WEBHOOK_UNAVAILABLE", "Payment webhook verification is not configured.");
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return secureSignatureEquals(expected, signature);
}

export async function fetchRazorpayPayment(paymentId: string) {
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) throw new ApiError(422, "INVALID_PAYMENT_ID", "Invalid gateway payment reference.");
  return razorpayRequest<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`);
}
