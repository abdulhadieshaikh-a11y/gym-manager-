"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getGymUser } from "@/lib/auth";
import { fail, ok, NOT_SIGNED_IN, OWNER_ONLY, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { friendlyError } from "@/lib/errors";
import {
  emptyToNull,
  invoiceFormSchema,
  parseMoney,
  paymentFormSchema,
  reasonSchema,
  type InvoiceFormValues,
  type PaymentFormValues,
} from "@/lib/validation";

const uuid = z.string().uuid();

function revalidateFinance(memberId?: string | null) {
  revalidatePath("/fees");
  revalidatePath("/dashboard");
  revalidatePath("/members");
  if (memberId) revalidatePath(`/members/${memberId}`);
}

export async function recordPayment(input: PaymentFormValues): Promise<ActionResult<{ paymentId: string }>> {
  const ctx = await getGymUser();
  if (!ctx) return fail(NOT_SIGNED_IN);
  const parsed = paymentFormSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", { fieldErrors: zodFieldErrors(parsed.error.issues) });
  const v = parsed.data;

  const { data, error } = await ctx.supabase.rpc("record_payment", {
    p_invoice_id: v.invoice_id,
    p_amount: parseMoney(v.amount),
    p_method: v.method,
    p_payment_date: v.payment_date,
    p_reference: emptyToNull(v.reference),
    p_notes: emptyToNull(v.notes),
    p_idempotency_key: v.idempotency_key,
  });
  if (error || !data) {
    const msg = friendlyError(error, "Could not record the payment.");
    const field = /amount|balance/i.test(msg) ? "amount" : /date/i.test(msg) ? "payment_date" : undefined;
    return fail(msg, field ? { fieldErrors: { [field]: msg } } : undefined);
  }
  const { data: pay } = await ctx.supabase.from("payments").select("member_id").eq("id", data).maybeSingle();
  revalidateFinance(pay?.member_id);
  return ok({ paymentId: data }, "Payment recorded");
}

export async function voidPayment(paymentId: string, reason: string): Promise<ActionResult> {
  const ctx = await getGymUser();
  if (!ctx) return fail(NOT_SIGNED_IN);
  if (!ctx.isOwner) return fail(OWNER_ONLY);
  if (!uuid.safeParse(paymentId).success) return fail("Invalid payment.");
  const r = reasonSchema.safeParse(reason);
  if (!r.success) return fail(r.error.issues[0]?.message ?? "Reason required");
  const { error } = await ctx.supabase.rpc("void_payment", { p_payment_id: paymentId, p_reason: r.data });
  if (error) return fail(friendlyError(error));
  const { data: pay } = await ctx.supabase.from("payments").select("member_id").eq("id", paymentId).maybeSingle();
  revalidateFinance(pay?.member_id);
  return ok(undefined, "Payment voided. The fee balance has been updated.");
}

export async function createInvoice(input: InvoiceFormValues): Promise<ActionResult<{ id: string }>> {
  const ctx = await getGymUser();
  if (!ctx) return fail(NOT_SIGNED_IN);
  const parsed = invoiceFormSchema.safeParse(input);
  if (!parsed.success) return fail("Please fix the highlighted fields.", { fieldErrors: zodFieldErrors(parsed.error.issues) });
  const v = parsed.data;
  const { data, error } = await ctx.supabase.rpc("create_invoice", {
    p_member_id: v.member_id,
    p_description: v.description,
    p_amount: parseMoney(v.amount),
    p_due_date: v.due_date,
  });
  if (error || !data) return fail(friendlyError(error, "Could not create the fee."));
  revalidateFinance(v.member_id);
  return ok({ id: data }, "Fee added");
}

export async function voidInvoice(invoiceId: string, memberId: string, reason: string): Promise<ActionResult> {
  const ctx = await getGymUser();
  if (!ctx) return fail(NOT_SIGNED_IN);
  if (!ctx.isOwner) return fail(OWNER_ONLY);
  if (!uuid.safeParse(invoiceId).success) return fail("Invalid fee record.");
  const r = reasonSchema.safeParse(reason);
  if (!r.success) return fail(r.error.issues[0]?.message ?? "Reason required");
  const { error } = await ctx.supabase.rpc("void_invoice", { p_invoice_id: invoiceId, p_reason: r.data });
  if (error) return fail(friendlyError(error));
  revalidateFinance(memberId);
  return ok(undefined, "Fee voided");
}
