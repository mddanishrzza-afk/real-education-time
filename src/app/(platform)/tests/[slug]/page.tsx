import type { Metadata } from "next";
import Link from "next/link";
import { Clock3, LockKeyhole } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { TestRunner } from "@/components/test-runner";
import { getAccessDecision } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTestForRunner } from "@/lib/queries";

export const metadata: Metadata = { title: "Take test" };

export default async function TestPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user?.studentProfile) redirect("/login");
  const { slug } = await params;
  const now = new Date();
  const metadata = await prisma.test.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
      OR: [{ availableFrom: null }, { availableFrom: { lte: now } }],
      AND: [{ OR: [{ availableUntil: null }, { availableUntil: { gte: now } }] }],
    },
    select: { titleEn: true, titleHi: true, descriptionEn: true, durationMinutes: true, accessCategory: true },
  });
  if (!metadata) notFound();
  const access = await getAccessDecision(user.id, metadata.accessCategory);
  if (!access.allowed) {
    return <section className="mx-auto max-w-3xl"><div className="surface overflow-hidden rounded-3xl"><div className="bg-gradient-to-br from-brand-700 to-violet-700 p-7 text-white sm:p-10"><p className="text-xs font-black uppercase tracking-wider text-brand-200">Protected assessment</p><h1 className="mt-4 text-3xl font-black sm:text-4xl">{metadata.titleEn}</h1>{metadata.titleHi && <p className="mt-2 font-bold text-white/70">{metadata.titleHi}</p>}<p className="mt-4 text-sm leading-6 text-white/70">{metadata.descriptionEn}</p></div><div className="p-7 text-center sm:p-10"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-200"><LockKeyhole size={25} /></span><h2 className="mt-5 text-2xl font-black">Access required before questions load</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">Activate your one-time one-hour demo, or unlock this complete category with a one-time payment.</p><div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-xs font-bold text-muted"><Clock3 size={14} /> {metadata.durationMinutes} minute test</div><div><Link href="/access" className="focus-ring mt-6 inline-flex rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-black text-white">Activate demo or unlock</Link></div></div></div></section>;
  }

  // Question stems and options are fetched only after the access decision.
  const test = await getTestForRunner(slug);
  if (!test) notFound();
  const runnerTest = {
    id: test.id, titleEn: test.titleEn, titleHi: test.titleHi, descriptionEn: test.descriptionEn,
    instructionsEn: test.instructionsEn, instructionsHi: test.instructionsHi, durationMinutes: test.durationMinutes,
    totalMarks: test.totalMarks, mode: test.mode,
    questions: test.questions.map((item) => item.question),
  };
  return <TestRunner test={runnerTest} />;
}
