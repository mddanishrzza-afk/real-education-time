"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, EyeOff, FlaskConical, KeyRound, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useState } from "react";
import { TurnstileWidget } from "@/components/turnstile-widget";

type ApiFailure = { error?: { code?: string; message?: string; fieldErrors?: Record<string, string[]> } };
type LoginResponse = ApiFailure & {
  next?: string;
  requiresOtp?: boolean;
  challengeId?: string;
  maskedEmail?: string;
  expiresInSeconds?: number;
  developmentOtp?: string;
};

export function LoginForm({ nextPath, demoEnabled = false, successMessage }: { nextPath?: string; demoEnabled?: boolean; successMessage?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [developmentOtp, setDevelopmentOtp] = useState("");
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const updateCaptcha = useCallback((token: string) => setCaptchaToken(token), []);

  function navigateAfterLogin(destination?: string) {
    const safeNext = nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : destination || "/dashboard";
    router.push(safeNext);
    router.refresh();
  }

  async function authenticate(loginEmail: string, loginPassword: string) {
    const response = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: loginPassword, captchaToken }),
    });
    const payload = (await response.json()) as LoginResponse;
    if (!response.ok) {
      setErrorCode(payload.error?.code || "");
      throw new Error(payload.error?.message || "Unable to sign in.");
    }
    if (payload.requiresOtp && payload.challengeId) {
      setEmail(loginEmail);
      setPassword("");
      setChallengeId(payload.challengeId);
      setMaskedEmail(payload.maskedEmail || "your registered email");
      setDevelopmentOtp(payload.developmentOtp || "");
      setOtp("");
      setCaptchaReset((current) => current + 1);
      return;
    }
    navigateAfterLogin(payload.next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setErrorCode("");
    setLoading(true);
    try {
      await authenticate(email, password);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to sign in.");
      setCaptchaReset((current) => current + 1);
    } finally {
      setLoading(false);
    }
  }

  async function useDemo() {
    setError("");
    setErrorCode("");
    setDemoLoading(true);
    try {
      await authenticate("student@realeducationtime.com", "Learn@123");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to open demo.");
      setCaptchaReset((current) => current + 1);
    } finally {
      setDemoLoading(false);
    }
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    setError("");
    setErrorCode("");
    setOtpLoading(true);
    try {
      const response = await fetch("/api/v1/auth/login/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId, code: otp }),
      });
      const payload = (await response.json()) as LoginResponse;
      if (!response.ok) {
        setErrorCode(payload.error?.code || "");
        throw new Error(payload.error?.message || "Unable to verify the OTP.");
      }
      setDevelopmentOtp("");
      setOtp("");
      navigateAfterLogin(payload.next);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unable to verify the OTP.");
    } finally {
      setOtpLoading(false);
    }
  }

  function returnToCredentials() {
    setChallengeId("");
    setMaskedEmail("");
    setDevelopmentOtp("");
    setOtp("");
    setError("");
    setErrorCode("");
  }

  if (challengeId) {
    return (
      <>
        <div className="mb-5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-100">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 shrink-0" size={20} />
            <div>
              <p className="font-black">Email OTP verification</p>
              <p className="mt-1 font-medium">6-digit OTP <span className="font-black">{maskedEmail}</span> पर भेजा गया है। यह 10 मिनट तक valid है।</p>
            </div>
          </div>
        </div>
        {developmentOtp && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
            <p className="font-semibold">Local preview OTP</p>
            <button type="button" onClick={() => setOtp(developmentOtp)} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 font-black tracking-[0.28em] text-amber-950 dark:border-amber-300/30 dark:bg-amber-950/30 dark:text-amber-100">
              <KeyRound size={17} />
              <span data-testid="development-login-otp">{developmentOtp}</span>
            </button>
            <p className="mt-2 text-xs font-medium">OTP भरने के लिए code पर tap करें। Production में OTP केवल email से मिलेगा।</p>
          </div>
        )}
        {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">{error}</div>}
        <form onSubmit={verifyOtp} className="space-y-5">
          <label className="block" htmlFor="login-otp">
            <span className="mb-2 block text-sm font-bold">6-digit OTP</span>
            <input id="login-otp" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required placeholder="000000" className="focus-ring surface h-14 w-full rounded-xl px-4 text-center text-xl font-black tracking-[0.32em] outline-none placeholder:text-slate-300" />
          </label>
          <button disabled={otpLoading || otp.length !== 6} className="focus-ring flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-black text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-60">
            {otpLoading ? <LoaderCircle size={18} className="animate-spin" /> : <ShieldCheck size={18} />} Verify OTP and sign in
          </button>
        </form>
        <button type="button" onClick={returnToCredentials} className="focus-ring mx-auto mt-6 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-black text-brand-600 hover:underline">
          <ArrowLeft size={16} /> Use another account
        </button>
      </>
    );
  }

  return (
    <>
      {successMessage && <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">{successMessage}</div>}
      {demoEnabled && (
        <>
          <button onClick={useDemo} disabled={loading || demoLoading} className="focus-ring flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3.5 text-sm font-black text-brand-700 transition hover:border-brand-400 disabled:opacity-60 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
            {demoLoading ? <LoaderCircle size={18} className="animate-spin" /> : <FlaskConical size={18} />} Continue as demo learner
          </button>
          <div className="my-6 flex items-center gap-3"><div className="h-px flex-1 bg-[var(--border)]" /><span className="text-[11px] font-bold uppercase tracking-wider text-muted">or use your account</span><div className="h-px flex-1 bg-[var(--border)]" /></div>
        </>
      )}
      {error && (
        <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
          {errorCode === "EMAIL_VERIFICATION_REQUIRED" && (
            <Link href={`/resend-verification${email ? `?email=${encodeURIComponent(email)}` : ""}`} className="mt-2 block font-black underline">Resend verification email</Link>
          )}
        </div>
      )}
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="login-email" className="mb-2 block text-sm font-bold">Email address</label>
          <span className="relative block"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input id="login-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required placeholder="you@example.com" className="focus-ring surface h-13 w-full rounded-xl pl-11 pr-4 text-sm outline-none placeholder:text-slate-400" /></span>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-sm font-bold"><label htmlFor="login-password">Password</label><Link href="/forgot-password" className="focus-ring rounded text-xs font-bold text-brand-600 hover:underline">Forgot password?</Link></div>
          <span className="relative block"><input id="login-password" value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} autoComplete="current-password" required placeholder="Enter your password" className="focus-ring surface h-13 w-full rounded-xl px-4 pr-12 text-sm outline-none placeholder:text-slate-400" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="focus-ring absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span>
        </div>
        <TurnstileWidget onToken={updateCaptcha} resetKey={captchaReset} />
        <button disabled={loading || demoLoading} className="focus-ring flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-black text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-60">
          {loading ? <LoaderCircle size={18} className="animate-spin" /> : <>Continue to OTP <ArrowRight size={17} /></>}
        </button>
      </form>
      <p className="mt-7 text-center text-sm text-muted">New to Real Education Time? <Link href="/register" className="focus-ring rounded font-black text-brand-600 hover:underline">Create an account</Link></p>
    </>
  );
}
