import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "STUDENT" && !user.studentProfile?.onboardingCompleted) redirect("/onboarding");
  return <AppShell user={user}>{children}</AppShell>;
}
