"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getGymUser } from "@/lib/auth";
import { fail, ok, NOT_SIGNED_IN, OWNER_ONLY, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { friendlyError } from "@/lib/errors";
import { normalizePhone } from "@/lib/format";
import {
  assignMembershipSchema,
  emptyToNull,
  memberFormSchema,
  memberUpdateSchema,
  parseMoney,
  reasonSchema,
  type AssignMembershipValues,
  type MemberFormValues,
  type MemberUpdateValues,
} from "@/lib/validation";

const uuid = z.string().uuid();

function revalidateMemberViews(memberId?: string) {
  revalidatePath("/members");
  revalidatePath("/dashboard");
  revalidatePath("/fees");
  revalidatePath("/attendance");
  if (memberId) revalidatePath(`/members/${memberId}`);
}

type Ctx = NonNullable<Awaited<ReturnType<typeof getGymUser>>>;

/** Returns a warning if another member already uses this phone number. */
async function duplicatePhoneWarning(ctx: Ctx, phone: string, excludeId?: string): Promise<string | null> {
  let q = ctx.supabase.from("members").select("full_name, member_code").eq("phone", phone).limit(3);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q;
  if (!data || data.length === 0) return null;
  const names = data.map((m) => `${m.full_name} (${m.member_code})`).join(", ");
  return `This phone number is already used by ${names}. Family members sometimes share a number — save anyway?`;
}

export async function createMember(input: MemberFormValues): Promise<ActionResult<{ id: string }>> {
  const ctx = await getGymUser();
  if (!ctx) return fail(NOT_SIGNED_IN);

  const parsed = memberFormSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", { fieldErrors: zodFieldErrors(parsed.error.issues) });
  const v = parsed.data;
  const phone = normalizePhone(v.phone);

  if (!v.allow_duplicate_phone) {
    const warning = await duplicatePhoneWarning(ctx, phone);
    if (warning) return fail(warning, { code: "DUPLICATE_PHONE" });
  }
  if (v.package_id && !uuid.safeParse(v.package_id).success) return fail("Choose a valid package.");

  const { data, error } = await ctx.supabase.rpc("create_member", {
    p_full_name: v.full_name,
    p_phone: phone,
    p_email: emptyToNull(v.email),
    p_joining_date: v.joining_date,
    p_notes: emptyToNull(v.notes),
    p_member_code: emptyToNull(v.member_code),
    p_package_id: v.package_id || null,
    p_start_date: v.package_id ? v.start_date : null,
    p_price: v.package_id ? parseMoney(v.price) : null,
  });
  if (error || !data) {
    const msg = friendlyError(error, "Could not save the member.");
    return fail(msg, msg.includes("member ID") ? { fieldErrors: { member_code: msg } } : undefined);
  }
  revalidateMemberViews(data);
  return ok({ id: data }, "Member added");
}

export async function updateMember(id: string, input: MemberUpdateValues): Promise<ActionResult<{ id: string }>> {
  const ctx = await getGymUser();
  if (!ctx) return fail(NOT_SIGNED_IN);
  if (!uuid.safeParse(id).success) return fail("Invalid member.");

  const parsed = memberUpdateSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", { fieldErrors: zodFieldErrors(parsed.error.issues) });
  const v = parsed.data;
  const phone = normalizePhone(v.phone);

  if (!v.allow_duplicate_phone) {
    const warning = await duplicatePhoneWarning(ctx, phone, id);
    if (warning) return fail(warning, { code: "DUPLICATE_PHONE" });
  }

  const { data, error } = await ctx.supabase
    .from("members")
    .update({
      member_code: v.member_code.toUpperCase(),
      full_name: v.full_name,
      phone,
      email: emptyToNull(v.email),
      joining_date: v.joining_date,
      notes: emptyToNull(v.notes),
    })
    .eq("id", id)
    .select("id");
  if (error) {
    const msg = friendlyError(error, "Could not save the member.");
    return fail(msg, msg.includes("member ID") ? { fieldErrors: { member_code: msg } } : undefined);
  }
  if (!data || data.length === 0) return fail("That member could not be found.");
  revalidateMemberViews(id);
  return ok({ id }, "Member updated");
}

export async function setMemberActive(id: string, active: boolean, reason: string): Promise<ActionResult> {
  const ctx = await getGymUser();
  if (!ctx) return fail(NOT_SIGNED_IN);
  if (!ctx.isOwner) return fail(OWNER_ONLY);
  if (!uuid.safeParse(id).success) return fail("Invalid member.");
  if (!active) {
    const r = reasonSchema.safeParse(reason);
    if (!r.success) return fail(r.error.issues[0]?.message ?? "Reason required");
  }
  const { error } = await ctx.supabase.rpc("set_member_active", {
    p_member_id: id,
    p_active: active,
    p_reason: active ? null : reason.trim(),
  });
  if (error) return fail(friendlyError(error));
  revalidateMemberViews(id);
  return ok(undefined, active ? "Member reactivated" : "Member deactivated");
}

export async function deleteMember(id: string): Promise<ActionResult> {
  const ctx = await getGymUser();
  if (!ctx) return fail(NOT_SIGNED_IN);
  if (!ctx.isOwner) return fail(OWNER_ONLY);
  if (!uuid.safeParse(id).success) return fail("Invalid member.");
  const { error } = await ctx.supabase.rpc("delete_member", { p_member_id: id });
  if (error) return fail(friendlyError(error));
  revalidateMemberViews();
  return ok(undefined, "Member deleted");
}

export async function assignMembership(input: AssignMembershipValues): Promise<ActionResult<{ id: string }>> {
  const ctx = await getGymUser();
  if (!ctx) return fail(NOT_SIGNED_IN);
  const parsed = assignMembershipSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", { fieldErrors: zodFieldErrors(parsed.error.issues) });
  const v = parsed.data;
  const { data, error } = await ctx.supabase.rpc("assign_membership", {
    p_member_id: v.member_id,
    p_package_id: v.package_id,
    p_start_date: v.start_date,
    p_price: parseMoney(v.price),
    p_notes: emptyToNull(v.notes),
  });
  if (error || !data) return fail(friendlyError(error, "Could not save the membership."));
  revalidateMemberViews(v.member_id);
  return ok({ id: data }, "Membership saved");
}

export async function cancelMembership(membershipId: string, memberId: string, reason: string): Promise<ActionResult> {
  const ctx = await getGymUser();
  if (!ctx) return fail(NOT_SIGNED_IN);
  if (!ctx.isOwner) return fail(OWNER_ONLY);
  if (!uuid.safeParse(membershipId).success) return fail("Invalid membership.");
  const r = reasonSchema.safeParse(reason);
  if (!r.success) return fail(r.error.issues[0]?.message ?? "Reason required");
  const { error } = await ctx.supabase.rpc("cancel_membership", { p_membership_id: membershipId, p_reason: r.data });
  if (error) return fail(friendlyError(error));
  revalidateMemberViews(memberId);
  return ok(undefined, "Membership cancelled");
}
