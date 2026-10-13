import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BrainCircuit, CheckCircle2, CircleHelp, Clock3, Flame, Lightbulb, Sparkles, Target, TrendingUp, Trophy } from "lucide-react";
import { redirect } from "next/navigation";
import { ProgressRing } from "@/components/progress-ring";
import { getCurrentUser } from "@/lib/auth";
import { clamp, formatDate, formatDuration } from "@/lib/format";
import { getDashboardData } from "@/lib/queries";

export const metadata: Metadata = { title: "Student dashboard" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user?.studentProfile) redirect("/login");
  const data = await getDashboardData(user.studentProfile.id);
  const latest = data.attempts.at(-1);
  const recommendation = data.recommendations[0];
  const recommendationHref = recommendation?.actionUrl || "/tests/class-9-foundation-diagnostic";
  const stats = [
    { label: "Overall score", value: `${data.stats.overallScore}%`, detail: data.attempts.length ? `${data.attempts.length} completed tests` : "Take your first test", icon: Target, color: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-200" },
    { label: "Accuracy", value: `${data.stats.accuracy}%`, detail: `${data.stats.totalCorrect} correct answers`, icon: CheckCircle2, color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200" },
    { label: "Questions", value: String(data.stats.totalQuestions), detail: "attempted + skipped", icon: CircleHelp, color: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200" },
    { label: "Avg. pace", value: data.stats.averageSeconds ? `${data.stats.averageSeconds}s` : "—", detail: "per question", icon: Clock3, color: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200" },
  ];

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-bold text-brand-600">नमस्ते, {user.name.split(" ")[0]} 👋</p><h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Here&apos;s your learning pulse.</h1><p className="mt-2 text-sm text-muted">{user.studentProfile.academicClass?.nameEn} • {user.studentProfile.board?.nameEn}</p></div>
        <div className="flex items-center gap-3"><div className="surface flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black"><Flame size={18} className="text-orange-500" /> {user.studentProfile.currentStreak} day streak</div><div className="surface hidden items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black sm:flex"><Trophy size={18} className="text-amber-500" /> {user.studentProfile.xp} XP</div></div>
      </div>

      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Performance summary">
        {stats.map(({ label, value, detail, icon: Icon, color }) => <article key={label} className="surface rounded-2xl p-5"><div className="flex items-center justify-between"><span className={`grid size-10 place-items-center rounded-xl ${color}`}><Icon size={19} /></span>{label === "Overall score" && data.attempts.length > 1 && <span className="flex items-center gap-1 text-xs font-bold text-emerald-600"><TrendingUp size={14} /> improving</span>}</div><p className="mt-5 text-3xl font-black tracking-tight">{value}</p><p className="mt-1 text-xs font-bold text-muted">{label} • {detail}</p></article>)}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <article className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-violet-600 p-6 text-white shadow-xl shadow-brand-600/15 sm:p-8">
          <div className="absolute -right-12 -top-20 size-64 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex h-full flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-8">
            <div className="max-w-xl"><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-brand-100"><Sparkles size={13} /> Smart recommendation</span><h2 className="mt-5 text-2xl font-black sm:text-3xl">{recommendation?.title ?? "Start with your foundation diagnostic"}</h2><p className="mt-3 max-w-lg text-sm leading-6 text-white/70">{recommendation?.reason ?? "Your first assessment will establish topic-level evidence and create a useful baseline."}</p><Link href={recommendationHref} className="focus-ring mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-brand-700 shadow-lg">{recommendation ? "Open recommendation" : "Start diagnostic"}<ArrowRight size={16} /></Link></div>
            <div className="mt-7 shrink-0 rounded-3xl bg-white/10 p-5 backdrop-blur sm:mt-0"><BrainCircuit className="mx-auto text-brand-100" size={45} /><p className="mt-3 text-center text-xs font-bold text-white/55">Based on real<br />attempt evidence</p></div>
          </div>
        </article>

        <article className="surface flex items-center justify-between rounded-3xl p-6">
          <div><p className="text-xs font-black uppercase tracking-wider text-muted">Current readiness</p><h2 className="mt-2 text-xl font-black">Foundation level</h2><p className="mt-2 max-w-[190px] text-xs leading-5 text-muted">Estimated from mastery evidence. Not a result guarantee.</p>{latest && <p className="mt-4 text-xs font-bold text-brand-600">Latest: {latest.test.titleEn}</p>}</div>
          <ProgressRing value={data.stats.overallScore} size={104} stroke={9} label="estimate" />
        </article>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <article className="surface rounded-3xl p-5 sm:p-7">
          <div className="flex items-start justify-between"><div><h2 className="text-xl font-black">Score progress</h2><p className="mt-1 text-xs text-muted">Your completed tests over time</p></div><Link href="/analytics" className="focus-ring rounded-lg text-xs font-black text-brand-600">Full analytics</Link></div>
          {data.attempts.length ? <div className="mt-8 flex h-48 items-end gap-3 border-b border-ui px-1">{data.attempts.map((attempt) => { const percentage = attempt.maxScore ? clamp((attempt.score / attempt.maxScore) * 100) : 0; return <div key={attempt.id} className="group relative flex h-full flex-1 items-end"><div className="w-full rounded-t-lg bg-brand-100 transition group-hover:bg-brand-500 dark:bg-brand-500/20" style={{ height: `${Math.max(5, percentage)}%` }}><span className="absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded bg-ink-950 px-2 py-1 text-[10px] font-bold text-white group-hover:block">{Math.round(percentage)}%</span></div></div>; })}</div> : <div className="mt-8 rounded-2xl bg-[var(--surface-soft)] p-8 text-center"><Target className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-black">No completed test yet</p><Link href="/tests" className="mt-2 inline-block text-xs font-black text-brand-600">Browse available tests</Link></div>}
          {data.attempts.length > 0 && <div className="mt-3 flex justify-between text-[10px] font-bold text-muted"><span>{formatDate(data.attempts[0].submittedAt!)}</span><span>{formatDate(data.attempts.at(-1)!.submittedAt!)}</span></div>}
        </article>

        <article className="surface rounded-3xl p-5 sm:p-7">
          <div><h2 className="text-xl font-black">Subject performance</h2><p className="mt-1 text-xs text-muted">Average topic mastery</p></div>
          {data.subjects.length ? <div className="mt-7 space-y-6">{data.subjects.map((subject) => <div key={subject.id}><div className="mb-2 flex items-end justify-between"><div><p className="text-sm font-black">{subject.name}</p><p className="text-[11px] text-muted">{subject.nameHi}</p></div><span className="text-sm font-black">{subject.score}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-soft)]"><div className={`h-full rounded-full ${subject.score >= 75 ? "bg-emerald-500" : subject.score >= 50 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${subject.score}%` }} /></div></div>)}</div> : <p className="mt-8 text-sm text-muted">Topic data will appear after your diagnostic.</p>}
        </article>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <article className="surface rounded-3xl p-5 sm:p-7"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10"><Lightbulb size={19} /></span><div><h2 className="font-black">Focus topics</h2><p className="text-xs text-muted">Start here for the biggest improvement</p></div></div><div className="mt-5 space-y-3">{data.weakTopics.length ? data.weakTopics.slice(0,3).map((item) => <div key={item.id} className="surface-soft flex items-center justify-between rounded-xl p-4"><span><span className="block text-sm font-black">{item.topic.titleEn}</span><span className="text-xs text-muted">{item.topic.chapter.offering.subject.nameEn}</span></span><span className="rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-black text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">{Math.round(item.score)}%</span></div>) : <p className="rounded-xl bg-[var(--surface-soft)] p-5 text-sm text-muted">No weak topic has enough evidence yet.</p>}</div></article>
        <article className="surface rounded-3xl p-5 sm:p-7"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"><Trophy size={19} /></span><div><h2 className="font-black">Strong topics</h2><p className="text-xs text-muted">Keep these fresh with spaced revision</p></div></div><div className="mt-5 space-y-3">{data.strongTopics.length ? data.strongTopics.slice(0,3).map((item) => <div key={item.id} className="surface-soft flex items-center justify-between rounded-xl p-4"><span><span className="block text-sm font-black">{item.topic.titleEn}</span><span className="text-xs text-muted">{item.topic.chapter.offering.subject.nameEn}</span></span><span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">{Math.round(item.score)}%</span></div>) : <p className="rounded-xl bg-[var(--surface-soft)] p-5 text-sm text-muted">Complete more evidence to confirm a strong topic.</p>}</div></article>
      </section>

      {latest && <section className="surface mt-5 flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-muted">Latest completed test</p><h2 className="mt-1 font-black">{latest.test.titleEn}</h2><p className="mt-1 text-xs text-muted">{formatDate(latest.submittedAt!)} • {formatDuration(latest.durationSeconds)} • {latest.correctCount} correct</p></div><div className="text-left sm:text-right"><p className="text-2xl font-black">{latest.score}/{latest.maxScore}</p><p className="text-xs font-bold text-muted">{Math.round(latest.accuracy)}% accuracy</p></div></section>}
    </div>
  );
}
