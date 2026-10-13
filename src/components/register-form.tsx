"use client";

import Link from "next/link";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useMemo, useState } from "react";
import { TurnstileWidget } from "@/components/turnstile-widget";

type Fields = {
  name: string;
  email: string;
  phone: string;
  password: string;
  dateOfBirth: string;
  guardianEmail: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  captchaToken: string;
};

type ApiPayload = {
  next?: string;
  error?: { message?: string; fieldErrors?: Record<string, string[]> };
};

const TODAY = new Date();
const TODAY_INPUT_MAX = TODAY.toISOString().slice(0, 10);

function isLearnerMinor(value: string) {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return false;
  let age = TODAY.getFullYear() - parts[0];
  if (TODAY.getMonth() + 1 < parts[1] || (TODAY.getMonth() + 1 === parts[1] && TODAY.getDate() < parts[2])) age -= 1;
  return age < 18;
}

export function RegisterForm() {
  const router = useRouter();
  const [fields, setFields] = useState<Fields>({
    name: "",
    email: "",
    phone: "",
    password: "",
    dateOfBirth: "",
    guardianEmail: "",
    termsAccepted: false,
    privacyAccepted: false,
    captchaToken: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [captchaReset, setCaptchaReset] = useState(0);
  const minor = useMemo(() => isLearnerMinor(fields.dateOfBirth), [fields.dateOfBirth]);
  const setCaptchaToken = useCallback((captchaToken: string) => setFields((current) => ({ ...current, captchaToken })), []);

  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);
    try {
      const response = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(fields),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok) {
        setFieldErrors(payload.error?.fieldErrors ?? {});
        throw new Error(payload.error?.message || "Unable to create account.");
      }
      router.push(payload.next || "/check-email?mode=register");
      router.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to create account.");
      setCaptchaReset((current) => current + 1);
      setLoading(false);
    }
  }

  const inputClass = "focus-ring surface h-13 w-full rounded-xl px-4 text-sm outline-none placeholder:text-slate-400";
  return (
    <>
      {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-bold">Full name</span>
          <input value={fields.name} onChange={(event) => update("name", event.target.value)} required autoComplete="name" placeholder="Your full name" className={inputClass} />
          {fieldErrors.name && <span className="mt-1 block text-xs text-rose-600">{fieldErrors.name[0]}</span>}
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-bold">Email address</span>
          <input value={fields.email} onChange={(event) => update("email", event.target.value)} required type="email" autoComplete="email" placeholder="you@example.com" className={inputClass} />
          {fieldErrors.email && <span className="mt-1 block text-xs text-rose-600">{fieldErrors.email[0]}</span>}
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-bold">Date of birth</span>
          <input value={fields.dateOfBirth} onChange={(event) => update("dateOfBirth", event.target.value)} required type="date" max={TODAY_INPUT_MAX} autoComplete="bday" className={inputClass} />
          <span className="mt-1 block text-xs text-muted">Used for age-appropriate privacy and guardian controls.</span>
          {fieldErrors.dateOfBirth && <span className="mt-1 block text-xs text-rose-600">{fieldErrors.dateOfBirth[0]}</span>}
        </label>
        {minor && (
          <label className="block rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
            <span className="mb-2 block text-sm font-bold">Parent or guardian email</span>
            <input value={fields.guardianEmail} onChange={(event) => update("guardianEmail", event.target.value)} required type="email" autoComplete="email" placeholder="guardian@example.com" className={inputClass} />
            <span className="mt-2 block text-xs leading-5 text-muted">A separate one-time consent link will be sent here. The account activates only after learner email verification and guardian consent.</span>
            {fieldErrors.guardianEmail && <span className="mt-1 block text-xs text-rose-600">{fieldErrors.guardianEmail[0]}</span>}
          </label>
        )}
        <label className="block">
          <span className="mb-2 flex items-center justify-between text-sm font-bold"><span>Mobile number</span><span className="text-xs font-medium text-muted">Optional</span></span>
          <input value={fields.phone} onChange={(event) => update("phone", event.target.value)} type="tel" autoComplete="tel" placeholder="e.g. +919876543210" className={inputClass} />
          {fieldErrors.phone && <span className="mt-1 block text-xs text-rose-600">{fieldErrors.phone[0]}</span>}
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-bold">Create password</span>
          <span className="relative block">
            <input value={fields.password} onChange={(event) => update("password", event.target.value)} required type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="8+ characters with a letter and number" className={`${inputClass} pr-12`} />
            <button type="button" onClick={() => setShowPassword((value) => !value)} className="focus-ring absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </span>
          {fieldErrors.password && <span className="mt-1 block text-xs text-rose-600">{fieldErrors.password[0]}</span>}
        </label>
        <label className="flex items-start gap-3 pt-1 text-xs leading-5 text-muted">
          <input checked={fields.termsAccepted} onChange={(event) => update("termsAccepted", event.target.checked)} type="checkbox" required className="mt-1 size-4 rounded border-slate-300 accent-brand-600" />
          <span>I accept the <Link href="/terms" target="_blank" className="font-bold text-brand-600 hover:underline">Terms of Use</Link>.</span>
        </label>
        <label className="flex items-start gap-3 text-xs leading-5 text-muted">
          <input checked={fields.privacyAccepted} onChange={(event) => update("privacyAccepted", event.target.checked)} type="checkbox" required className="mt-1 size-4 rounded border-slate-300 accent-brand-600" />
          <span>I have read the <Link href="/privacy" target="_blank" className="font-bold text-brand-600 hover:underline">Privacy Policy</Link>, including the learner and guardian notice.</span>
        </label>
        {(fieldErrors.termsAccepted || fieldErrors.privacyAccepted) && <p className="text-xs text-rose-600">Terms and Privacy acceptance are required.</p>}
        <TurnstileWidget onToken={setCaptchaToken} resetKey={captchaReset} />
        {fieldErrors.captchaToken && <p className="text-xs text-rose-600">{fieldErrors.captchaToken[0]}</p>}
        <button disabled={loading} className="focus-ring flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-black text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-60">
          {loading ? <LoaderCircle size={18} className="animate-spin" /> : <>Create learning profile <ArrowRight size={17} /></>}
        </button>
      </form>
      <p className="mt-7 text-center text-sm text-muted">Already have an account? <Link href="/login" className="focus-ring rounded font-black text-brand-600 hover:underline">Sign in</Link></p>
    </>
  );
}
