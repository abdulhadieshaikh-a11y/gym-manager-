"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { friendlyAuthError } from "@/lib/errors";
import { loginSchema, newPasswordSchema } from "@/lib/validation";
import { getSupabaseEnv } from "@/lib/env";

function safeNext(next: unknown): string {
  if (typeof next !== "string") return "/dashboard";
  // Only allow same-site relative paths.
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/dashboard";
  return next;
}

export async function signIn(input: { email: string; password: string; next?: string }): Promise<ActionResult<{ redirectTo: string }>> {
  if (!getSupabaseEnv()) return fail("The app is not configured yet. See the setup guide.");
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the form.", { fieldErrors: zodFieldErrors(parsed.error.issues) });

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return fail(friendlyAuthError(error));
  } catch (e) {
    return fail(friendlyAuthError(e));
  }
  return ok({ redirectTo: safeNext(input.next) });
}

export async function signOut() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Even if the network call fails, continue to the login page.
  }
  redirect("/login");
}

async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function requestPasswordReset(input: { email: string }): Promise<ActionResult> {
  const email = (input.email ?? "").trim();
  const parsed = loginSchema.shape.email.safeParse(email);
  if (!parsed.success) return fail("Enter a valid email address.");
  try {
    const supabase = await createClient();
    const origin = await siteOrigin();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${origin}/auth/confirm?next=/reset-password`,
    });
    // Don't reveal whether an account exists — only surface rate limits / outages.
    if (error && /rate|too many|fetch|network/i.test(error.message)) return fail(friendlyAuthError(error));
  } catch (e) {
    return fail(friendlyAuthError(e));
  }
  return ok(undefined, "If an account exists for that email, a reset link is on its way.");
}

export async function updatePassword(input: { password: string; confirm: string }): Promise<ActionResult> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return fail("Please check the form.", { fieldErrors: zodFieldErrors(parsed.error.issues) });
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims?.sub) return fail("Your reset link has expired. Request a new one.");
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) return fail(friendlyAuthError(error));
  } catch (e) {
    return fail(friendlyAuthError(e));
  }
  return ok(undefined, "Password updated.");
}
