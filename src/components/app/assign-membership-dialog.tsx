"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { FormError } from "@/components/app/form-error";
import type { Package } from "@/lib/database.types";
import { computeEndDate, describeDuration, diffDays, formatDate, isIsoDate } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { assignMembershipSchema, type AssignMembershipValues } from "@/lib/validation";
import { assignMembership } from "@/app/(app)/members/actions";

export function AssignMembershipDialog({
  memberId,
  memberName,
  packages,
  defaultStart,
  currency,
  trigger,
  title = "Assign package",
}: {
  memberId: string;
  memberName: string;
  packages: Package[];
  defaultStart: string;
  currency: string;
  trigger: React.ReactNode;
  title?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string>();
  const active = packages.filter((p) => p.is_active);

  const defaults: AssignMembershipValues = {
    member_id: memberId,
    package_id: active[0]?.id ?? "",
    start_date: defaultStart,
    price: active[0] ? String(active[0].price) : "",
    notes: "",
  };
  const form = useForm<AssignMembershipValues>({ resolver: zodResolver(assignMembershipSchema), defaultValues: defaults });
  const { register, handleSubmit, formState, reset, setValue, setError } = form;
  const errors = formState.errors;
  const packageId = useWatch({ control: form.control, name: "package_id" });
  const pkg = active.find((p) => p.id === packageId);
  const start = useWatch({ control: form.control, name: "start_date" });
  const end = pkg && isIsoDate(start) ? computeEndDate(start, pkg.duration_value, pkg.duration_unit) : null;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    try {
      const res = await assignMembership(values);
      if (!res.ok) {
        setServerError(res.error);
        Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => setError(k as keyof AssignMembershipValues, { message: m }));
        return;
      }
      toast.success(res.message ?? "Membership saved", { description: "A fee record was created for the agreed price." });
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
      <DialogContent title={title} description={memberName}>
        {active.length === 0 ? (
          <p className="text-sm text-ink-soft">There are no active packages. Create or activate a package on the Packages page first.</p>
        ) : (
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <FormError message={serverError} />
            <Field label="Package" htmlFor="ms-package" error={errors.package_id?.message} required>
              <NativeSelect
                id="ms-package"
                {...register("package_id", {
                  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
                    const p = active.find((x) => x.id === e.target.value);
                    if (p) setValue("price", String(p.price), { shouldValidate: true });
                  },
                })}
              >
                {active.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {describeDuration(p.duration_value, p.duration_unit)} — {formatMoney(p.price, currency)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Start date" htmlFor="ms-start" error={errors.start_date?.message} required>
                <Input id="ms-start" type="date" {...register("start_date")} aria-invalid={Boolean(errors.start_date)} />
              </Field>
              <Field label={`Agreed price (${currency})`} htmlFor="ms-price" error={errors.price?.message} required hint="Change it for a discount">
                <Input id="ms-price" inputMode="decimal" {...register("price")} aria-invalid={Boolean(errors.price)} />
              </Field>
            </div>
            {end && (
              <div className="rounded-[var(--radius-md)] bg-brass-soft px-3 py-2.5 text-[13px] text-ink">
                Valid <span className="font-medium">{formatDate(start)}</span> to <span className="font-medium">{formatDate(end)}</span>{" "}
                <span className="text-ink-soft">({diffDays(start, end) + 1} days)</span>
              </div>
            )}
            <Field label="Notes" htmlFor="ms-notes" error={errors.notes?.message}>
              <Textarea id="ms-notes" rows={2} {...register("notes")} placeholder="Optional" />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={formState.isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" loading={formState.isSubmitting}>
                Save membership
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
