"use client";

import Link from "next/link";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { FormEvent, useState } from "react";

type Mode = "verify-email" | "guardian-consent";

export function TokenActionForm({ mode, token }: { mode: Mode; token: string }) {
  const guardianMode = mode === "guardian-consent";
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(token ? "" : "This link is missing its security token.");
  const [message, setMessage] = useState("");
  const [activated, setActivated] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, ...(guardianMode ? { consentAccepted } : {}) }),
      });
      const payload = (await response.json()) as { message?: string; activated?: boolean; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Unable to complete verification.");
      setMessage(payload.message || "Verification completed.");
      setActivated(Boolean(payload.activated));
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to complete verification.");
    } finally {
      setLoading(false);
    }
  }

  if (message) {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto mb-4 text-emerald-600" size={44} />
        <p role="status" className="text-sm font-semibold leading-6">{message}</p>
        <div className="mt-7 grid gap-3">
          {(activated || !guardianMode) && <Link href="/login" className="focus-ring rounded-xl bg-brand-600 px-5 py-3 text-sm font-black text-white">Go to sign in</Link>}
          {!activated && <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">The account stays pending until every required verification step is complete.</p>}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {guardianMode && (
        <>
          <div className="rounded-xl bg-[var(--surface-soft)] p-4 text-sm leading-6 text-muted">
            By confirming, you state that you are the learner&apos;s parent/legal guardian or are otherwise authorized to consent, and that you have reviewed the <Link href="/privacy" target="_blank" className="font-bold text-brand-600 underline">Privacy Policy</Link> and <Link href="/terms" target="_blank" className="font-bold text-brand-600 underline">Terms</Link>. This technical workflow does not replace any consent documentation required by applicable law.
          </div>
          <label className="flex items-start gap-3 text-sm leading-6">
            <input checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} type="checkbox" required className="mt-1 size-4 accent-brand-600" />
            <span>I am authorized to provide guardian consent for this learner&apos;s account.</span>
          </label>
        </>
      )}
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">{error}</div>}
      <button disabled={loading || !token} className="focus-ring flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-black text-white disabled:opacity-60">{loading && <LoaderCircle size={18} className="animate-spin" />}{guardianMode ? "Confirm guardian consent" : "Verify my email"}</button>
      <p className="text-center text-xs leading-5 text-muted">For your safety, this action happens only when you press the button; email-link scanners cannot automatically approve it.</p>
    </form>
  );
}
