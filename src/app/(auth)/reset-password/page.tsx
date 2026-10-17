import type { Metadata } from "next";
import { ResetPasswordForm } from "./form";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-ink">Choose a new password</h1>
      <p className="mt-1 mb-8 text-sm text-ink-soft">Use at least 8 characters. Don&apos;t reuse a password from another site.</p>
      <ResetPasswordForm />
    </>
  );
}
