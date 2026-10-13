import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { EmailActionForm } from "@/components/email-action-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return <AuthShell title="Reset your password" subtitle="अपना account email दर्ज करें। सुरक्षा के लिए registered और unregistered email पर response समान रहता है।"><EmailActionForm mode="forgot-password" /></AuthShell>;
}
