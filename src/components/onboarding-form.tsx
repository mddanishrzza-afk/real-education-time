"use client";

import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Option = { id: string; nameEn: string; nameHi: string | null };

export function OnboardingForm({ boards, classes }: { boards: Option[]; classes: Option[] }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [boardId, setBoardId] = useState(boards[0]?.id ?? "");
  const [classId, setClassId] = useState(classes.find((item) => item.nameEn === "Class 9")?.id ?? classes[0]?.id ?? "");
  const [preferredLanguage, setLanguage] = useState("HINGLISH");
  const [preparationLevel, setLevel] = useState("BEGINNER");
  const [dailyStudyMinutes, setMinutes] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const response = await fetch("/api/v1/students/me/onboarding", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ boardId, classId, preferredLanguage, preparationLevel, dailyStudyMinutes }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Unable to save your profile.");
      router.push(payload.next || "/tests/class-9-foundation-diagnostic"); router.refresh();
    } catch (value) { setError(value instanceof Error ? value.message : "Unable to save your profile."); setLoading(false); }
  }

  const options = step === 1 ? boards : classes;
  const selected = step === 1 ? boardId : classId;
  const setSelected = step === 1 ? setBoardId : setClassId;
  return (
    <form onSubmit={submit}>
      <div className="mb-8 flex items-center gap-2">{[1,2,3].map((item) => <div key={item} className={`h-1.5 flex-1 rounded-full ${item <= step ? "bg-brand-600" : "bg-slate-100 dark:bg-slate-800"}`} />)}</div>
      {error && <div role="alert" className="mb-5 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{error}</div>}
      {step <= 2 && <div><p className="text-xs font-black uppercase tracking-wider text-brand-600">Step {step} of 3</p><h2 className="mt-2 text-2xl font-black">{step === 1 ? "Which board do you study with?" : "Choose your current class"}</h2><p className="mt-2 text-sm text-muted">{step === 1 ? "We use this to match syllabus-aligned content." : "You can change this later from your profile."}</p><div className="mt-7 grid gap-3 sm:grid-cols-2">{options.map((option) => <button key={option.id} type="button" onClick={() => setSelected(option.id)} className={`focus-ring flex items-center justify-between rounded-2xl border p-4 text-left transition ${selected === option.id ? "border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-100" : "border-ui bg-[var(--surface)] hover:border-brand-300"}`}><span><span className="block text-sm font-black">{option.nameEn}</span>{option.nameHi && <span className="mt-1 block text-xs text-muted">{option.nameHi}</span>}</span>{selected === option.id && <span className="grid size-6 place-items-center rounded-full bg-brand-600 text-white"><Check size={14} /></span>}</button>)}</div></div>}
      {step === 3 && <div><p className="text-xs font-black uppercase tracking-wider text-brand-600">Step 3 of 3</p><h2 className="mt-2 text-2xl font-black">Make learning fit your day</h2><div className="mt-7 space-y-6"><label className="block"><span className="mb-2 block text-sm font-black">Preferred language</span><select value={preferredLanguage} onChange={(e) => setLanguage(e.target.value)} className="focus-ring surface h-13 w-full rounded-xl px-4 text-sm font-semibold"><option value="HINGLISH">Hinglish — easy mix</option><option value="HINDI">हिंदी</option><option value="ENGLISH">English</option></select></label><label className="block"><span className="mb-2 block text-sm font-black">Current preparation level</span><select value={preparationLevel} onChange={(e) => setLevel(e.target.value)} className="focus-ring surface h-13 w-full rounded-xl px-4 text-sm font-semibold"><option value="BEGINNER">Beginner — start from fundamentals</option><option value="INTERMEDIATE">Intermediate — concepts are partly clear</option><option value="ADVANCED">Advanced — challenge me</option></select></label><label className="block"><span className="mb-2 flex justify-between text-sm font-black"><span>Daily study time</span><span className="text-brand-600">{dailyStudyMinutes} minutes</span></span><input type="range" min="15" max="180" step="15" value={dailyStudyMinutes} onChange={(e) => setMinutes(Number(e.target.value))} className="w-full accent-brand-600" /></label></div></div>}
      <div className="mt-9 flex gap-3">{step > 1 && <button type="button" onClick={() => setStep((value) => value - 1)} className="focus-ring rounded-xl border border-ui px-5 py-3 text-sm font-black">Back</button>}{step < 3 ? <button key={`advance-${step}`} type="button" onClick={(event) => { event.preventDefault(); setStep((value) => value + 1); }} disabled={!selected} className="focus-ring ml-auto flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-black text-white disabled:opacity-50">Continue <ArrowRight size={16} /></button> : <button key="onboarding-submit" type="submit" disabled={loading} className="focus-ring ml-auto flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-black text-white disabled:opacity-50">{loading ? <LoaderCircle className="animate-spin" size={17} /> : <>Start diagnostic <ArrowRight size={16} /></>}</button>}</div>
    </form>
  );
}
