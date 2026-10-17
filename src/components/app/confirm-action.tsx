"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";

/**
 * A button that opens a confirmation dialog, optionally asks for a reason,
 * then runs a server action. Used for every destructive / financial action.
 */
export function ConfirmAction({
  trigger,
  triggerVariant = "outline",
  triggerSize = "sm",
  title,
  description,
  confirmLabel,
  confirmVariant = "danger",
  successMessage,
  requireReason,
  reasonLabel = "Reason",
  reasonPlaceholder,
  action,
  onDone,
  redirectTo,
}: {
  trigger: React.ReactNode;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  confirmVariant?: ButtonProps["variant"];
  successMessage: string;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  action: (reason: string) => Promise<ActionResult<unknown>>;
  onDone?: () => void;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | undefined>();
  const [pending, startTransition] = React.useTransition();

  const submit = () => {
    if (requireReason && reason.trim().length < 3) {
      setError("Please enter a reason (at least 3 characters).");
      return;
    }
    setError(undefined);
    startTransition(async () => {
      try {
        const res = await action(reason.trim());
        if (res.ok) {
          toast.success(res.message ?? successMessage);
          setOpen(false);
          setReason("");
          onDone?.();
          if (redirectTo) router.push(redirectTo);
          else router.refresh();
        } else {
          setError(res.error);
        }
      } catch {
        setError("Could not reach the server. Check your connection and try again.");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!pending) {
          setOpen(o);
          if (!o) setError(undefined);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize}>
          {trigger}
        </Button>
      </DialogTrigger>
      <DialogContent title={title} description={description}>
        {requireReason && (
          <Field label={reasonLabel} htmlFor="confirm-reason" required>
            <Textarea
              id="confirm-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              maxLength={300}
              autoFocus
            />
          </Field>
        )}
        {error && (
          <p className="mt-3 rounded-[var(--radius-md)] bg-bad-soft px-3 py-2 text-[13px] text-bad" role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant={confirmVariant} onClick={submit} loading={pending}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
