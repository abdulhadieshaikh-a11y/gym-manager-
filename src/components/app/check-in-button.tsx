"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogIn } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { FormError } from "@/components/app/form-error";
import { checkIn } from "@/app/(app)/attendance/actions";

/**
 * Checks a member in. If their membership isn't valid today the server refuses;
 * the owner can then explicitly allow it with a reason (recorded in the audit log).
 */
export function CheckInButton({
  memberId,
  memberName,
  isOwner,
  size = "sm",
  variant = "primary",
  onCheckedIn,
}: {
  memberId: string;
  memberName: string;
  isOwner: boolean;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  onCheckedIn?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [overrideOpen, setOverrideOpen] = React.useState(false);
  const [blockedMessage, setBlockedMessage] = React.useState<string>();
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string>();

  const run = (override: boolean) =>
    startTransition(async () => {
      try {
        const res = await checkIn(memberId, override, reason);
        if (res.ok) {
          toast.success(`${memberName} checked in`, override ? { description: "Override recorded in the audit log." } : undefined);
          setOverrideOpen(false);
          setReason("");
          onCheckedIn?.();
          router.refresh();
          return;
        }
        if (res.code === "MEMBERSHIP_NOT_VALID") {
          setBlockedMessage(res.error);
          setOverrideOpen(true);
          return;
        }
        if (override) setError(res.error);
        else if (res.code === "ALREADY_CHECKED_IN") toast.info(`${memberName} has already checked in today`);
        else toast.error(res.error);
      } catch {
        toast.error("Could not reach the server. Check your connection and try again.");
      }
    });

  return (
    <>
      <Button size={size} variant={variant} loading={pending && !overrideOpen} onClick={() => run(false)}>
        <LogIn /> Check in
      </Button>
      <Dialog open={overrideOpen} onOpenChange={(o) => !pending && setOverrideOpen(o)}>
        <DialogContent title="Membership not valid today" description={`${memberName}: ${blockedMessage ?? ""}`}>
          {isOwner ? (
            <>
              <p className="mb-3 text-sm text-ink-soft">
                Renew the membership first, or allow a one-time check-in. Allowed check-ins are marked as overrides and recorded with your reason.
              </p>
              <Field label="Reason for allowing entry" htmlFor="override-reason" required>
                <Textarea
                  id="override-reason"
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Paying renewal tomorrow"
                  maxLength={300}
                  autoFocus
                />
              </Field>
              <div className="mt-3">
                <FormError message={error} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOverrideOpen(false)} disabled={pending}>
                  Don&apos;t check in
                </Button>
                <Button
                  variant="danger"
                  loading={pending}
                  onClick={() => {
                    if (reason.trim().length < 3) return setError("Please enter a reason (at least 3 characters).");
                    setError(undefined);
                    run(true);
                  }}
                >
                  Allow check-in
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-soft">Ask the owner to renew the membership or approve entry.</p>
              <DialogFooter>
                <Button onClick={() => setOverrideOpen(false)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
