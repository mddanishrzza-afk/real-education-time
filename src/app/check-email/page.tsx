import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return (
    <AuthShell title="Check your email" subtitle="Your account is not active yet.">
      <div className="text-center">
        <MailCheck className="mx-auto mb-4 text-brand-600" size={42} />
        <p className="text-sm leading-6 text-muted">Open the one-time verification link sent to the learner email. If the learner is under 18, the parent or guardian must also open their separate consent link.</p>
        <p className="mt-3 text-xs leading-5 text-muted">For privacy, this page does not confirm whether an email is registered.</p>
        <div className="mt-7 grid gap-3">
          <Link href="/login" className="focus-ring rounded-xl bg-brand-600 px-5 py-3 text-sm font-black text-white">Go to sign in</Link>
          <Link href="/resend-verification" className="focus-ring rounded-xl border border-[var(--border)] px-5 py-3 text-sm font-black text-brand-600">Resend instructions</Link>
        </div>
      </div>
    </AuthShell>
  );
}
