"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { FormError } from "@/components/app/form-error";
import type { GymSettings } from "@/lib/database.types";
import { settingsFormSchema, type SettingsFormValues } from "@/lib/validation";
import { saveSettings } from "./actions";

const COMMON_ZONES = ["Asia/Karachi", "Asia/Dubai", "Asia/Riyadh", "Asia/Kolkata", "Europe/London", "America/New_York"];

export function SettingsForm({ settings, timezones, readOnly }: { settings: GymSettings; timezones: string[]; readOnly: boolean }) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string>();
  const defaults: SettingsFormValues = {
      gym_name: settings.gym_name,
      contact_phone: settings.contact_phone ?? "",
      email: settings.email ?? "",
      address: settings.address ?? "",
      currency: settings.currency,
      timezone: settings.timezone,
      expiry_warning_days: String(settings.expiry_warning_days),
      receipt_footer: settings.receipt_footer ?? "",
  };
  // defaultValue is also set on each input so the server-rendered HTML already
  // shows the saved values before the page becomes interactive.
  const form = useForm<SettingsFormValues>({ resolver: zodResolver(settingsFormSchema), defaultValues: defaults });
  const { register, handleSubmit, formState, setError } = form;
  const errors = formState.errors;
  const zones = Array.from(new Set([...COMMON_ZONES, settings.timezone, ...timezones]));

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    try {
      const res = await saveSettings(values);
      if (!res.ok) {
        setServerError(res.error);
        Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => setError(k as keyof SettingsFormValues, { message: m }));
        return;
      }
      toast.success(res.message ?? "Settings saved");
      router.refresh();
    } catch {
      setServerError("Could not reach the server. Check your connection and try again.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormError message={serverError} />
      <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
        <Field label="Gym name" htmlFor="gym_name" error={errors.gym_name?.message} required className="sm:col-span-2" hint="Shown in the sidebar and on receipts">
          <Input id="gym_name" {...register("gym_name")} defaultValue={defaults.gym_name} aria-invalid={Boolean(errors.gym_name)} />
        </Field>
        <Field label="Contact phone" htmlFor="contact_phone" error={errors.contact_phone?.message}>
          <Input id="contact_phone" inputMode="tel" {...register("contact_phone")} defaultValue={defaults.contact_phone} aria-invalid={Boolean(errors.contact_phone)} />
        </Field>
        <Field label="Email" htmlFor="gym_email" error={errors.email?.message} hint="Optional">
          <Input id="gym_email" type="email" {...register("email")} defaultValue={defaults.email} aria-invalid={Boolean(errors.email)} />
        </Field>
        <Field label="Address" htmlFor="address" error={errors.address?.message} className="sm:col-span-2" hint="Optional — printed on receipts">
          <Textarea id="address" rows={2} {...register("address")} defaultValue={defaults.address} />
        </Field>
        <Field label="Currency" htmlFor="currency" error={errors.currency?.message} hint="3-letter code. Default PKR">
          <Input id="currency" className="uppercase" maxLength={3} {...register("currency")} defaultValue={defaults.currency} aria-invalid={Boolean(errors.currency)} />
        </Field>
        <Field label="Timezone" htmlFor="timezone" error={errors.timezone?.message} hint="Decides when a new gym day starts">
          <NativeSelect id="timezone" {...register("timezone")} defaultValue={defaults.timezone}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="“Expiring soon” warning" htmlFor="expiry_warning_days" error={errors.expiry_warning_days?.message} hint="Days before expiry to flag a membership">
          <Input id="expiry_warning_days" inputMode="numeric" {...register("expiry_warning_days")} defaultValue={defaults.expiry_warning_days} aria-invalid={Boolean(errors.expiry_warning_days)} />
        </Field>
        <Field label="Receipt note" htmlFor="receipt_footer" error={errors.receipt_footer?.message} hint="Optional — e.g. “Fees are non-refundable.”">
          <Input id="receipt_footer" {...register("receipt_footer")} defaultValue={defaults.receipt_footer} />
        </Field>
      </fieldset>
      {!readOnly && (
        <div className="flex justify-end">
          <Button type="submit" loading={formState.isSubmitting}>
            Save settings
          </Button>
        </div>
      )}
    </form>
  );
}
