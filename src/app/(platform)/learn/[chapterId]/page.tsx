import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpenCheck, Clock3, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { getAccessDecision } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { getLearningChapter } from "@/lib/queries";

export const metadata: Metadata = { title: "Learning chapter" };

export default async function LearningChapterPage({ params }: { params: Promise<{ chapterId: string }> }) {
  const user = await getCurrentUser();
  if (!user?.studentProfile) redirect("/login");
  const { chapterId } = await params;
  const chapter = await getLearningChapter(chapterId);
  if (!chapter) notFound();
  const publishedConcepts = chapter.topics.flatMap((topic) => topic.concepts.map((concept) => ({ ...concept, topic })));
  const access = await getAccessDecision(user.id, "SCHOOL_6_12");

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/learn?class=${chapter.offering.academicClass.levelOrder}`} className="focus-ring inline-flex items-center gap-2 rounded-lg text-sm font-black text-brand-600"><ArrowLeft size={16} /> Back to Class {chapter.offering.academicClass.levelOrder}</Link>
      <header className="mt-5 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 to-violet-700 p-7 text-white sm:p-10">
        <p className="text-xs font-black uppercase tracking-[.18em] text-brand-200">{chapter.offering.subject.nameEn} • {chapter.offering.academicClass.nameEn}</p>
        <h1 className="mt-4 text-3xl font-black sm:text-5xl">{chapter.titleEn}</h1>
        {chapter.titleHi && <p className="mt-2 text-lg font-bold text-white/70">{chapter.titleHi}</p>}
        <p className="mt-5 max-w-2xl text-sm leading-7 text-white/70">{chapter.descriptionEn}</p>
      </header>

      {!publishedConcepts.length ? (
        <section className="surface mt-6 rounded-3xl p-7 text-center sm:p-10">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200"><Clock3 size={25} /></span>
          <h2 className="mt-5 text-2xl font-black">Lesson is in editorial review</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">This chapter is mapped in the curriculum, but its original bilingual lesson has not passed every publication check yet. It is deliberately not shown as finished content.</p>
          <Link href="/learn" className="focus-ring mt-6 inline-flex rounded-xl bg-ink-950 px-5 py-3 text-sm font-black text-white dark:bg-brand-600">Browse available chapters</Link>
        </section>
      ) : !access.allowed ? (
        <section className="surface mt-6 rounded-3xl p-7 text-center sm:p-10">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-200"><LockKeyhole size={25} /></span>
          <h2 className="mt-5 text-2xl font-black">Activate access to open this lesson</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">Use your one-time one-hour demo or unlock the complete Class 6–12 category for ₹7.</p>
          <Link href="/access" className="focus-ring mt-6 inline-flex rounded-xl bg-brand-600 px-5 py-3 text-sm font-black text-white">View demo & access</Link>
        </section>
      ) : (
        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100"><ShieldCheck size={17} /> Access: {access.source === "TRIAL" ? `one-hour demo until ${access.expiresAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : "one-time category entitlement"}</div>
          {publishedConcepts.map((concept, index) => <article key={concept.id} className="surface rounded-3xl p-6 sm:p-9"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-200"><BookOpenCheck size={19} /></span><div><p className="text-[10px] font-black uppercase tracking-wider text-brand-600">Concept {index + 1} • {concept.topic.titleEn}</p><h2 className="mt-1 text-xl font-black">{concept.titleEn}</h2></div></div>{concept.contentEn && <p className="mt-6 whitespace-pre-line text-sm leading-7 text-muted">{concept.contentEn}</p>}{concept.contentHi && <div className="mt-6 rounded-2xl bg-[var(--surface-soft)] p-5"><p className="mb-2 flex items-center gap-2 text-xs font-black text-brand-600"><Sparkles size={14} /> सरल हिंदी</p><p className="whitespace-pre-line text-sm leading-7 text-muted">{concept.contentHi}</p></div>}</article>)}
        </div>
      )}
    </div>
  );
}
