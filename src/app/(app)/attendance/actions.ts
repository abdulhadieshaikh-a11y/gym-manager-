"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getGymUser } from "@/lib/auth";
import { fail, ok, NOT_SIGNED_IN, OWNER_ONLY, type ActionResult } from "@/lib/action-result";
import { errorCode, friendlyError } from "@/lib/errors";
import { reasonSchema } from "@/lib/validation";

const uuid = z.string().uuid();

function revalidateAttendance(memberId?: string) {
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  if (memberId) revalidatePath(`/members/${memberId}`);
}

export async function checkIn(memberId: string, override = false, overrideReason = ""): Promise<ActionResult<{ id: string }>> {
  const ctx = await getGymUser();
  if (!ctx) return fail(NOT_SIGNED_IN);
  if (!uuid.safeParse(memberId).success) return fail("Invalid member.");
  if (override) {
    if (!ctx.isOwner) return fail("Only the owner can check in a member without a valid membership.");
    const r = reasonSchema.safeParse(overrideReason);
    if (!r.success) return fail("Please enter a reason for allowing this check-in.");
  }
  const { data, error } = await ctx.supabase.rpc("check_in_member", {
    p_member_id: memberId,
    p_override: override,
    p_override_reason: override ? overrideReason.trim() : null,
  });
  if (error || !data) {
    return fail(friendlyError(error, "Could not check in."), { code: errorCode(error) ?? undefined });
  }
  revalidateAttendance(memberId);
  return ok({ id: data }, override ? "Checked in (override recorded)" : "Checked in");
}

export async function checkOut(attendanceId: string): Promise<ActionResult> {
  const ctx = await getGymUser();
  if (!ctx) return fail(NOT_SIGNED_IN);
  if (!uuid.safeParse(attendanceId).success) return fail("Invalid attendance record.");
  const { error } = await ctx.supabase.rpc("check_out_attendance", { p_attendance_id: attendanceId });
  if (error) return fail(friendlyError(error));
  revalidateAttendance();
  return ok(undefined, "Checked out");
}

export async function undoCheckIn(attendanceId: string, reason: string): Promise<ActionResult> {
  const ctx = await getGymUser();
  if (!ctx) return fail(NOT_SIGNED_IN);
  if (!ctx.isOwner) return fail(OWNER_ONLY);
  if (!uuid.safeParse(attendanceId).success) return fail("Invalid attendance record.");
  const r = reasonSchema.safeParse(reason);
  if (!r.success) return fail(r.error.issues[0]?.message ?? "Reason required");
  const { error } = await ctx.supabase.rpc("undo_check_in", { p_attendance_id: attendanceId, p_reason: r.data });
  if (error) return fail(friendlyError(error));
  revalidateAttendance();
  return ok(undefined, "Check-in removed");
}

export type CheckInCandidate = {
  id: string;
  full_name: string;
  member_code: string;
  phone: string;
  membership_status: string;
  expiring_soon: boolean;
  valid_until: string | null;
  checked_in_today: boolean;
};

export async function searchMembersForCheckIn(rawQuery: string): Promise<ActionResult<CheckInCandidate[]>> {
  const ctx = await getGymUser();
  if (!ctx) return fail(NOT_SIGNED_IN);
  const q = rawQuery.replace(/[,()*%\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  if (q.length < 2) return ok([]);
  const digits = q.replace(/\D/g, "");
  const { data, error } = await ctx.supabase
    .from("member_overview")
    .select("id, full_name, member_code, phone, membership_status, expiring_soon, valid_until")
    .or(`full_name.ilike.*${q}*,member_code.ilike.*${q}*${digits.length >= 3 ? `,phone.ilike.*${digits}*` : ""}`)
    .order("full_name")
    .limit(8);
  if (error) return fail(friendlyError(error));
  const ids = (data ?? []).map((m) => m.id);
  let checked = new Set<string>();
  if (ids.length) {
    const { data: today } = await ctx.supabase.rpc("gym_today");
    const { data: att } = await ctx.supabase.from("attendance").select("member_id").in("member_id", ids).eq("attendance_date", today ?? "");
    checked = new Set((att ?? []).map((a) => a.member_id));
  }
  return ok((data ?? []).map((m) => ({ ...m, checked_in_today: checked.has(m.id) })));
}
