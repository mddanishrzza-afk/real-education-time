import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminPaymentReview } from "@/components/admin-payment-review";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Payment review" };
export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");
  const orders = await prisma.paymentOrder.findMany({
    where: { provider: { in: ["STATIC_UPI", "NETBANKING"] }, status: "PENDING_REVIEW", manualUtr: { not: null } },
    include: { user: { select: { name: true, email: true } }, plan: { select: { titleEn: true, code: true } } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  return <AdminPaymentReview initialOrders={orders.map((order) => ({ id: order.id, provider: order.provider, manualUtr: order.manualUtr!, amountPaise: order.amountPaise, currency: order.currency, createdAt: order.createdAt.toISOString(), user: order.user, plan: order.plan }))} />;
}
