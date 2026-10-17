"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getGymUser } from "@/lib/auth";
import { fail, ok, NOT_SIGNED_IN, OWNER_ONLY, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { friendlyError } from "@/lib/errors";
import { normalizePhone } from "@/lib/format";
import { emptyToNull, trainerFormSchema, type TrainerFormValues } from "@/lib/validation";

export async function saveTrainer(id: string | null, input: TrainerFormValues): Promise<ActionResult<{ id: string }>> {
  const ctx = await getGymUser();
  if (!ctx) return fail(NOT_SIGNED_IN);
  if (!ctx.isOwner) return fail(OWNER_ONLY);
  if (id !== null && !z.string().uuid().safeParse(id).success) return fail("Invalid trainer.");
  const parsed = trainerFormSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", { fieldErrors: zodFieldErrors(parsed.error.issues) });
  const v = parsed.data;
  const row = {
    full_name: v.full_name,
    phone: normalizePhone(v.phone),
    email: emptyToNull(v.email),
    specialization: emptyToNull(v.specialization),
    joining_date: v.joining_date,
    notes: emptyToNull(v.notes),
    is_active: v.is_active,
  };
  const { data, error } = id
    ? await ctx.supabase.from("trainers").update(row).eq("id", id).select("id").single()
    : await ctx.supabase.from("trainers").insert(row).select("id").single();
  if (error || !data) return fail(friendlyError(error, "Could not save the trainer."));
  revalidatePath("/trainers");
  revalidatePath(`/trainers/${data.id}`);
  return ok({ id: data.id }, id ? "Trainer updated" : "Trainer added");
}

export async function setTrainerActive(id: string, active: boolean): Promise<ActionResult> {
  const ctx = await getGymUser();
  if (!ctx) return fail(NOT_SIGNED_IN);
  if (!ctx.isOwner) return fail(OWNER_ONLY);
  if (!z.string().uuid().safeParse(id).success) return fail("Invalid trainer.");
  const { data, error } = await ctx.supabase.from("trainers").update({ is_active: active }).eq("id", id).select("id");
  if (error) return fail(friendlyError(error));
  if (!data?.length) return fail("That trainer could not be found.");
  revalidatePath("/trainers");
  revalidatePath(`/trainers/${id}`);
  return ok(undefined, active ? "Trainer activated" : "Trainer deactivated");
}
