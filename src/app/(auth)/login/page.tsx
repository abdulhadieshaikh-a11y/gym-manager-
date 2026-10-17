import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const linkError = sp.error === "link";
  return (
    <>
      <h1 className="text-2xl font-bold text-ink">Log in</h1>
      <p className="mt-1 mb-8 text-sm text-ink-soft">Use the email and password provided for this gym.</p>
      {linkError && (
        <p className="mb-5 rounded-[var(--radius-md)] bg-warn-soft px-3 py-2.5 text-[13px] text-warn" role="alert">
          That link is invalid or has expired. Request a new password reset link.
        </p>
      )}
      <LoginForm next={next} />
    </>
  );
}
