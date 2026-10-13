"use client";

import Link from "next/link";
import { LoaderCircle, Mail } from "lucide-react";
import { FormEvent, useCallback, useState } from "react";
import { TurnstileWidget } from "@/components/turnstile-widget";

type Mode = "forgot-password" | "resend-verification";

const copy: Record<Mode, { endpoint: string; button: string }> = {
  "forgot-password": { endpoint: "/api/v1/auth/forgot-password", button: "Send reset link" },
  "resend-verification": { endpoint: "/api/v1/auth/resend-verification", button: "Resend verification" },
};

export function EmailActionForm({ mode, initialEmail = "" }: { mode: Mode; initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [developmentActionPath, setDevelopmentActionPath] = useState("");
  const updateCaptcha = useCallback((token: string) => setCaptchaToken(token), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setDevelopmentActionPath("");
    setLoading(true);
    try {
      const response = await fetch(copy[mode].endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, captchaToken }),
      });
      const payload = (await response.json()) as {
        message?: string;
        developmentActionPath?: string;
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message || "Unable to process this request.");
      setMessage(payload.message || "Request received. Please check your email.");
      if (
        mode === "forgot-password" &&
        payload.developmentActionPath?.startsWith("/reset-password?token=")
      ) {
        setDevelopmentActionPath(payload.developmentActionPath);
      }
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to process this request.");
    } finally {
      setCaptchaReset((current) => current + 1);
      setLoading(false);
    }
  }

  return (
    <>
      {message && <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">{message}</div>}
      {developmentActionPath && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
          <p className="font-semibold">Local preview में email भेजने की जगह यह सुरक्षित test link दिखाया गया है।</p>
          <Link href={developmentActionPath} className="mt-2 inline-flex font-black text-brand-700 underline underline-offset-4 dark:text-brand-300">
            Open password-reset page
          </Link>
        </div>
      )}
      {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">{error}</div>}
      <form onSubmit={submit} className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-bold">Account email</span>
          <span className="relative block"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required placeholder="you@example.com" className="focus-ring surface h-13 w-full rounded-xl pl-11 pr-4 text-sm outline-none placeholder:text-slate-400" /></span>
        </label>
        <TurnstileWidget onToken={updateCaptcha} resetKey={captchaReset} />
        <button disabled={loading} className="focus-ring flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-black text-white disabled:opacity-60">{loading && <LoaderCircle size={18} className="animate-spin" />}{copy[mode].button}</button>
      </form>
      <p className="mt-7 text-center text-sm text-muted"><Link href="/login" className="font-black text-brand-600 hover:underline">Back to sign in</Link></p>
    </>
  );
}
