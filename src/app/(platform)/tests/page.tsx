import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, CheckCircle2, Clock3, Gauge, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPublishedTests } from "@/lib/queries";

export const metadata: Metadata = { title: "Tests" };

const modeLabel: Record<string, string> = { DIAGNOSTIC: "Diagnostic", PRACTICE: "Practice", CHAPTER: "Chapter test", UNIT: "Unit test", FULL_SYLLABUS: "Full syllabus", MOCK: "Mock exam" };

export default async function TestsPage() {
  const user = await getCurrentUser();
  if (!user?.studentProfile) redirect("/login");
  const [tests, completed] = await Promise.all([
    getPublishedTests(),
    prisma.testAttempt.groupBy({ where: { studentId: user.studentProfile.id, status: "SUBMITTED" }, by: ["testId"], _count: { _all: true }, _max: { score: true } }),
  ]);
  const attemptMap = new Map(completed.map((item) => [item.testId, item]));

  return <div><div className="max-w-2xl"><p className="text-sm font-black text-brand-600">Assessment library</p><h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Test with a purpose.</h1><p className="mt-3 text-sm leading-6 text-muted">Every completed test saves answer-level evidence, updates topic mastery and creates a clearer next step.</p></div>
    <div className="mt-8 grid gap-5 lg:grid-cols-2">{tests.map((test) => { const history = attemptMap.get(test.id); const isDiagnostic = test.mode === "DIAGNOSTIC"; return <article key={test.id} className="surface group overflow-hidden rounded-3xl transition hover:-translate-y-0.5 hover:shadow-xl"><div className={`h-2 ${isDiagnostic ? "bg-gradient-to-r from-brand-500 to-violet-500" : "bg-gradient-to-r from-emerald-400 to-cyan-500"}`} /><div className="p-6 sm:p-7"><div className="flex items-start justify-between gap-4"><span className={`grid size-12 place-items-center rounded-2xl ${isDiagnostic ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-200" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"}`}>{isDiagnostic ? <Sparkles size={22} /> : <BookOpenCheck size={22} />}</span>{history && <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"><CheckCircle2 size={13} /> {history._count._all} completed</span>}</div><p className="mt-6 text-xs font-black uppercase tracking-wider text-brand-600">{modeLabel[test.mode]}</p><h2 className="mt-2 text-2xl font-black">{test.titleEn}</h2>{test.titleHi && <p className="mt-1 text-sm font-bold text-muted">{test.titleHi}</p>}<p className="mt-4 min-h-12 text-sm leading-6 text-muted">{test.descriptionEn}</p><div className="mt-6 flex flex-wrap gap-2 text-xs font-bold text-slate-600 dark:text-slate-300"><span className="surface-soft flex items-center gap-2 rounded-lg px-3 py-2"><Clock3 size={15} /> {test.durationMinutes} min</span><span className="surface-soft flex items-center gap-2 rounded-lg px-3 py-2"><Gauge size={15} /> {test._count.questions} questions</span><span className="surface-soft rounded-lg px-3 py-2">{test.totalMarks} marks</span><span className="surface-soft rounded-lg px-3 py-2">No negative marking</span></div><Link href={`/tests/${test.slug}`} className="focus-ring mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink-950 px-5 py-3.5 text-sm font-black text-white transition group-hover:bg-brand-600 dark:bg-brand-600">{history ? "Practice again" : isDiagnostic ? "Start diagnostic" : "Start test"}<ArrowRight size={17} /></Link></div></article>; })}</div>
    <aside className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100"><strong>Fair-use note:</strong> Readiness and recommendations are estimates based on available evidence. They do not guarantee an official exam result.</aside>
  </div>;
}
