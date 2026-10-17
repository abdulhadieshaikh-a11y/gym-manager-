"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { FormError } from "@/components/app/form-error";
import { requestPasswordReset } from "@/app/auth/actions";

export function ForgotPasswordForm() {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [sent, setSent] = React.useState<string>();
  const [pending, startTransition] = React.useTransition();

  if (sent) {
    return (
      <div className="flex gap-3 rounded-[var(--radius-md)] bg-good-soft p-4 text-sm text-good" role="status">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>{sent} The link expires after a short time, so use it soon.</p>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        startTransition(async () => {
          try {
            const res = await requestPasswordReset({ email });
            if (res.ok) setSent(res.message);
            else setError(res.error);
          } catch {
            setError("Could not reach the server. Check your connection and try again.");
          }
        });
      }}
    >
      <FormError message={error} />
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" autoFocus />
      </Field>
      <Button type="submit" size="lg" loading={pending} className="w-full">
        Send reset link
      </Button>
    </form>
  );
}
