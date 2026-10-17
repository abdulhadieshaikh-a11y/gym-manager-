"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { FormError } from "@/components/app/form-error";
import { updatePassword } from "@/app/auth/actions";

export function ResetPasswordForm({ redirectTo = "/dashboard", submitLabel = "Save new password" }: { redirectTo?: string | null; submitLabel?: string }) {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        setFieldErrors({});
        startTransition(async () => {
          try {
            const res = await updatePassword({ password, confirm });
            if (res.ok) {
              toast.success("Password updated");
              setPassword("");
              setConfirm("");
              if (redirectTo) router.replace(redirectTo);
            } else {
              setError(res.error);
              setFieldErrors(res.fieldErrors ?? {});
            }
          } catch {
            setError("Could not reach the server. Check your connection and try again.");
          }
        });
      }}
    >
      <FormError message={error} />
      <Field label="New password" htmlFor="new-password" error={fieldErrors.password}>
        <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={Boolean(fieldErrors.password)} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm-password" error={fieldErrors.confirm}>
        <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={Boolean(fieldErrors.confirm)} />
      </Field>
      <Button type="submit" loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
