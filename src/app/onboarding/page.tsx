import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { OnboardingForm } from "@/components/onboarding-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Set up your learning profile" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.studentProfile?.onboardingCompleted) redirect("/dashboard");
  const [boards, classes] = await Promise.all([
    prisma.board.findMany({ where: { isActive: true }, select: { id: true, nameEn: true, nameHi: true }, orderBy: { nameEn: "asc" } }),
    // The current reviewed seed contains a Class 9 diagnostic. Other configured classes stay hidden until reviewed content is published.
    prisma.academicClass.findMany({ where: { isActive: true, code: "CLASS_9" }, select: { id: true, nameEn: true, nameHi: true }, orderBy: { levelOrder: "asc" } }),
  ]);
  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(91,95,245,.12),transparent_30%)]"><header className="container-shell flex h-20 items-center justify-between"><Logo /><ThemeToggle /></header><div className="container-shell grid items-center gap-12 py-10 lg:grid-cols-[.8fr_1.2fr] lg:py-20"><div className="max-w-md"><span className="text-xs font-black uppercase tracking-[.2em] text-brand-600">Welcome, {user.name.split(" ")[0]}</span><h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Let&apos;s personalize your learning.</h1><p className="mt-5 text-base leading-7 text-muted">बस 3 छोटे steps. फिर आपका पहला diagnostic test आपकी strengths और learning gaps पहचानना शुरू करेगा।</p></div><section className="surface shadow-card rounded-[2rem] p-6 sm:p-9"><OnboardingForm boards={boards} classes={classes} /></section></div></main>;
}
