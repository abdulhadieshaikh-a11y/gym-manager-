import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { GymSettings, Profile } from "@/lib/database.types";
import { DEFAULT_TIMEZONE } from "@/lib/dates";
import { getSupabaseEnv } from "@/lib/env";

export type AuthContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  email: string;
  profile: Profile | null;
};

/** The current user (verified JWT claims) and their gym profile, per request. */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  await cookies(); // per-request data: never pre-render pages that use it
  if (!getSupabaseEnv()) redirect("/setup-required");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", claims.sub).maybeSingle();
  return {
    supabase,
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    profile: profile ?? null,
  };
});

export type GymUserContext = AuthContext & { profile: Profile; isOwner: boolean };

/** For pages: redirects to /login or /no-access when not allowed. */
export async function requireGymUser(): Promise<GymUserContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctx.profile || !ctx.profile.is_active) redirect("/no-access");
  return { ...ctx, profile: ctx.profile, isOwner: ctx.profile.role === "owner" };
}

/** For server actions: returns null instead of redirecting. */
export async function getGymUser(): Promise<GymUserContext | null> {
  const ctx = await getAuthContext();
  if (!ctx || !ctx.profile || !ctx.profile.is_active) return null;
  return { ...ctx, profile: ctx.profile, isOwner: ctx.profile.role === "owner" };
}

const FALLBACK_SETTINGS: GymSettings = {
  id: 1,
  gym_name: "Gym Manager",
  contact_phone: null,
  email: null,
  address: null,
  currency: "PKR",
  timezone: DEFAULT_TIMEZONE,
  expiry_warning_days: 7,
  receipt_footer: null,
  logo_path: null,
  updated_at: new Date(0).toISOString(),
  updated_by: null,
};

export const getGymSettings = cache(async (): Promise<GymSettings> => {
  const ctx = await getAuthContext();
  if (!ctx) return FALLBACK_SETTINGS;
  const { data } = await ctx.supabase.from("gym_settings").select("*").eq("id", 1).maybeSingle();
  return data ?? FALLBACK_SETTINGS;
});

export function logoUrl(settings: GymSettings): string | null {
  if (!settings.logo_path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/storage/v1/object/public/gym-branding/${settings.logo_path}`;
}
