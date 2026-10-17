"use client";

import * as React from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { FormError } from "@/components/app/form-error";
import { formatDate } from "@/lib/dates";
import { formatMoney, PAYMENT_METHODS } from "@/lib/format";
import { newUuid } from "@/lib/uuid";
import { paymentFormSchema, type PaymentFormValues } from "@/lib/validation";
import { recordPayment } from "@/app/(app)/fees/actions";

export type PayableInvoice = {
  id: string;
  invoice_no: string;
  description: string;
  member_name: string;
  amount_due: number;
  amount_paid: number;
  balance: number;
  due_date: string;
};

export function RecordPaymentDialog({
  invoice,
  today,
  currency,
  trigger,
  mode = "record",
}: {
  invoice: PayableInvoice;
  today: string;
  currency: string;
  trigger: React.ReactNode;
  /** "settle" pre-fills the full balance ("Mark as paid"). */
  mode?: "record" | "settle";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string>();

  const makeDefaults = (): PaymentFormValues => ({
    invoice_id: invoice.id,
    amount: String(invoice.balance),
    method: "cash",
    payment_date: today,
    reference: "",
    notes: "",
    // One key per dialog opening: double-clicks and retries reuse it, so the
    // database returns the same payment instead of creating a duplicate.
    idempotency_key: newUuid(),
  });

  const form = useForm<PaymentFormValues>({ resolver: zodResolver(paymentFormSchema), defaultValues: makeDefaults() });
  const { register, handleSubmit, formState, reset, setError } = form;
  const errors = formState.errors;
  const method = useWatch({ control: form.control, name: "method" });
  const amountStr = useWatch({ control: form.control, name: "amount" });
  const amount = Number((amountStr ?? "").replace(/,/g, ""));
  const remainingAfter = Number.isFinite(amount) ? Math.max(0, Math.round((invoice.balance - amount) * 100) / 100) : invoice.balance;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    try {
      const res = await recordPayment(values);
      if (!res.ok) {
        setServerError(res.error);
        Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => setError(k as keyof PaymentFormValues, { message: m }));
        return;
      }
      toast.success(res.message ?? "Payment recorded", {
        description: <Link href={`/receipt/${res.data.paymentId}`} className="underline">View / print receipt</Link>,
      });
      setOpen(false);
      router.refresh();
    } catch {
      setServerError("Could not reach the server. Your payment may not have been saved — check the fee record before trying again.");
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (formState.isSubmitting) return;
        setOpen(o);
        if (o) {
          reset(makeDefaults());
          setServerError(undefined);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        title={mode === "settle" ? "Mark as paid" : "Record payment"}
        description={`${invoice.member_name} — ${invoice.invoice_no}`}
      >
        <div className="mb-4 grid grid-cols-3 gap-px overflow-hidden rounded-[var(--radius-md)] bg-line text-center">
          {[
            ["Fee", invoice.amount_due],
            ["Paid so far", invoice.amount_paid],
            ["Balance", invoice.balance],
          ].map(([label, value]) => (
            <div key={label as string} className="bg-canvas px-2 py-2.5">
              <p className="text-[11.5px] text-ink-faint">{label}</p>
              <p className="tabular font-display text-[15px] font-semibold text-ink">{formatMoney(value as number, currency)}</p>
            </div>
          ))}
        </div>
        <p className="mb-4 text-[13px] text-ink-soft">
          {invoice.description} · due {formatDate(invoice.due_date)}
        </p>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormError message={serverError} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`Amount received (${currency})`} htmlFor="pay-amount" error={errors.amount?.message} required>
              <Input id="pay-amount" inputMode="decimal" {...register("amount")} aria-invalid={Boolean(errors.amount)} autoFocus />
            </Field>
            <Field label="Payment date" htmlFor="pay-date" error={errors.payment_date?.message} required>
              <Input id="pay-date" type="date" max={today} {...register("payment_date")} aria-invalid={Boolean(errors.payment_date)} />
            </Field>
          </div>
          <p className="-mt-2 text-[12.5px] text-ink-soft">
            {remainingAfter === 0 ? "This settles the fee in full." : `Remaining after this payment: ${formatMoney(remainingAfter, currency)} (stays partially paid).`}
          </p>
          <Field label="Method" htmlFor="pay-method" error={errors.method?.message} required>
            <NativeSelect id="pay-method" {...register("method")}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            label="Transaction reference"
            htmlFor="pay-ref"
            error={errors.reference?.message}
            hint={method === "cash" ? "Optional" : "Optional — e.g. the Easypaisa / JazzCash / bank transaction ID"}
          >
            <Input id="pay-ref" {...register("reference")} />
          </Field>
          <Field label="Notes" htmlFor="pay-notes" error={errors.notes?.message}>
            <Textarea id="pay-notes" rows={2} {...register("notes")} />
          </Field>
          {method !== "cash" && (
            <p className="rounded-[var(--radius-md)] bg-warn-soft px-3 py-2 text-[12.5px] text-warn">
              Confirm the money has arrived in your account before saving. The app records the payment as entered; it doesn&apos;t verify transfers.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={formState.isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="brass" loading={formState.isSubmitting}>
              {mode === "settle" ? "Mark as paid" : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
