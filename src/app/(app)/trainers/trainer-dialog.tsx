"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/input";
import { FormError } from "@/components/app/form-error";
import type { Trainer } from "@/lib/database.types";
import { trainerFormSchema, type TrainerFormValues } from "@/lib/validation";
import { saveTrainer } from "./actions";

export function TrainerDialog({ trainer, today, trigger }: { trainer?: Trainer; today: string; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string>();
  const defaults: TrainerFormValues = {
    full_name: trainer?.full_name ?? "",
    phone: trainer?.phone ?? "",
    email: trainer?.email ?? "",
    specialization: trainer?.specialization ?? "",
    joining_date: trainer?.joining_date ?? today,
    notes: trainer?.notes ?? "",
    is_active: trainer?.is_active ?? true,
  };
  const form = useForm<TrainerFormValues>({ resolver: zodResolver(trainerFormSchema), defaultValues: defaults });
  const { register, handleSubmit, formState, reset, setError } = form;
  const errors = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    try {
      const res = await saveTrainer(trainer?.id ?? null, values);
      if (!res.ok) {
        setServerError(res.error);
        Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => setError(k as keyof TrainerFormValues, { message: m }));
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
      <DialogContent title={trainer ? "Edit trainer" : "Add trainer"} wide>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormError message={serverError} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="tr-name" error={errors.full_name?.message} required className="sm:col-span-2">
              <Input id="tr-name" {...register("full_name")} aria-invalid={Boolean(errors.full_name)} />
            </Field>
            <Field label="Phone" htmlFor="tr-phone" error={errors.phone?.message} required>
              <Input id="tr-phone" inputMode="tel" placeholder="03001234567" {...register("phone")} aria-invalid={Boolean(errors.phone)} />
            </Field>
            <Field label="Email" htmlFor="tr-email" error={errors.email?.message} hint="Optional">
              <Input id="tr-email" type="email" {...register("email")} aria-invalid={Boolean(errors.email)} />
            </Field>
            <Field label="Specialization" htmlFor="tr-spec" error={errors.specialization?.message} hint="Optional — e.g. Strength, CrossFit, Yoga">
              <Input id="tr-spec" {...register("specialization")} />
            </Field>
            <Field label="Joining date" htmlFor="tr-join" error={errors.joining_date?.message} required>
              <Input id="tr-join" type="date" {...register("joining_date")} aria-invalid={Boolean(errors.joining_date)} />
            </Field>
            <Field label="Notes" htmlFor="tr-notes" error={errors.notes?.message} className="sm:col-span-2">
              <Textarea id="tr-notes" rows={2} {...register("notes")} />
            </Field>
          </div>
          <Checkbox label="Currently working at the gym" {...register("is_active")} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={formState.isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={formState.isSubmitting}>
              {trainer ? "Save changes" : "Add trainer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
