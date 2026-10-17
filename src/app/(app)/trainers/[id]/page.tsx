import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Pencil } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ActiveBadge } from "@/components/app/status-badges";
import { ConfirmAction } from "@/components/app/confirm-action";
import { Panel, PanelHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getGymSettings, requireGymUser } from "@/lib/auth";
import { formatDate, formatDateTime, todayInTimeZone } from "@/lib/dates";
import { TrainerDialog } from "../trainer-dialog";
import { setTrainerActive } from "../actions";

export const metadata: Metadata = { title: "Trainer" };

export default async function TrainerProfilePage({ params }: PageProps<"/trainers/[id]">) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const ctx = await requireGymUser();
  const settings = await getGymSettings();
  const { data: t } = await ctx.supabase.from("trainers").select("*").eq("id", id).maybeSingle();
  if (!t) notFound();

  const facts: [string, React.ReactNode][] = [
    ["Trainer ID", <span key="c" className="tabular">{t.trainer_code}</span>],
    ["Phone", <a key="p" href={`tel:${t.phone}`} className="tabular hover:underline">{t.phone}</a>],
    ["Email", t.email ? <a key="e" href={`mailto:${t.email}`} className="hover:underline">{t.email}</a> : "—"],
    ["Specialization", t.specialization ?? "—"],
    ["Joined", formatDate(t.joining_date)],
    ["Last updated", formatDateTime(t.updated_at, settings.timezone)],
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Trainers", href: "/trainers" }, { label: t.full_name }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {t.full_name} <ActiveBadge active={t.is_active} />
          </span>
        }
        actions={
          ctx.isOwner && (
            <>
              <TrainerDialog
                trainer={t}
                today={todayInTimeZone(settings.timezone)}
                trigger={
                  <Button variant="outline">
                    <Pencil /> Edit
                  </Button>
                }
              />
              <ConfirmAction
                trigger={t.is_active ? "Deactivate" : "Activate"}
                triggerSize="md"
                title={t.is_active ? `Deactivate ${t.full_name}?` : `Activate ${t.full_name}?`}
                description={t.is_active ? "Use this when a trainer leaves. Their details are kept." : "Marks the trainer as working at the gym again."}
                confirmLabel={t.is_active ? "Deactivate" : "Activate"}
                confirmVariant={t.is_active ? "danger" : "primary"}
                successMessage={t.is_active ? "Trainer deactivated" : "Trainer activated"}
                action={setTrainerActive.bind(null, t.id, !t.is_active)}
              />
            </>
          )
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader title="Details" />
          <dl className="grid gap-4 p-5 sm:grid-cols-2">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt className="text-[12.5px] text-ink-faint">{label}</dt>
                <dd className="mt-0.5 text-sm text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel>
          <PanelHeader title="Notes" />
          <p className="p-5 text-sm whitespace-pre-wrap text-ink-soft">{t.notes || "No notes."}</p>
        </Panel>
      </div>
    </>
  );
}
