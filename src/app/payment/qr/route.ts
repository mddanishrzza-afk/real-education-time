/**
 * Serves the live payment QR for the manual UPI path.
 *
 * `GET /payment/qr` renders the QR for the deployment's validated destination.
 * `GET /payment/qr?plan=SCHOOL_6_12_FULL` additionally locks the plan amount into the QR (`am=`),
 * so a student cannot pay a wrong amount and the administrator sees the reason in the note.
 *
 * The response is a self-contained SVG (no scripts, no external references) so it works inside the
 * app, in a saved screenshot and in any UPI app's scanner. The `x-payment-uri` header carries the
 * exact payload that was encoded, which is what the honesty and payment smoke tests assert on.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { buildUpiUri, formatUpiAmount, resolvePaymentDestination } from "@/lib/payments/destination";
import { renderUpiQrSvg } from "@/lib/payments/destination-qr";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store", "x-robots-tag": "noindex" } as const;

export async function GET(request: NextRequest) {
  const resolved = resolvePaymentDestination();
  if (resolved.status !== "ready" || !resolved.destination) {
    const message =
      resolved.status === "invalid"
        ? "The payment destination configured for this deployment is invalid, so no QR code is shown. Please contact the administrator."
        : "No manual payment destination is configured for this deployment.";
    return new NextResponse(message, {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", ...NO_STORE },
    });
  }

  const planCode = request.nextUrl.searchParams.get("plan")?.trim() ?? "";
  let amount: string | null = null;
  let note: string | null = null;
  if (planCode) {
    const plan = await prisma.accessPlan.findFirst({
      where: { code: planCode, isActive: true },
      select: { code: true, titleEn: true, amountPaise: true },
    });
    if (plan) {
      amount = formatUpiAmount(plan.amountPaise);
      note = `RET ${plan.code}`;
    }
  }

  const uri = buildUpiUri(resolved.destination, { amountRupees: amount, note });
  const svg = renderUpiQrSvg(uri, { size: 640 });

  return new NextResponse(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      // The payload depends on the plan, so cache per URL: Vercel's edge holds it for an hour.
      "cache-control": "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400",
      "x-payment-uri": uri,
      "x-payment-payee": resolved.destination.upiId,
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
      "x-robots-tag": "noindex",
    },
  });
}
