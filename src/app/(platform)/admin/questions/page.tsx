import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminQuestionReview } from "@/components/admin-question-review";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Admin Question Verification" };

export default async function AdminQuestionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const pending = await prisma.question.findMany({
    where: { status: { in: ["IN_REVIEW", "DRAFT"] } },
    include: { metadata: { select: { sourceType: true, licenseStatus: true, examYear: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return <AdminQuestionReview initialQuestions={JSON.parse(JSON.stringify(pending))} />;
}
