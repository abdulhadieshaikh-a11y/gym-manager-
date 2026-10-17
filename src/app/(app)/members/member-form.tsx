"use client";

import * as React from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/card";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { FormError } from "@/components/app/form-error";
import type { Member, Package } from "@/lib/database.types";
import { computeEndDate, describeDuration, formatDate, isIsoDate } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import {
  memberFormSchema,
  memberUpdateSchema,
  type MemberFormValues,
  type MemberUpdateValues,
} from "@/lib/validation";
import { createMember, updateMember } from "./actions";

function DuplicatePhoneNotice({ message, onConfirm, pending }: { message: string; onConfirm: () => void; pending: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-warn/25 bg-warn-soft p-3 text-[13px] text-warn sm:flex-row sm:items-center sm:justify-between" role="alert">
      <p>{message}</p>
      <Button type="button" size="sm" variant="outline" onClick={onConfirm} loading={pending}>
        Save anyway
      </Button>
    </div>
  );
}

export function NewMemberForm({ packages, today, currency }: { packages: Package[]; today: string; currency: string }) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string>();
  const [dupWarning, setDupWarning] = React.useState<string>();
  const active = packages.filter((p) => p.is_active);

  const defaults: MemberFormValues = {
      member_code: "",
      full_name: "",
      phone: "",
      email: "",
      joining_date: today,
      notes: "",
      package_id: active[0]?.id ?? "",
      start_date: today,
      price: active[0] ? String(active[0].price) : "",
      allow_duplicate_phone: false,
  };
  const form = useForm<MemberFormValues>({ resolver: zodResolver(memberFormSchema), defaultValues: defaults });
  const { register, handleSubmit, formState, setValue, setError } = form;
  const errors = formState.errors;
  const packageId = useWatch({ control: form.control, name: "package_id" });
  const priceValue = useWatch({ control: form.control, name: "price" });
  const pkg = active.find((p) => p.id === packageId);
  const start = useWatch({ control: form.control, name: "start_date" });
  const end = pkg && isIsoDate(start) ? computeEndDate(start, pkg.duration_value, pkg.duration_unit) : null;

  const submit = handleSubmit(async (values) => {
    setServerError(undefined);
    try {
      const res = await createMember(values);
      if (!res.ok) {
        if (res.code === "DUPLICATE_PHONE") return setDupWarning(res.error);
        setServerError(res.error);
        Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => setError(k as keyof MemberFormValues, { message: m }));
        return;
      }
      toast.success(res.message ?? "Member added");
      router.push(`/members/${res.data.id}`);
    } catch {
      setServerError("Could not reach the server. Check your connection and try again.");
    }
  });

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Panel>
        <PanelHeader title="Member details" />
        <PanelBody className="flex flex-col gap-4">
          <FormError message={serverError} />
          {dupWarning && (
            <DuplicatePhoneNotice
              message={dupWarning}
              pending={formState.isSubmitting}
              onConfirm={() => {
                setValue("allow_duplicate_phone", true);
                setDupWarning(undefined);
                void submit();
              }}
            />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="full_name" error={errors.full_name?.message} required className="sm:col-span-2">
              <Input id="full_name" autoComplete="off" {...register("full_name")} defaultValue={defaults.full_name} aria-invalid={Boolean(errors.full_name)} autoFocus />
            </Field>
            <Field label="Phone" htmlFor="phone" error={errors.phone?.message} required>
              <Input
                id="phone"
                inputMode="tel"
                placeholder="03001234567"
                {...register("phone", { onChange: () => setValue("allow_duplicate_phone", false) })}
                defaultValue={defaults.phone}
                aria-invalid={Boolean(errors.phone)}
              />
            </Field>
            <Field label="Email" htmlFor="email" error={errors.email?.message} hint="Optional">
              <Input id="email" type="email" {...register("email")} defaultValue={defaults.email} aria-invalid={Boolean(errors.email)} />
            </Field>
            <Field label="Joining date" htmlFor="joining_date" error={errors.joining_date?.message} required>
              <Input id="joining_date" type="date" {...register("joining_date")} defaultValue={defaults.joining_date} aria-invalid={Boolean(errors.joining_date)} />
            </Field>
            <Field label="Member ID" htmlFor="member_code" error={errors.member_code?.message} hint="Leave blank to generate one (e.g. GM-0001)">
              <Input id="member_code" className="uppercase" {...register("member_code")} defaultValue={defaults.member_code} aria-invalid={Boolean(errors.member_code)} />
            </Field>
            <Field label="Notes" htmlFor="notes" error={errors.notes?.message} className="sm:col-span-2">
              <Textarea id="notes" rows={3} placeholder="Optional — goals, medical notes the trainer should know, etc." {...register("notes")} defaultValue={defaults.notes} />
            </Field>
          </div>
        </PanelBody>
      </Panel>

      <div className="flex flex-col gap-6">
        <Panel>
          <PanelHeader title="Membership" description="Assign a package now or later from the member's profile." />
          <PanelBody className="flex flex-col gap-4">
            <Field label="Package" htmlFor="package_id" error={errors.package_id?.message}>
              <NativeSelect
                id="package_id"
                defaultValue={defaults.package_id}
                {...register("package_id", {
                  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
                    const p = active.find((x) => x.id === e.target.value);
                    setValue("price", p ? String(p.price) : "");
                  },
                })}
              >
                <option value="">No package for now</option>
                {active.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {describeDuration(p.duration_value, p.duration_unit)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {pkg && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start date" htmlFor="start_date" error={errors.start_date?.message} required>
                    <Input id="start_date" type="date" {...register("start_date")} defaultValue={defaults.start_date} aria-invalid={Boolean(errors.start_date)} />
                  </Field>
                  <Field label={`Price (${currency})`} htmlFor="price" error={errors.price?.message} required>
                    <Input id="price" inputMode="decimal" {...register("price")} defaultValue={defaults.price} aria-invalid={Boolean(errors.price)} />
                  </Field>
                </div>
                {end && (
                  <p className="rounded-[var(--radius-md)] bg-brass-soft px-3 py-2.5 text-[13px]">
                    Valid until <span className="font-medium">{formatDate(end)}</span>. A fee of{" "}
                    <span className="font-medium">{formatMoney(Number(priceValue) || 0, currency)}</span> will be added as unpaid — record
                    the payment on the next screen.
                  </p>
                )}
              </>
            )}
            {active.length === 0 && (
              <p className="text-[13px] text-ink-soft">
                No active packages yet.{" "}
                <Link href="/packages" className="text-brass-strong hover:underline">
                  Create one
                </Link>
                .
              </p>
            )}
          </PanelBody>
        </Panel>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={formState.isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={formState.isSubmitting}>
            Add member
          </Button>
        </div>
      </div>
    </form>
  );
}

export function EditMemberForm({ member }: { member: Member }) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string>();
  const [dupWarning, setDupWarning] = React.useState<string>();
  const defaults: MemberUpdateValues = {
      member_code: member.member_code,
      full_name: member.full_name,
      phone: member.phone,
      email: member.email ?? "",
      joining_date: member.joining_date,
      notes: member.notes ?? "",
      allow_duplicate_phone: false,
  };
  const form = useForm<MemberUpdateValues>({ resolver: zodResolver(memberUpdateSchema), defaultValues: defaults });
  const { register, handleSubmit, formState, setValue, setError } = form;
  const errors = formState.errors;

  const submit = handleSubmit(async (values) => {
    setServerError(undefined);
    try {
      const res = await updateMember(member.id, values);
      if (!res.ok) {
        if (res.code === "DUPLICATE_PHONE") return setDupWarning(res.error);
        setServerError(res.error);
        Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => setError(k as keyof MemberUpdateValues, { message: m }));
        return;
      }
      toast.success(res.message ?? "Member updated");
      router.push(`/members/${member.id}`);
      router.refresh();
    } catch {
      setServerError("Could not reach the server. Check your connection and try again.");
    }
  });

  return (
    <form onSubmit={submit} noValidate className="max-w-3xl">
      <Panel>
        <PanelHeader title="Member details" description="Membership and payments are managed from the member's profile." />
        <PanelBody className="flex flex-col gap-4">
          <FormError message={serverError} />
          {dupWarning && (
            <DuplicatePhoneNotice
              message={dupWarning}
              pending={formState.isSubmitting}
              onConfirm={() => {
                setValue("allow_duplicate_phone", true);
                setDupWarning(undefined);
                void submit();
              }}
            />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="full_name" error={errors.full_name?.message} required className="sm:col-span-2">
              <Input id="full_name" {...register("full_name")} defaultValue={defaults.full_name} aria-invalid={Boolean(errors.full_name)} />
            </Field>
            <Field label="Phone" htmlFor="phone" error={errors.phone?.message} required>
              <Input id="phone" inputMode="tel" {...register("phone", { onChange: () => setValue("allow_duplicate_phone", false) })} defaultValue={defaults.phone} aria-invalid={Boolean(errors.phone)} />
            </Field>
            <Field label="Email" htmlFor="email" error={errors.email?.message} hint="Optional">
              <Input id="email" type="email" {...register("email")} defaultValue={defaults.email} aria-invalid={Boolean(errors.email)} />
            </Field>
            <Field label="Joining date" htmlFor="joining_date" error={errors.joining_date?.message} required>
              <Input id="joining_date" type="date" {...register("joining_date")} defaultValue={defaults.joining_date} aria-invalid={Boolean(errors.joining_date)} />
            </Field>
            <Field label="Member ID" htmlFor="member_code" error={errors.member_code?.message} required>
              <Input id="member_code" className="uppercase" {...register("member_code")} defaultValue={defaults.member_code} aria-invalid={Boolean(errors.member_code)} />
            </Field>
            <Field label="Notes" htmlFor="notes" error={errors.notes?.message} className="sm:col-span-2">
              <Textarea id="notes" rows={3} {...register("notes")} defaultValue={defaults.notes} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={formState.isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={formState.isSubmitting}>
              Save changes
            </Button>
          </div>
        </PanelBody>
      </Panel>
    </form>
  );
}
