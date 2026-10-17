import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-ink">Reset your password</h1>
      <p className="mt-1 mb-8 text-sm text-ink-soft">
        Enter your account email. We&apos;ll send a link to choose a new password.
      </p>
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-[13px] text-ink-soft">
        <Link href="/login" className="text-brass-strong hover:underline">
          Back to log in
        </Link>
      </p>
    </>
  );
}
