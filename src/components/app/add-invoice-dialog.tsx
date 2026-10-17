"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { FormError } from "@/components/app/form-error";
import { invoiceFormSchema, type InvoiceFormValues } from "@/lib/validation";
import { createInvoice } from "@/app/(app)/fees/actions";

export function AddInvoiceDialog({
  memberId,
  memberName,
  today,
  currency,
  trigger,
}: {
  memberId: string;
  memberName: string;
  today: string;
  currency: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string>();
  const defaults: InvoiceFormValues = { member_id: memberId, description: "", amount: "", due_date: today };
  const form = useForm<InvoiceFormValues>({ resolver: zodResolver(invoiceFormSchema), defaultValues: defaults });
  const { register, handleSubmit, formState, reset } = form;
  const errors = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    try {
      const res = await createInvoice(values);
      if (!res.ok) return setServerError(res.error);
      toast.success(res.message ?? "Fee added");
      setOpen(false);
      router.refresh();
    } catch {
      setServerError("Could not reach the server. Check your connection and try again.");
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (formState.isSubmitting) return;
        setOpen(o);
        if (o) {
          reset(defaults);
          setServerError(undefined);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title="Add a fee" description={`For ${memberName} — e.g. admission fee or personal training. Membership fees are created automatically.`}>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormError message={serverError} />
          <Field label="Description" htmlFor="inv-desc" error={errors.description?.message} required>
            <Input id="inv-desc" placeholder="e.g. Admission fee" {...register("description")} aria-invalid={Boolean(errors.description)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`Amount (${currency})`} htmlFor="inv-amount" error={errors.amount?.message} required>
              <Input id="inv-amount" inputMode="decimal" {...register("amount")} aria-invalid={Boolean(errors.amount)} />
            </Field>
            <Field label="Due date" htmlFor="inv-due" error={errors.due_date?.message} required>
              <Input id="inv-due" type="date" {...register("due_date")} aria-invalid={Boolean(errors.due_date)} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={formState.isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={formState.isSubmitting}>
              Add fee
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
