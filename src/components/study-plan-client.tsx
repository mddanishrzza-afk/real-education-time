"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, Clock3, RefreshCw, Sparkles, Target, TrendingUp } from "lucide-react";

type TaskItem = {
  id: string;
  title: string;
  activityType: string;
  durationMinutes: number;
  questionCount: number | null;
  isCompleted: boolean;
  topic?: { titleEn: string; chapter?: { offering?: { subject?: { nameEn: string } } } } | null;
};

type RevisionItemView = {
  id: string;
  status: string;
  reason: string;
  dueAt: string | Date;
  intervalDays: number;
  repetition: number;
  topic?: { titleEn: string; chapter?: { offering?: { subject?: { nameEn: string } } } } | null;
};

type WeakTopicView = {
  topicId: string;
  topicTitle: string;
  subjectName: string;
  masteryScore: number;
};

type WeeklyHistoryView = {
  id: string;
  title: string;
  dateFrom: string | Date;
  status: string;
  total: number;
  completed: number;
};

export type StudyPlanOverviewData = {
  activePlan: {
    id: string;
    title: string;
    availableMinutes: number;
    generatedBy: string;
    rationale: string | null;
    items: TaskItem[];
  } | null;
  stats: {
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    progressPercent: number;
    estimatedMinutes: number;
    dueRevisionsCount: number;
    revisionCompletionRate: number;
    recentAccuracy: number;
  };
  weakTopics: WeakTopicView[];
  revisions: RevisionItemView[];
  weeklyHistory: WeeklyHistoryView[];
};

export function StudyPlanClient({ initialData }: { initialData: StudyPlanOverviewData }) {
  const [data, setData] = useState<StudyPlanOverviewData>(initialData);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [minutes, setMinutes] = useState(initialData.activePlan?.availableMinutes ?? 45);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshOverview() {
    const res = await fetch("/api/v1/study-plan");
    if (res.ok) setData(await res.json());
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/study-plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availableMinutes: minutes, useAi: true }),
      });
      if (!res.ok) throw new Error("Could not generate study plan.");
      await refreshOverview();
      setMessage("Personalized study plan updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate plan.");
    } finally {
      setGenerating(false);
    }
  }

  async function toggleTask(task: TaskItem) {
    setBusyId(task.id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/study-plan/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: !task.isCompleted }),
      });
      if (!res.ok) throw new Error("Could not update task.");
      await refreshOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevision(revisionId: string, status: "COMPLETED" | "SNOOZED", recallQuality?: "HARD" | "GOOD" | "EASY") {
    setBusyId(revisionId);
    setError(null);
    try {
      const res = await fetch(`/api/v1/study-plan/revisions/${revisionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, recallQuality }),
      });
      if (!res.ok) throw new Error("Could not update revision.");
      await refreshOverview();
      setMessage(status === "COMPLETED" ? "Revision completed & next spaced cycle scheduled." : "Revision snoozed by 1 day.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update revision.");
    } finally {
      setBusyId(null);
    }
  }

  const activeRevisions = data.revisions.filter((r) => r.status !== "COMPLETED");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-brand-600">Intelligent Study Planner</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Your Daily Plan &amp; Spaced Revision</h1>
          <p className="mt-1 text-sm text-muted">Grounded in your actual test accuracy, topic mastery, and revision schedule.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="surface flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold">
            <Clock3 size={15} className="text-brand-600" />
            <span>Daily mins:</span>
            <input
              type="number"
              min={15}
              max={240}
              step={5}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value) || 45)}
              className="w-14 bg-transparent text-right font-black outline-none"
            />
          </label>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="focus-ring inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
          >
            <RefreshCw size={15} className={generating ? "animate-spin" : ""} />
            {generating ? "Generating..." : data.activePlan ? "Refresh Plan" : "Generate Plan"}
          </button>
        </div>
      </div>

      {message && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">{message}</p>}
      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{error}</p>}

      {/* 1. Study Plan Overview */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Study plan overview">
        <article className="surface rounded-2xl p-5">
          <p className="text-xs font-bold text-muted">Daily Progress</p>
          <p className="mt-2 text-3xl font-black">{data.stats.progressPercent}%</p>
          <p className="mt-1 text-xs text-muted">{data.stats.completedTasks} of {data.stats.totalTasks} tasks done</p>
        </article>
        <article className="surface rounded-2xl p-5">
          <p className="text-xs font-bold text-muted">Estimated Study Time</p>
          <p className="mt-2 text-3xl font-black">{data.stats.estimatedMinutes}m</p>
          <p className="mt-1 text-xs text-muted">{data.stats.pendingTasks} pending tasks</p>
        </article>
        <article className="surface rounded-2xl p-5">
          <p className="text-xs font-bold text-muted">Due Revisions</p>
          <p className="mt-2 text-3xl font-black">{data.stats.dueRevisionsCount}</p>
          <p className="mt-1 text-xs text-muted">{data.stats.revisionCompletionRate}% revision completion</p>
        </article>
        <article className="surface rounded-2xl p-5">
          <p className="text-xs font-bold text-muted">Recent Accuracy</p>
          <p className="mt-2 text-3xl font-black">{data.stats.recentAccuracy}%</p>
          <p className="mt-1 text-xs text-muted">From submitted tests</p>
        </article>
      </section>

      {/* 2. AI Recommendations */}
      {data.activePlan?.rationale && (
        <section className="surface rounded-3xl border border-brand-200/60 p-5 sm:p-6 dark:border-brand-500/20">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-brand-600">
            <Sparkles size={14} /> AI &amp; Rule-Engine Rationale ({data.activePlan.generatedBy})
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{data.activePlan.rationale}</p>
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        {/* 3. Today's Tasks */}
        <section className="surface rounded-3xl p-5 sm:p-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black">Today&apos;s Tasks</h2>
              <p className="mt-1 text-xs text-muted">{data.activePlan ? data.activePlan.title : "No active plan yet"}</p>
            </div>
          </div>

          {data.activePlan?.items.length ? (
            <div className="mt-5 space-y-3">
              {data.activePlan.items.map((task) => (
                <div key={task.id} className="surface-soft flex items-center justify-between gap-3 rounded-2xl p-4">
                  <button
                    type="button"
                    disabled={busyId === task.id}
                    onClick={() => toggleTask(task)}
                    className="focus-ring flex flex-1 items-start gap-3 text-left"
                  >
                    <CheckCircle2
                      size={20}
                      className={`mt-0.5 shrink-0 ${task.isCompleted ? "text-emerald-500" : "text-slate-300 dark:text-slate-600"}`}
                    />
                    <span>
                      <span className={`block text-sm font-black ${task.isCompleted ? "line-through opacity-60" : ""}`}>
                        {task.title}
                      </span>
                      <span className="mt-1 block text-xs text-muted">
                        {task.activityType} • {task.durationMinutes} min{task.questionCount ? ` • ${task.questionCount} Qs` : ""}
                      </span>
                    </span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-[var(--surface-soft)] p-6 text-center">
              <Target className="mx-auto text-slate-400" size={28} />
              <p className="mt-2 text-sm font-black">No tasks scheduled yet</p>
              <p className="mt-1 text-xs text-muted">Click &ldquo;Generate Plan&rdquo; above to build your personalized schedule.</p>
            </div>
          )}
        </section>

        {/* 4. Revision Center */}
        <section className="surface rounded-3xl p-5 sm:p-7">
          <h2 className="text-xl font-black">Revision Center</h2>
          <p className="mt-1 text-xs text-muted">Spaced-repetition intervals (1d → 3d → 7d → 14d → 30d)</p>
          {activeRevisions.length ? (
            <div className="mt-5 space-y-3">
              {activeRevisions.slice(0, 6).map((rev) => (
                <div key={rev.id} className="surface-soft rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-black">{rev.topic?.titleEn ?? "Topic Revision"}</p>
                      <p className="text-xs text-muted">
                        {rev.topic?.chapter?.offering?.subject?.nameEn ?? "Subject"} • Cycle #{rev.repetition + 1} ({rev.intervalDays}d)
                      </p>
                    </div>
                    <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                      {rev.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === rev.id}
                      onClick={() => handleRevision(rev.id, "COMPLETED", "GOOD")}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Mark Revised
                    </button>
                    <button
                      type="button"
                      disabled={busyId === rev.id}
                      onClick={() => handleRevision(rev.id, "SNOOZED")}
                      className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-300 dark:bg-white/10 dark:text-slate-200"
                    >
                      Snooze 1d
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl bg-[var(--surface-soft)] p-5 text-sm text-muted">
              No pending revisions right now. Complete tests or generate a plan to schedule spaced revisions.
            </p>
          )}
        </section>
      </div>

      {/* 5. Weak Topics & 6. Weekly Schedule / Learning Progress */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface rounded-3xl p-5 sm:p-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black">Weak Topics</h2>
              <p className="mt-1 text-xs text-muted">Topics below 65% mastery</p>
            </div>
            <Link href="/tests" className="text-xs font-black text-brand-600">Practice tests</Link>
          </div>
          <div className="mt-4 space-y-2.5">
            {data.weakTopics.length ? (
              data.weakTopics.map((t) => (
                <div key={t.topicId} className="surface-soft flex items-center justify-between rounded-xl p-3.5">
                  <div>
                    <p className="text-sm font-black">{t.topicTitle}</p>
                    <p className="text-xs text-muted">{t.subjectName}</p>
                  </div>
                  <span className="rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-black text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">
                    {Math.round(t.masteryScore)}%
                  </span>
                </div>
              ))
            ) : (
              <p className="rounded-xl bg-[var(--surface-soft)] p-4 text-sm text-muted">No weak topics detected yet.</p>
            )}
          </div>
        </section>

        <section className="surface rounded-3xl p-5 sm:p-7">
          <div className="flex items-center gap-2">
            <CalendarDays size={19} className="text-brand-600" />
            <h2 className="text-xl font-black">Weekly Schedule &amp; Progress</h2>
          </div>
          <div className="mt-4 space-y-2.5">
            {data.weeklyHistory.length ? (
              data.weeklyHistory.map((plan) => (
                <div key={plan.id} className="surface-soft flex items-center justify-between rounded-xl p-3.5">
                  <div>
                    <p className="text-sm font-black">{plan.title}</p>
                    <p className="text-xs text-muted">{plan.status}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-black text-brand-600">
                    <TrendingUp size={14} /> {plan.completed}/{plan.total}
                  </span>
                </div>
              ))
            ) : (
              <p className="rounded-xl bg-[var(--surface-soft)] p-4 text-sm text-muted">Your plan history will appear here.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
