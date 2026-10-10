import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";

export const metadata: Metadata = { title: "Reset password · Choresome" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Forgot your password?" subtitle="We'll email you a link to choose a new one.">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
