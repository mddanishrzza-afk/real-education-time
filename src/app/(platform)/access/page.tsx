import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccessCenter } from "@/components/access-center";
import { getAccessSummary } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { bankTransferDetails, listAccessPlans, listUserPaymentHistory, manualUpiDetails } from "@/lib/payments/service";

export const metadata: Metadata = { title: "Demo, pricing & access", description: "Activate a one-hour demo, unlock learning categories, and review payments." };
export const dynamic = "force-dynamic";

function serializeDecision<T extends { allowed: boolean; expiresAt?: Date | null }>(decision: T) {
  return { ...decision, ...(decision.allowed ? { expiresAt: decision.expiresAt?.toISOString() ?? null } : {}) };
}

export default async function AccessPage() {
  const user = await getCurrentUser();
  if (!user?.studentProfile) redirect("/login");
  const [access, plans, orders] = await Promise.all([getAccessSummary(user.id), listAccessPlans(), listUserPaymentHistory(user.id)]);
  return <AccessCenter
    initialAccess={{
      school: serializeDecision(access.school),
      boardCompetitive: serializeDecision(access.boardCompetitive),
      trial: { ...access.trial, startsAt: access.trial.startsAt?.toISOString() ?? null, expiresAt: access.trial.expiresAt?.toISOString() ?? null },
    }}
    plans={plans.map((plan) => ({ code: plan.code, category: plan.category, titleEn: plan.titleEn, titleHi: plan.titleHi, descriptionEn: plan.descriptionEn, amountPaise: plan.amountPaise, currency: plan.currency }))}
    initialOrders={orders.map((order) => ({ id: order.id, status: order.status, amountPaise: order.amountPaise, currency: order.currency, createdAt: order.createdAt.toISOString(), paidAt: order.paidAt?.toISOString() ?? null, plan: order.plan }))}
    initialNow={new Date().toISOString()}
    user={{ name: user.name, email: user.email, verified: Boolean(user.emailVerifiedAt) }}
    gatewayEnabled={Boolean(process.env.PAYMENT_PROVIDER?.trim() && process.env.RAZORPAY_KEY_ID?.trim())}
    bankTransfer={bankTransferDetails()}
    manualUpi={manualUpiDetails()}
  />;
}
