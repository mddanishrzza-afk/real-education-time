import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { EmailActionForm } from "@/components/email-action-form";

export const metadata: Metadata = { title: "Resend verification" };

export default async function ResendVerificationPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return <AuthShell title="Resend verification" subtitle="We will send fresh learner verification and any outstanding guardian-consent instructions."><EmailActionForm mode="resend-verification" initialEmail={email || ""} /></AuthShell>;
}
