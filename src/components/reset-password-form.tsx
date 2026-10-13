"use client";

import Link from "next/link";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { FormEvent, useState } from "react";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(token ? "" : "This link is missing its security token.");
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Unable to reset password.");
      setComplete(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  }

  if (complete) {
    return (
      <div className="text-center">
        <p role="status" className="mb-6 text-sm font-semibold text-emerald-700 dark:text-emerald-300">Password changed and existing sessions were signed out.</p>
        <Link href="/login?reset=1" className="focus-ring block rounded-xl bg-brand-600 px-5 py-3 text-sm font-black text-white">Sign in</Link>
      </div>
    );
  }

  const inputClass = "focus-ring surface h-13 w-full rounded-xl px-4 pr-12 text-sm outline-none placeholder:text-slate-400";
  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">{error}</div>}
      <label className="block">
        <span className="mb-2 block text-sm font-bold">New password</span>
        <span className="relative block"><input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} required autoComplete="new-password" placeholder="8+ characters with a letter and number" className={inputClass} /><button type="button" onClick={() => setShowPassword((value) => !value)} className="focus-ring absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center text-slate-400" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span>
      </label>
      <label className="block"><span className="mb-2 block text-sm font-bold">Confirm password</span><input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" required autoComplete="new-password" className={inputClass} /></label>
      <button disabled={loading || !token} className="focus-ring flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-black text-white disabled:opacity-60">{loading && <LoaderCircle size={18} className="animate-spin" />}Change password</button>
    </form>
  );
}
