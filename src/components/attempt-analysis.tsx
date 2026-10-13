"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BrainCircuit, LoaderCircle, RefreshCw, ShieldCheck, Sparkles, Target } from "lucide-react";
import type { AnalysisResponse } from "@/lib/ai/attempt-analysis";

export function AttemptAnalysisCard({ attemptId }: { attemptId: string }) {
  const [payload, setPayload] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");

  // A stored analysis is free to load, so show it immediately when it exists.
  useEffect(() => {
    let active = true;
    fetch(`/api/v1/attempts/${encodeURIComponent(attemptId)}/analysis`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (active && body?.analysis) setPayload(body.analysis as AnalysisResponse);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setChecked(true);
      });
    return () => {
      active = false;
    };
  }, [attemptId]);

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/attempts/${encodeURIComponent(attemptId)}/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error?.message || "The analysis could not be generated right now.");
      }
      setPayload(body.analysis as AnalysisResponse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The analysis could not be generated right now.");
    } finally {
      setLoading(false);
    }
  }

  if (!payload && !checked) {
    return (
      <section className="surface mt-5 flex items-center gap-3 rounded-3xl p-6 sm:p-8">
        <LoaderCircle size={20} className="animate-spin text-violet-600" />
        <p className="text-sm font-bold text-muted">Checking for a saved analysis…</p>
      </section>
    );
  }

  if (!payload) {
    return (
      <section className="surface mt-5 rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-200">
                <BrainCircuit size={21} />
              </span>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-violet-600">AI performance analysis</p>
                <h2 className="mt-1 text-xl font-black">Explain my result in my language</h2>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted">
              The AI reads only the evidence already stored for this test — your topic-wise accuracy, difficulty performance, pace and
              skipped questions — and writes a short diagnosis, your strengths, the gaps behind the score, and a 3-day revision plan.
              It runs once and is saved on this page, so it never costs anything again.
            </p>
            <ul className="mt-4 grid gap-2 text-xs font-semibold text-muted sm:grid-cols-2">
              <li className="flex items-center gap-2"><ShieldCheck size={14} className="text-emerald-500" /> No database access for the AI — a validated summary only</li>
              <li className="flex items-center gap-2"><Target size={14} className="text-brand-600" /> Falls back to a grounded engine if the AI is unavailable</li>
            </ul>
          </div>
          <div className="shrink-0">
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="focus-ring inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3.5 text-sm font-black text-white disabled:opacity-60"
            >
              {loading ? <LoaderCircle size={18} className="animate-spin" /> : <Sparkles size={17} />}
              {loading ? "Analysing your answers…" : "Generate AI analysis"}
            </button>
            <p className="mt-3 max-w-[15rem] text-[11px] leading-5 text-muted">
              Educational guidance only — never a guarantee of any exam result.
            </p>
          </div>
        </div>
        {error ? (
          <p className="mt-5 flex items-start gap-2 rounded-2xl bg-rose-50 p-4 text-xs font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
          </p>
        ) : null}
      </section>
    );
  }

  const { analysis, metrics } = payload;
  return (
    <section className="surface mt-5 rounded-3xl p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-200">
            <BrainCircuit size={21} />
          </span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-violet-600">AI performance analysis</p>
            <h2 className="mt-1 max-w-2xl text-xl font-black sm:text-2xl">{analysis.headline}</h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1.5 text-[10px] font-black text-muted">{analysis.confidence} EVIDENCE</span>
          <span className="rounded-full bg-violet-100 px-3 py-1.5 text-[10px] font-black text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
            {payload.provider === "LOCAL_GROUNDED" ? "Grounded engine" : `${payload.provider} • ${payload.model}`}
          </span>
        </div>
      </div>

      <p className="mt-5 text-sm leading-7 text-muted">{analysis.summary}</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Accuracy", value: `${metrics.accuracy}%` },
          { label: "Correct", value: String(metrics.correctCount) },
          { label: "Skipped", value: String(metrics.skippedCount) },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl bg-[var(--surface-soft)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{item.label}</p>
            <p className="mt-1.5 text-xl font-black">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-emerald-50 p-5 dark:bg-emerald-500/10">
          <p className="text-xs font-black text-emerald-700 dark:text-emerald-200">WHAT IS WORKING</p>
          <ul className="mt-3 space-y-2.5 text-sm leading-6">
            {analysis.strengths.map((item) => (
              <li key={item} className="flex gap-2.5"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-500" />{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-amber-50 p-5 dark:bg-amber-500/10">
          <p className="text-xs font-black text-amber-700 dark:text-amber-200">WHAT IS HOLDING YOU BACK</p>
          <ul className="mt-3 space-y-2.5 text-sm leading-6">
            {analysis.gaps.map((item) => (
              <li key={item} className="flex gap-2.5"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-500" />{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_.85fr]">
        <div className="rounded-2xl border border-ui p-5">
          <p className="text-sm font-black">Do this next</p>
          <ol className="mt-3 space-y-3">
            {analysis.nextSteps.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm leading-6">
                <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-brand-600 text-[11px] font-black text-white">{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-2xl bg-[var(--surface-soft)] p-5">
          <p className="text-sm font-black">Short revision plan</p>
          <div className="mt-3 space-y-3">
            {analysis.studyPlan.map((item) => (
              <div key={`${item.day}-${item.focus}`} className="rounded-xl border border-ui bg-[var(--surface)] p-3.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-brand-600">{item.day}</p>
                <p className="mt-1 text-xs font-semibold leading-5">{item.focus}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ui pt-5">
        <p className="max-w-2xl text-[11px] leading-5 text-muted">{analysis.evidenceNote}</p>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="focus-ring inline-flex items-center gap-2 rounded-xl border border-ui px-4 py-2.5 text-xs font-black disabled:opacity-60"
        >
          {loading ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Reload saved analysis
        </button>
      </div>
      {error ? (
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-rose-50 p-4 text-xs font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
        </p>
      ) : null}
    </section>
  );
}
