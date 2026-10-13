import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CheckCircle2, ChevronRight, Clock3, LibraryBig, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurriculumCatalog } from "@/lib/queries";

export const metadata: Metadata = { title: "Learn" };

const classes = [6, 7, 8, 9, 10, 11, 12];

export default async function LearnPage({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  const user = await getCurrentUser();
  if (!user?.studentProfile) redirect("/login");
  const params = await searchParams;
  const requested = Number(params.class);
  const profileClass = user.studentProfile.academicClass?.levelOrder || 9;
  const selectedClass = classes.includes(requested) ? requested : profileClass;
  const offerings = await getCurriculumCatalog(`CLASS_${selectedClass}`);
  const chapterCount = offerings.reduce((sum, item) => sum + item.chapters.length, 0);
  const publishedCount = offerings.reduce(
    (sum, item) => sum + item.chapters.filter((chapter) => chapter.topics.some((topic) => topic.concepts.some((concept) => concept.status === "PUBLISHED"))).length,
    0,
  );

  return (
    <div>
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-ink-950 via-brand-900 to-violet-800 p-6 text-white sm:p-9">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-brand-200"><LibraryBig size={16} /> NCERT-aligned curriculum map</p>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">Learn chapter by chapter.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70">CBSE Class 6–12 core-subject catalog. Lessons and questions are independently written, bilingual-ready, and published only after editorial review.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat value={String(offerings.length)} label="Subjects" />
            <Stat value={String(chapterCount)} label="Chapters" />
            <Stat value={String(publishedCount)} label="Live units" />
          </div>
        </div>
      </section>

      <nav className="mt-6 flex gap-2 overflow-x-auto pb-2" aria-label="Choose class">
        {classes.map((level) => <Link key={level} href={`/learn?class=${level}`} className={`focus-ring shrink-0 rounded-xl px-4 py-2.5 text-sm font-black ${selectedClass === level ? "bg-brand-600 text-white" : "surface"}`}>Class {level}</Link>)}
      </nav>

      <div className="mt-7 grid gap-5 xl:grid-cols-2">
        {offerings.map((offering) => {
          const live = offering.chapters.filter((chapter) => chapter.topics.some((topic) => topic.concepts.some((concept) => concept.status === "PUBLISHED"))).length;
          return (
            <section key={offering.id} className="surface overflow-hidden rounded-3xl">
              <header className="flex items-start justify-between gap-4 border-b border-ui p-5 sm:p-6">
                <div className="flex gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-200"><BookOpen size={20} /></span>
                  <div><h2 className="text-lg font-black">{offering.subject.nameEn}</h2><p className="mt-0.5 text-xs font-bold text-muted">{offering.subject.nameHi || `Class ${selectedClass}`} • {offering.chapters.length} chapters</p></div>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">{live} LIVE</span>
              </header>
              <ol className="divide-y divide-[var(--border)]">
                {offering.chapters.map((chapter) => {
                  const published = chapter.topics.some((topic) => topic.concepts.some((concept) => concept.status === "PUBLISHED"));
                  return <li key={chapter.id}><Link href={`/learn/${chapter.id}`} className="focus-ring group flex items-center gap-3 px-5 py-3.5 transition hover:bg-[var(--surface-soft)]"><span className={`grid size-8 shrink-0 place-items-center rounded-lg text-[11px] font-black ${published ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200" : "surface-soft text-muted"}`}>{published ? <CheckCircle2 size={15} /> : chapter.sequence}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{chapter.titleEn}</span><span className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-muted">{published ? <><Sparkles size={11} /> Reviewed lesson available</> : <><Clock3 size={11} /> Editorial review in progress</>}</span></span><ChevronRight size={16} className="text-muted transition group-hover:translate-x-0.5 group-hover:text-brand-600" /></Link></li>;
                })}
              </ol>
            </section>
          );
        })}
      </div>
      <aside className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100"><strong>Editorial status matters:</strong> Catalog mapping does not mean a lesson is published. Draft material stays unavailable until originality, syllabus fit, language, answer accuracy and difficulty checks are completed.</aside>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return <div className="rounded-2xl bg-white/10 px-4 py-3"><span className="block text-xl font-black">{value}</span><span className="text-[9px] font-bold uppercase tracking-wider text-white/60">{label}</span></div>;
}
