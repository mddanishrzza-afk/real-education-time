import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; verified?: string; reset?: string }> }) {
  const user = await getCurrentUser();
  const { next, verified, reset } = await searchParams;
  if (user) redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
  const demoEnabled = process.env.NODE_ENV !== "production" || process.env.ENABLE_DEMO_LOGIN === "true";
  const successMessage = verified === "1"
    ? "Email verification completed. Sign in to continue."
    : reset === "1"
      ? "Password changed successfully. Sign in with your new password."
      : undefined;
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue your personalized learning journey.">
      <LoginForm nextPath={next} demoEnabled={demoEnabled} successMessage={successMessage} />
    </AuthShell>
  );
}
