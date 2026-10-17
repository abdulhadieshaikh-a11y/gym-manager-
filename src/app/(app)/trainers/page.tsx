import type { Metadata } from "next";
import Link from "next/link";
import { Dumbbell, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { ActiveBadge } from "@/components/app/status-badges";
import { Pagination, PAGE_SIZE, pageFromParam } from "@/components/app/pagination";
import { SearchBox, SelectFilter } from "@/components/app/url-filters";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getGymSettings, requireGymUser } from "@/lib/auth";
import { formatDate, todayInTimeZone } from "@/lib/dates";
import { friendlyError } from "@/lib/errors";
import { param, sanitizeSearch } from "@/lib/utils";
import { TrainerDialog } from "./trainer-dialog";

export const metadata: Metadata = { title: "Trainers" };

export default async function TrainersPage({ searchParams }: PageProps<"/trainers">) {
  const sp = await searchParams;
  const q = sanitizeSearch(param(sp.q));
  const status = param(sp.status);
  const page = pageFromParam(param(sp.page));
  const ctx = await requireGymUser();
  const settings = await getGymSettings();
  const today = todayInTimeZone(settings.timezone);

  let query = ctx.supabase.from("trainers").select("*", { count: "exact" });
  if (q) query = query.or(`full_name.ilike.*${q}*,phone.ilike.*${q}*,trainer_code.ilike.*${q}*,specialization.ilike.*${q}*`);
  if (status === "active") query = query.eq("is_active", true);
  if (status === "inactive") query = query.eq("is_active", false);
  const offset = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.order("is_active", { ascending: false }).order("full_name").range(offset, offset + PAGE_SIZE - 1);

  const addButton = ctx.isOwner ? (
    <TrainerDialog
      today={today}
      trigger={
        <Button>
          <Plus /> Add trainer
        </Button>
      }
    />
  ) : null;

  return (
    <>
      <PageHeader title="Trainers" description="Your coaching staff and their contact details." actions={addButton} />
      <Panel>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
          <SearchBox placeholder="Search by name or phone" />
          <SelectFilter
            param="status"
            label="All trainers"
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
        </div>
        {error ? (
          <p className="p-5 text-sm text-bad">{friendlyError(error, "Could not load trainers.")}</p>
        ) : !data || data.length === 0 ? (
          q || status ? (
            <EmptyState icon={Dumbbell} title="No matching trainers" description="Try a different search or filter." />
          ) : (
            <EmptyState icon={Dumbbell} title="No trainers yet" description="Add the trainers who work at your gym." action={addButton} />
          )
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>Trainer</TH>
                  <TH>Phone</TH>
                  <TH>Specialization</TH>
                  <TH>Joined</TH>
                  <TH>Status</TH>
                </tr>
              </THead>
              <TBody>
                {data.map((t) => (
                  <TR key={t.id} className="relative">
                    <TD>
                      <Link href={`/trainers/${t.id}`} className="block after:absolute after:inset-0">
                        <span className="block font-medium text-ink">{t.full_name}</span>
                        <span className="tabular block text-[12.5px] text-ink-faint">{t.trainer_code}</span>
                      </Link>
                    </TD>
                    <TD className="tabular text-ink-soft">{t.phone}</TD>
                    <TD className="text-ink-soft">{t.specialization ?? "—"}</TD>
                    <TD className="tabular text-ink-soft">{formatDate(t.joining_date)}</TD>
                    <TD>
                      <ActiveBadge active={t.is_active} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={page} total={count ?? 0} basePath="/trainers" params={{ q, status }} />
          </>
        )}
      </Panel>
    </>
  );
}
