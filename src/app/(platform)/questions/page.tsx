import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { QuestionFinderClient } from "@/components/question-finder-client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Question Finder" };

export default async function QuestionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [boards, classes, subjects] = await Promise.all([
    prisma.board.findMany({ select: { id: true, nameEn: true }, orderBy: { nameEn: "asc" } }),
    prisma.academicClass.findMany({ select: { id: true, nameEn: true }, orderBy: { gradeNumber: "asc" } }),
    prisma.subject.findMany({ select: { id: true, nameEn: true }, orderBy: { nameEn: "asc" } }),
  ]);

  return <QuestionFinderClient boards={boards} classes={classes} subjects={subjects} />;
}
