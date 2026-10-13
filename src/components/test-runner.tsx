"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, Check, Clock3, Flag, Languages, LoaderCircle, Send, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type RunnerQuestion = {
  id: string; publicId: string; stemEn: string; stemHi: string | null; difficulty: string; estimatedSeconds: number;
  topic: { titleEn: string; titleHi: string | null };
  options: { id: string; label: string; textEn: string; textHi: string | null; sequence: number }[];
};
type RunnerTest = { id: string; titleEn: string; titleHi: string | null; descriptionEn: string | null; instructionsEn: string | null; instructionsHi: string | null; durationMinutes: number; totalMarks: number; mode: string; questions: RunnerQuestion[] };

function clock(total: number) { const value = Math.max(0, total); const m = Math.floor(value / 60); const s = value % 60; return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`; }

export function TestRunner({ test }: { test: RunnerTest }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"intro" | "active" | "submitting">("intro");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [language, setLanguage] = useState<"EN" | "HI">("EN");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [spent, setSpent] = useState<Record<string, number>>({});
  const [remaining, setRemaining] = useState(test.durationMinutes * 60);
  const [error, setError] = useState("");
  const [accessRequired, setAccessRequired] = useState(false);
  const answersRef = useRef(answers);
  const spentRef = useRef(spent);
  const submitLock = useRef(false);
  const submitRef = useRef<(manual?: boolean) => void>(() => undefined);
  const current = test.questions[index];

  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { spentRef.current = spent; }, [spent]);

  async function begin() {
    setError("");
    try {
      const response = await fetch("/api/v1/attempts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ testId: test.id }) });
      const payload = await response.json();
      if (!response.ok) {
        setAccessRequired(payload.error?.code === "ACCESS_REQUIRED");
        throw new Error(payload.error?.message || "Unable to start test.");
      }
      setAccessRequired(false);
      const elapsed = Math.max(0, Math.floor((Date.now() - new Date(payload.attempt.startedAt).getTime()) / 1000));
      setRemaining(Math.max(0, test.durationMinutes * 60 - elapsed));
      setAttemptId(payload.attempt.id); setPhase("active");
    } catch (value) { setError(value instanceof Error ? value.message : "Unable to start test."); }
  }

  const submit = useCallback(async (manual = true) => {
    if (!attemptId || submitLock.current) return;
    const unanswered = test.questions.length - Object.keys(answersRef.current).length;
    if (manual && unanswered > 0 && !window.confirm(`${unanswered} question${unanswered === 1 ? " is" : "s are"} unanswered. Submit anyway?`)) return;
    submitLock.current = true; setPhase("submitting"); setError("");
    const body = { answers: test.questions.map((question) => ({ questionId: question.id, selectedOptionId: answersRef.current[question.id] ?? null, responseSeconds: spentRef.current[question.id] ?? 0 })) };
    try {
      const response = await fetch(`/api/v1/attempts/${attemptId}/submit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Unable to submit test.");
      router.push(payload.next); router.refresh();
    } catch (value) { setError(value instanceof Error ? value.message : "Unable to submit test."); submitLock.current = false; setPhase("active"); }
  }, [attemptId, router, test.questions]);

  useEffect(() => { submitRef.current = submit; }, [submit]);

  useEffect(() => {
    if (phase !== "active") return;
    const interval = window.setInterval(() => {
      setSpent((values) => ({ ...values, [test.questions[index].id]: (values[test.questions[index].id] ?? 0) + 1 }));
      setRemaining((value) => {
        if (value <= 1) { window.clearInterval(interval); queueMicrotask(() => submitRef.current(false)); return 0; }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [phase, index, test.questions]);

  useEffect(() => {
    if (phase !== "active") return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase]);

  if (phase === "intro") return <section className="mx-auto max-w-3xl"><div className="surface overflow-hidden rounded-3xl shadow-card"><div className="bg-gradient-to-r from-brand-700 to-violet-600 p-7 text-white sm:p-10"><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider"><ShieldCheck size={14} /> Secure test session</span><h1 className="mt-5 text-3xl font-black sm:text-4xl">{test.titleEn}</h1>{test.titleHi && <p className="mt-2 text-base font-semibold text-white/70">{test.titleHi}</p>}<p className="mt-5 max-w-2xl text-sm leading-6 text-white/70">{test.descriptionEn}</p></div><div className="p-6 sm:p-9"><div className="grid grid-cols-3 gap-3"><Info value={String(test.questions.length)} label="Questions" /><Info value={`${test.durationMinutes} min`} label="Duration" /><Info value={String(test.totalMarks)} label="Marks" /></div><div className="mt-8 rounded-2xl bg-[var(--surface-soft)] p-5"><h2 className="text-sm font-black">Before you begin</h2><ul className="mt-3 space-y-2 text-sm leading-6 text-muted"><li>• {test.instructionsEn || "Choose the best answer for each question."}</li>{test.instructionsHi && <li>• {test.instructionsHi}</li>}<li>• The timer starts only after you press the button below.</li><li>• Answers are scored on the server; unanswered questions receive zero.</li></ul></div>{error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{error}</p>}{accessRequired && <a href="/access" className="focus-ring mt-4 flex w-full items-center justify-center rounded-xl border border-brand-300 px-6 py-3 text-sm font-black text-brand-700 dark:text-brand-200">Activate demo or unlock access</a>}<button onClick={begin} className="focus-ring mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-4 text-sm font-black text-white shadow-lg shadow-brand-600/20">Start test <ArrowRight size={17} /></button></div></div></section>;

  const answered = Object.keys(answers).length;
  const warning = remaining <= 120;
  return <section className="mx-auto max-w-5xl"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-brand-600">{test.mode.replaceAll("_", " ")}</p><h1 className="mt-1 text-lg font-black sm:text-xl">{test.titleEn}</h1></div><div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 font-mono text-base font-black ${warning ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200" : "surface"}`}><Clock3 size={18} /> {clock(remaining)}</div></div><div className="mb-5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-soft)]"><div className={`h-full transition-all ${warning ? "bg-rose-500" : "bg-brand-600"}`} style={{ width: `${(remaining / (test.durationMinutes * 60)) * 100}%` }} /></div>
    {error && <div role="alert" className="mb-4 flex items-center gap-3 rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200"><AlertTriangle size={18} />{error}</div>}
    <div className="grid gap-5 lg:grid-cols-[1fr_250px]"><article className="surface rounded-3xl p-5 sm:p-8"><div className="flex items-start justify-between gap-4"><div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-black text-brand-700 dark:bg-brand-500/10 dark:text-brand-200">Question {index + 1} of {test.questions.length}</span><span className="rounded-lg bg-[var(--surface-soft)] px-3 py-1.5 text-[11px] font-bold text-muted">{current.topic.titleEn}</span><span className="rounded-lg bg-[var(--surface-soft)] px-3 py-1.5 text-[11px] font-bold text-muted">{current.difficulty}</span></div><button onClick={() => setLanguage((value) => value === "EN" ? "HI" : "EN")} className="focus-ring flex shrink-0 items-center gap-2 rounded-lg border border-ui px-3 py-2 text-xs font-black"><Languages size={15} /> {language === "EN" ? "हिंदी" : "EN"}</button></div><h2 className="mt-7 text-lg font-bold leading-8 sm:text-xl">{language === "HI" && current.stemHi ? current.stemHi : current.stemEn}</h2><div className="mt-7 space-y-3" role="radiogroup" aria-label="Answer options">{current.options.map((option) => { const selected = answers[current.id] === option.id; return <button key={option.id} role="radio" aria-checked={selected} onClick={() => setAnswers((values) => ({ ...values, [current.id]: option.id }))} className={`focus-ring flex w-full items-start gap-3 rounded-2xl border p-4 text-left text-sm leading-6 transition ${selected ? "border-brand-500 bg-brand-50 text-brand-900 dark:bg-brand-500/10 dark:text-brand-100" : "border-ui hover:border-brand-300 hover:bg-[var(--surface-soft)]"}`}><span className={`grid size-8 shrink-0 place-items-center rounded-lg text-xs font-black ${selected ? "bg-brand-600 text-white" : "bg-[var(--surface-soft)]"}`}>{selected ? <Check size={16} /> : option.label}</span><span className="pt-1 font-semibold">{language === "HI" && option.textHi ? option.textHi : option.textEn}</span></button>; })}</div><div className="mt-8 flex items-center justify-between border-t border-ui pt-6"><button onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0} className="focus-ring flex items-center gap-2 rounded-xl border border-ui px-4 py-3 text-sm font-black disabled:opacity-35"><ArrowLeft size={16} /> Previous</button>{index < test.questions.length - 1 ? <button onClick={() => setIndex((value) => value + 1)} className="focus-ring flex items-center gap-2 rounded-xl bg-ink-950 px-5 py-3 text-sm font-black text-white dark:bg-brand-600">Next <ArrowRight size={16} /></button> : <button onClick={() => submit(true)} disabled={phase === "submitting"} className="focus-ring flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">Submit test <Send size={16} /></button>}</div></article>
      <aside className="surface h-fit rounded-3xl p-5"><div className="flex items-center justify-between"><h2 className="text-sm font-black">Question palette</h2><Flag size={17} className="text-muted" /></div><div className="mt-5 grid grid-cols-5 gap-2 lg:grid-cols-4">{test.questions.map((question, questionIndex) => <button key={question.id} onClick={() => setIndex(questionIndex)} className={`focus-ring grid aspect-square place-items-center rounded-lg text-xs font-black ${questionIndex === index ? "ring-2 ring-brand-500 ring-offset-2 dark:ring-offset-slate-900" : ""} ${answers[question.id] ? "bg-brand-600 text-white" : "bg-[var(--surface-soft)] text-muted"}`} aria-label={`Question ${questionIndex + 1}${answers[question.id] ? ", answered" : ", unanswered"}`}>{questionIndex + 1}</button>)}</div><div className="mt-5 border-t border-ui pt-4 text-xs text-muted"><div className="flex justify-between"><span>Answered</span><strong className="text-[var(--ink)]">{answered}/{test.questions.length}</strong></div><div className="mt-2 flex justify-between"><span>Unanswered</span><strong className="text-[var(--ink)]">{test.questions.length - answered}</strong></div></div><button onClick={() => submit(true)} disabled={phase === "submitting"} className="focus-ring mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-60">{phase === "submitting" ? <><LoaderCircle className="animate-spin" size={16} /> Scoring…</> : <><Send size={16} /> Submit test</>}</button></aside></div>
    {phase === "submitting" && <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/65 p-5 backdrop-blur-sm"><div className="surface rounded-3xl p-8 text-center shadow-2xl"><LoaderCircle className="mx-auto animate-spin text-brand-600" size={38} /><h2 className="mt-4 text-lg font-black">Scoring your answers</h2><p className="mt-2 text-sm text-muted">Updating topic mastery securely…</p></div></div>}
  </section>;
}

function Info({ value, label }: { value: string; label: string }) { return <div className="surface-soft rounded-xl p-3 text-center sm:p-4"><span className="block text-xl font-black">{value}</span><span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-muted">{label}</span></div>; }
