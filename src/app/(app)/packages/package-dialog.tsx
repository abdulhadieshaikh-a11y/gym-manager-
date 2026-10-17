"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox, Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { FormError } from "@/components/app/form-error";
import type { Package } from "@/lib/database.types";
import { packageFormSchema, type PackageFormValues } from "@/lib/validation";
import { savePackage } from "./actions";

export function PackageDialog({ pkg, trigger }: { pkg?: Package; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string>();

  const defaults: PackageFormValues = {
    name: pkg?.name ?? "",
    duration_value: String(pkg?.duration_value ?? 1),
    duration_unit: pkg?.duration_unit ?? "months",
    price: pkg ? String(pkg.price) : "",
    description: pkg?.description ?? "",
    is_active: pkg?.is_active ?? true,
  };

  const form = useForm<PackageFormValues>({ resolver: zodResolver(packageFormSchema), defaultValues: defaults });
  const { register, handleSubmit, formState, reset, setError } = form;
  const errors = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    try {
      const res = await savePackage(pkg?.id ?? null, values);
      if (!res.ok) {
        setServerError(res.error);
        Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => setError(k as keyof PackageFormValues, { message: m }));
        return;
      }
      toast.success(res.message);
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
      <DialogContent
        title={pkg ? "Edit package" : "New package"}
        description={pkg ? "Changes apply to new memberships only. Existing members keep the price they agreed." : "Packages are the plans you sell, such as Monthly or Annual."}
      >
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormError message={serverError} />
          <Field label="Package name" htmlFor="pkg-name" error={errors.name?.message} required>
            <Input id="pkg-name" placeholder="e.g. Monthly" {...register("name")} aria-invalid={Boolean(errors.name)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Duration" htmlFor="pkg-duration" error={errors.duration_value?.message} required>
              <Input id="pkg-duration" inputMode="numeric" {...register("duration_value")} aria-invalid={Boolean(errors.duration_value)} />
            </Field>
            <Field label="Unit" htmlFor="pkg-unit" error={errors.duration_unit?.message}>
              <NativeSelect id="pkg-unit" {...register("duration_unit")}>
                <option value="months">Months</option>
                <option value="days">Days</option>
              </NativeSelect>
            </Field>
          </div>
          <Field label="Price (PKR)" htmlFor="pkg-price" error={errors.price?.message} required>
            <Input id="pkg-price" inputMode="decimal" placeholder="e.g. 3000" {...register("price")} aria-invalid={Boolean(errors.price)} />
          </Field>
          <Field label="Description" htmlFor="pkg-desc" error={errors.description?.message}>
            <Textarea id="pkg-desc" rows={2} placeholder="Optional — what's included" {...register("description")} />
          </Field>
          <Checkbox label="Available for new memberships" {...register("is_active")} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={formState.isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={formState.isSubmitting}>
              {pkg ? "Save changes" : "Create package"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
