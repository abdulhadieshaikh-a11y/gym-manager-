"use server";

import { revalidatePath } from "next/cache";
import { getGymUser } from "@/lib/auth";
import { fail, ok, NOT_SIGNED_IN, OWNER_ONLY, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { friendlyError } from "@/lib/errors";
import { emptyToNull, packageFormSchema, parseMoney, type PackageFormValues } from "@/lib/validation";
import { z } from "zod";

export async function savePackage(id: string | null, input: PackageFormValues): Promise<ActionResult<{ id: string }>> {
  const ctx = await getGymUser();
  if (!ctx) return fail(NOT_SIGNED_IN);
  if (!ctx.isOwner) return fail(OWNER_ONLY);
  if (id !== null && !z.string().uuid().safeParse(id).success) return fail("Invalid package.");

  const parsed = packageFormSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", { fieldErrors: zodFieldErrors(parsed.error.issues) });
  const v = parsed.data;
  const row = {
    name: v.name,
    duration_value: Number(v.duration_value),
    duration_unit: v.duration_unit,
    price: parseMoney(v.price),
    description: emptyToNull(v.description),
    is_active: v.is_active,
  };

  const query = id
    ? ctx.supabase.from("packages").update(row).eq("id", id).select("id").single()
    : ctx.supabase.from("packages").insert(row).select("id").single();
  const { data, error } = await query;
  if (error || !data) {
    const msg = friendlyError(error);
    return fail(msg, msg.includes("name already exists") ? { fieldErrors: { name: msg } } : undefined);
  }
  revalidatePath("/packages");
  revalidatePath("/members", "layout");
  return ok({ id: data.id }, id ? "Package updated" : "Package created");
}

export async function setPackageActive(id: string, active: boolean): Promise<ActionResult> {
  const ctx = await getGymUser();
  if (!ctx) return fail(NOT_SIGNED_IN);
  if (!ctx.isOwner) return fail(OWNER_ONLY);
  if (!z.string().uuid().safeParse(id).success) return fail("Invalid package.");
  const { data, error } = await ctx.supabase.from("packages").update({ is_active: active }).eq("id", id).select("id");
  if (error) return fail(friendlyError(error));
  if (!data || data.length === 0) return fail("That package could not be found.");
  revalidatePath("/packages");
  return ok(undefined, active ? "Package activated" : "Package deactivated");
}
