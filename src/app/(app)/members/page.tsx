import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { MembershipStatusBadge } from "@/components/app/status-badges";
import { Pagination, PAGE_SIZE, pageFromParam } from "@/components/app/pagination";
import { SearchBox, SelectFilter } from "@/components/app/url-filters";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getGymSettings, requireGymUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { friendlyError } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import { param, sanitizeSearch } from "@/lib/utils";
import type { MembershipStatus } from "@/lib/database.types";

export const metadata: Metadata = { title: "Members" };

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "expiring", label: "Expiring soon" },
  { value: "expired", label: "Expired" },
  { value: "no_membership", label: "No package" },
  { value: "upcoming", label: "Starts soon" },
  { value: "inactive", label: "Inactive" },
  { value: "dues", label: "Has unpaid fees" },
];

const MEMBERSHIP_STATUSES: MembershipStatus[] = ["active", "expired", "inactive", "upcoming", "no_membership"];
function isMembershipStatus(v: string): v is MembershipStatus {
  return (MEMBERSHIP_STATUSES as string[]).includes(v);
}

export default async function MembersPage({ searchParams }: PageProps<"/members">) {
  const sp = await searchParams;
  const q = sanitizeSearch(param(sp.q));
  const status = param(sp.status);
  const page = pageFromParam(param(sp.page));

  const ctx = await requireGymUser();
  const settings = await getGymSettings();

  let query = ctx.supabase.from("member_overview").select("*", { count: "exact" });
  if (q) query = query.or(`full_name.ilike.*${q}*,member_code.ilike.*${q}*,phone.ilike.*${q.replace(/\D/g, "") || q}*`);
  if (status === "expiring") query = query.eq("expiring_soon", true);
  else if (status === "dues") query = query.gt("outstanding_balance", 0);
  else if (isMembershipStatus(status)) query = query.eq("membership_status", status);

  const from = (page - 1) * PAGE_SIZE;
  const { data: members, count, error } = await query.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);

  const filtered = Boolean(q || status);

  return (
    <>
      <PageHeader
        title="Members"
        description="Search by name, member ID or phone number."
        actions={
          <Button asChild>
            <Link href="/members/new">
              <Plus /> Add member
            </Link>
          </Button>
        }
      />
      <Panel>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
          <SearchBox placeholder="Search members" />
          <SelectFilter param="status" label="All statuses" options={STATUS_OPTIONS} />
        </div>
        {error ? (
          <p className="p-5 text-sm text-bad">{friendlyError(error, "Could not load members.")}</p>
        ) : !members || members.length === 0 ? (
          filtered ? (
            <EmptyState icon={Users} title="No matching members" description="Try a different search or clear the status filter." />
          ) : (
            <EmptyState
              icon={Users}
              title="No members yet"
              description="Add your first member to start tracking memberships, fees and attendance."
              action={
                <Button asChild>
                  <Link href="/members/new">
                    <Plus /> Add member
                  </Link>
                </Button>
              }
            />
          )
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>Member</TH>
                  <TH>Phone</TH>
                  <TH>Package</TH>
                  <TH>Valid until</TH>
                  <TH className="text-right">Balance due</TH>
                  <TH>Status</TH>
                </tr>
              </THead>
              <TBody>
                {members.map((m) => (
                  <TR key={m.id} className="relative cursor-pointer">
                    <TD>
                      <Link href={`/members/${m.id}`} className="block after:absolute after:inset-0" prefetch={false}>
                        <span className="block font-medium text-ink">{m.full_name}</span>
                        <span className="tabular block text-[12.5px] text-ink-faint">{m.member_code}</span>
                      </Link>
                    </TD>
                    <TD className="tabular text-ink-soft">{m.phone}</TD>
                    <TD className="text-ink-soft">{m.current_package_name ?? "—"}</TD>
                    <TD>
                      <span className="tabular block text-ink">{formatDate(m.valid_until)}</span>
                      {m.days_remaining !== null && m.membership_status === "active" && (
                        <span className="text-[12.5px] text-ink-faint">
                          {m.days_remaining === 0 ? "Last day today" : `${m.days_remaining} days left`}
                        </span>
                      )}
                    </TD>
                    <TD className={`tabular text-right ${m.outstanding_balance > 0 ? "font-medium text-bad" : "text-ink-faint"}`}>
                      {m.outstanding_balance > 0 ? formatMoney(m.outstanding_balance, settings.currency) : "—"}
                    </TD>
                    <TD>
                      <MembershipStatusBadge status={m.membership_status} expiringSoon={m.expiring_soon} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={page} total={count ?? 0} basePath="/members" params={{ q, status }} />
          </>
        )}
      </Panel>
    </>
  );
}
