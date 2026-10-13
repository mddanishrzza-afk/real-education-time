import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Award, BrainCircuit, CheckCircle2, Clock3, Home, Lightbulb, RotateCcw, Target, XCircle } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AttemptAnalysisCard } from "@/components/attempt-analysis";
import { CertificateCard } from "@/components/certificate-card";
import { ProgressRing } from "@/components/progress-ring";
import { getCurrentUser } from "@/lib/auth";
import { certificateGrade, getTestAveragePercentage, getTestRank, rankLabel } from "@/lib/certificates";
import { formatDuration } from "@/lib/format";
import { getAttemptResult } from "@/lib/queries";

export const metadata: Metadata = { title: "Test result" };

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.studentProfile) redirect("/login");
  const { id } = await params;
  const result = await getAttemptResult(id, user.studentProfile.id);
  if (!result) notFound();
  const percentage = result.maxScore ? (result.score / result.maxScore) * 100 : 0;
  const topicRows = result.performanceRecords.filter((item) => item.topic);
  const sorted = [...topicRows].sort((a, b) => a.accuracy - b.accuracy);
  const weakest = sorted[0];
  const strongest = [...sorted].reverse()[0];
  const rank = await getTestRank(result.test.id, {
    id: result.id,
    score: result.score,
    accuracy: result.accuracy,
    submittedAt: result.submittedAt,
  });
  const testAverage = await getTestAveragePercentage(result.test.id);
  const graded = certificateGrade(percentage);
  const pace = result.averageResponseSeconds ? `${result.averageResponseSeconds.toFixed(1)}s` : "—";
  const performanceTiles = [
    { label: "Standing on this test", value: rank.approximate ? `${rank.rank}+` : `#${rank.rank}`, detail: `${rank.total} submitted attempt${rank.total === 1 ? "" : "s"}`, note: rankLabel(rank) },
    { label: "Average attempt", value: testAverage === null ? "—" : `${testAverage}%`, detail: "every submitted attempt", note: "Accuracy average across all attempts on this test, including yours." },
    { label: "Your pace", value: pace, detail: "per question", note: "Average response time recorded while you answered." },
    { label: "Grade evidence", value: `${graded.grade}`, detail: graded.label, note: "Grade is derived from this attempt's score, not from any official exam." },
  ];
  const verdict = percentage >= 80 ? "Excellent foundation" : percentage >= 60 ? "Good progress" : percentage >= 40 ? "Building the basics" : "Start with the fundamentals";
  const summary = [
    { label: "Score", value: `${result.score}/${result.maxScore}`, icon: Target, color: "text-brand-600 bg-brand-50 dark:bg-brand-500/10 dark:text-brand-200" },
    { label: "Accuracy", value: `${Math.round(result.accuracy)}%`, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-200" },
    { label: "Correct", value: String(result.correctCount), icon: CheckCircle2, color: "text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-200" },
    { label: "Incorrect", value: String(result.incorrectCount), icon: XCircle, color: "text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-200" },
    { label: "Skipped", value: String(result.skippedCount), icon: Lightbulb, color: "text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-200" },
    { label: "Time", value: formatDuration(result.durationSeconds), icon: Clock3, color: "text-violet-600 bg-violet-50 dark:bg-violet-500/10 dark:text-violet-200" },
  ];

  return <div className="mx-auto max-w-6xl"><section className="surface overflow-hidden rounded-3xl shadow-card"><div className="grid items-center gap-8 bg-gradient-to-br from-ink-950 to-brand-900 p-7 text-white sm:p-10 lg:grid-cols-[1fr_auto]"><div><p className="text-xs font-black uppercase tracking-[.2em] text-brand-300">Test completed</p><h1 className="mt-3 text-3xl font-black sm:text-4xl">{verdict}</h1><p className="mt-3 text-sm text-white/60">{result.test.titleEn}</p><div className="mt-6 flex flex-wrap gap-3"><Link href="/dashboard" className="focus-ring inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-ink-950"><Home size={16} /> Dashboard</Link><Link href={`/tests/${result.test.slug}`} className="focus-ring inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-black text-white"><RotateCcw size={16} /> Practice again</Link><a href="#final-report" className="focus-ring inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-black text-white"><BrainCircuit size={16} /> AI report &amp; rank</a></div></div><div className="rounded-full bg-white p-2 text-ink-950"><ProgressRing value={percentage} size={138} stroke={10} label="score" /></div></div><div className="grid grid-cols-2 gap-px bg-[var(--border)] sm:grid-cols-3 lg:grid-cols-6">{summary.map(({ label, value, icon: Icon, color }) => <div key={label} className="bg-[var(--surface)] p-5"><span className={`grid size-9 place-items-center rounded-xl ${color}`}><Icon size={17} /></span><p className="mt-4 text-xl font-black">{value}</p><p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p></div>)}</div></section>

    <section className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_.75fr]"><article className="surface rounded-3xl p-6 sm:p-8"><div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-200"><BrainCircuit size={21} /></span><div><p className="text-[11px] font-black uppercase tracking-wider text-brand-600">Instant scoring analysis</p><h2 className="mt-1 text-xl font-black">What your attempt tells us</h2></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2">{strongest && <div className="rounded-2xl bg-emerald-50 p-5 dark:bg-emerald-500/10"><p className="text-xs font-black text-emerald-700 dark:text-emerald-200">STRONGEST EVIDENCE</p><p className="mt-2 text-lg font-black">{strongest.topic?.titleEn}</p><p className="mt-2 text-xs leading-5 text-muted">{Math.round(strongest.accuracy)}% accuracy in this test. Keep it fresh with spaced revision.</p></div>}{weakest && <div className="rounded-2xl bg-amber-50 p-5 dark:bg-amber-500/10"><p className="text-xs font-black text-amber-700 dark:text-amber-200">NEXT FOCUS</p><p className="mt-2 text-lg font-black">{weakest.topic?.titleEn}</p><p className="mt-2 text-xs leading-5 text-muted">{Math.round(weakest.accuracy)}% accuracy. Review the concept before another focused set.</p></div>}</div><div className="mt-5 rounded-2xl border border-ui p-5"><p className="text-sm font-black">Recommended next step</p><p className="mt-2 text-sm leading-6 text-muted">{weakest ? `Spend 10–15 minutes revising ${weakest.topic?.titleEn}, work through one solved example, then attempt a short practice test.` : "Complete another topic test to build stronger mastery evidence."}</p><Link href="/tests" className="focus-ring mt-4 inline-flex items-center gap-2 text-sm font-black text-brand-600">Choose next test <ArrowRight size={16} /></Link></div></article><aside className="surface rounded-3xl p-6"><h2 className="text-lg font-black">Topic breakdown</h2><p className="mt-1 text-xs text-muted">Accuracy from this attempt only</p><div className="mt-6 space-y-5">{topicRows.map((item) => <div key={item.id}><div className="mb-2 flex justify-between text-sm"><span className="font-bold">{item.topic?.titleEn}</span><span className="font-black">{Math.round(item.accuracy)}%</span></div><div className="h-2 rounded-full bg-[var(--surface-soft)]"><div className={`h-full rounded-full ${item.accuracy >= 75 ? "bg-emerald-500" : item.accuracy >= 50 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${item.accuracy}%` }} /></div></div>)}</div></aside></section>

    <CertificateCard attemptId={result.id} />

    <section id="answer-review" className="surface mt-5 rounded-3xl p-5 sm:p-8"><div><h2 className="text-xl font-black">Answer review</h2><p className="mt-1 text-xs text-muted">Explanations are shown only after server-side submission.</p></div><div className="mt-6 space-y-3">{result.answers.map((answer, index) => { const correct = answer.question.options.find((option) => option.isCorrect); return <details key={answer.id} className="group rounded-2xl border border-ui open:border-brand-200 open:bg-brand-50/30 dark:open:border-brand-500/20 dark:open:bg-brand-500/5"><summary className="focus-ring flex cursor-pointer list-none items-start gap-3 rounded-2xl p-4 sm:p-5"><span className={`grid size-8 shrink-0 place-items-center rounded-lg ${answer.isCorrect ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200" : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200"}`}>{answer.isCorrect ? <CheckCircle2 size={17} /> : <XCircle size={17} />}</span><span className="flex-1 text-sm font-bold leading-6">{index + 1}. {answer.question.stemEn}</span><span className="hidden text-xs font-black text-muted sm:block">{answer.marksAwarded} mark</span></summary><div className="border-t border-ui px-5 pb-6 pt-5 sm:pl-16"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-[var(--surface-soft)] p-4"><p className="text-[10px] font-black uppercase tracking-wider text-muted">Your answer</p><p className={`mt-2 text-sm font-bold ${answer.isCorrect ? "text-emerald-700 dark:text-emerald-200" : "text-rose-700 dark:text-rose-200"}`}>{answer.selectedOption ? `${answer.selectedOption.label}. ${answer.selectedOption.textEn}` : "Not answered"}</p></div><div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-500/10"><p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-200">Correct answer</p><p className="mt-2 text-sm font-bold">{correct ? `${correct.label}. ${correct.textEn}` : "Reviewed manually"}</p></div></div><div className="mt-4"><p className="text-xs font-black uppercase tracking-wider text-brand-600">Explanation</p><p className="mt-2 text-sm leading-6 text-muted">{answer.question.explanationEn}</p>{answer.question.explanationHi && <p className="mt-2 text-sm leading-6 text-muted">{answer.question.explanationHi}</p>}</div></div></details>; })}</div></section>
    <section id="final-report" className="mt-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-brand-600">Final report</p>
          <h2 className="mt-1 text-xl font-black">AI analysis, your rank and performance</h2>
        </div>
        <p className="max-w-md text-[11px] leading-5 text-muted">The AI analysis is written from the answers you actually submitted; the rank, pace and grade come from the server, measured against every other submitted attempt on this same test.</p>
      </div>

    <AttemptAnalysisCard attemptId={result.id} />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {performanceTiles.map((tile) => (
          <div key={tile.label} className="surface rounded-2xl p-5">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted">{tile.label}</p>
            <p className="mt-2 text-2xl font-black">{tile.value}</p>
            <p className="mt-1 text-xs font-bold text-brand-600">{tile.detail}</p>
            <p className="mt-2 text-[11px] leading-5 text-muted">{tile.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-ui p-5">
        <p className="max-w-xl text-xs leading-5 text-muted">Need the paperwork or the per-question reasoning again? Both are above this final report.</p>
        <div className="flex flex-wrap gap-3">
          <a href="#certificate" className="focus-ring inline-flex items-center gap-2 rounded-xl border border-ui px-4 py-2.5 text-sm font-black"><Award size={16} /> Certificate</a>
          <a href="#answer-review" className="focus-ring inline-flex items-center gap-2 rounded-xl border border-ui px-4 py-2.5 text-sm font-black">Answer review</a>
          <Link href="/tests" className="focus-ring inline-flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-black text-white dark:bg-brand-600">More practice <ArrowRight size={16} /></Link>
        </div>
      </div>
    </section>

    <p className="mt-5 text-center text-xs leading-5 text-muted">This readiness analysis is educational guidance based on available evidence; it is not a guarantee of any official exam result.</p>
  </div>;
}
