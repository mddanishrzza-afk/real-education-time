import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StudyPlanClient } from "@/components/study-plan-client";
import { getCurrentUser } from "@/lib/auth";
import { getStudyPlanOverview } from "@/lib/study-plan/service";

export const metadata: Metadata = { title: "Study Plan & Spaced Revision" };

export default async function StudyPlanPage() {
  const user = await getCurrentUser();
  if (!user?.studentProfile) redirect("/login");
  const overview = await getStudyPlanOverview(user.studentProfile.id);
  return <StudyPlanClient initialData={JSON.parse(JSON.stringify(overview))} />;
}
