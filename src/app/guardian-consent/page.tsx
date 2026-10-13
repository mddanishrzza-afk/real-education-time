import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { TokenActionForm } from "@/components/token-action-form";

export const metadata: Metadata = { title: "Guardian consent", robots: { index: false, follow: false } };

export default async function GuardianConsentPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <AuthShell title="Guardian consent" subtitle="Review this request carefully before confirming a learner account."><TokenActionForm mode="guardian-consent" token={token || ""} /></AuthShell>;
}
