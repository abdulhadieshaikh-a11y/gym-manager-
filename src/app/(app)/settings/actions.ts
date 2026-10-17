"use server";

import { revalidatePath } from "next/cache";
import { getGymUser } from "@/lib/auth";
import { fail, ok, NOT_SIGNED_IN, OWNER_ONLY, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { friendlyError } from "@/lib/errors";
import { normalizePhone } from "@/lib/format";
import { emptyToNull, settingsFormSchema, type SettingsFormValues } from "@/lib/validation";

export async function saveSettings(input: SettingsFormValues): Promise<ActionResult> {
  const ctx = await getGymUser();
  if (!ctx) return fail(NOT_SIGNED_IN);
  if (!ctx.isOwner) return fail(OWNER_ONLY);
  const parsed = settingsFormSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", { fieldErrors: zodFieldErrors(parsed.error.issues) });
  const v = parsed.data;
  try {
    new Intl.DateTimeFormat("en", { timeZone: v.timezone });
  } catch {
    return fail("That timezone is not valid.", { fieldErrors: { timezone: "Choose a timezone from the list" } });
  }
  const { data, error } = await ctx.supabase
    .from("gym_settings")
    .update({
      gym_name: v.gym_name,
      contact_phone: v.contact_phone ? normalizePhone(v.contact_phone) : null,
      email: emptyToNull(v.email),
      address: emptyToNull(v.address),
      currency: v.currency.toUpperCase(),
      timezone: v.timezone,
      expiry_warning_days: Number(v.expiry_warning_days),
      receipt_footer: emptyToNull(v.receipt_footer),
      updated_by: ctx.userId,
    })
    .eq("id", 1)
    .select("id");
  if (error) return fail(friendlyError(error, "Could not save settings."));
  if (!data?.length) return fail("Settings could not be saved. Make sure the database migrations have been applied.");
  revalidatePath("/", "layout");
  return ok(undefined, "Settings saved");
}

const LOGO_PATH_RE = /^logo-\d{10,}\.(png|jpg|jpeg|webp)$/;

export async function setLogoPath(path: string | null): Promise<ActionResult> {
  const ctx = await getGymUser();
  if (!ctx) return fail(NOT_SIGNED_IN);
  if (!ctx.isOwner) return fail(OWNER_ONLY);
  if (path !== null && !LOGO_PATH_RE.test(path)) return fail("Invalid logo file.");
  const { error } = await ctx.supabase.from("gym_settings").update({ logo_path: path, updated_by: ctx.userId }).eq("id", 1);
  if (error) return fail(friendlyError(error, "Could not save the logo."));
  revalidatePath("/", "layout");
  return ok(undefined, path ? "Logo updated" : "Logo removed");
}
