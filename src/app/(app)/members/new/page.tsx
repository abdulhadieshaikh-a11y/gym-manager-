import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { getGymSettings, requireGymUser } from "@/lib/auth";
import { todayInTimeZone } from "@/lib/dates";
import { NewMemberForm } from "../member-form";

export const metadata: Metadata = { title: "Add member" };

export default async function NewMemberPage() {
  const ctx = await requireGymUser();
  const settings = await getGymSettings();
  const { data: packages } = await ctx.supabase.from("packages").select("*").eq("is_active", true).order("price");
  return (
    <>
      <PageHeader title="Add member" breadcrumbs={[{ label: "Members", href: "/members" }, { label: "Add member" }]} />
      <NewMemberForm packages={packages ?? []} today={todayInTimeZone(settings.timezone)} currency={settings.currency} />
    </>
  );
}
