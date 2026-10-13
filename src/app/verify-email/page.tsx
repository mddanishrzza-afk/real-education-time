import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { TokenActionForm } from "@/components/token-action-form";

export const metadata: Metadata = { title: "Verify email", robots: { index: false, follow: false } };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <AuthShell title="Verify your email" subtitle="Confirm your learner email before the one-time link expires."><TokenActionForm mode="verify-email" token={token || ""} /></AuthShell>;
}
