import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/app/page-header";
import { requireGymUser } from "@/lib/auth";
import { EditMemberForm } from "../../member-form";

export const metadata: Metadata = { title: "Edit member" };

export default async function EditMemberPage({ params }: PageProps<"/members/[id]/edit">) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const ctx = await requireGymUser();
  const { data: member } = await ctx.supabase.from("members").select("*").eq("id", id).maybeSingle();
  if (!member) notFound();
  return (
    <>
      <PageHeader
        title={`Edit ${member.full_name}`}
        breadcrumbs={[{ label: "Members", href: "/members" }, { label: member.full_name, href: `/members/${id}` }, { label: "Edit" }]}
      />
      <EditMemberForm member={member} />
    </>
  );
}
