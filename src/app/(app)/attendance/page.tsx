import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck2, LogOut } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Pagination, PAGE_SIZE, pageFromParam } from "@/components/app/pagination";
import { DateFilter, SearchBox } from "@/components/app/url-filters";
import { ConfirmAction } from "@/components/app/confirm-action";
import { Panel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getGymSettings, requireGymUser } from "@/lib/auth";
import { addDays, formatDate, formatTime, isIsoDate, todayInTimeZone } from "@/lib/dates";
import { friendlyError } from "@/lib/errors";
import { param, sanitizeSearch } from "@/lib/utils";
import { CheckInPanel } from "./check-in-panel";
import { checkOut, undoCheckIn } from "./actions";

export const metadata: Metadata = { title: "Attendance" };

export default async function AttendancePage({ searchParams }: PageProps<"/attendance">) {
  const sp = await searchParams;
  const ctx = await requireGymUser();
  const settings = await getGymSettings();
  const tz = settings.timezone;
  const today = todayInTimeZone(tz);

  const memberId = z.string().uuid().safeParse(param(sp.member)).success ? param(sp.member) : "";
  const dateParam = param(sp.date);
  const date = isIsoDate(dateParam) ? dateParam : today;
  const q = sanitizeSearch(param(sp.q));
  const page = pageFromParam(param(sp.page));
  const offset = (page - 1) * PAGE_SIZE;

  let memberName = "";
  if (memberId) {
    const { data } = await ctx.supabase.from("members").select("full_name").eq("id", memberId).maybeSingle();
    memberName = data?.full_name ?? "";
  }

  let query = ctx.supabase.from("attendance_overview").select("*", { count: "exact" });
  if (memberId) query = query.eq("member_id", memberId);
  else query = query.eq("attendance_date", date);
  if (q) query = query.or(`member_name.ilike.*${q}*,member_code.ilike.*${q}*,member_phone.ilike.*${q}*`);
  const { data: rows, count, error } = await query
    .order("attendance_date", { ascending: false })
    .order("check_in_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const isToday = !memberId && date === today;
  const heading = memberId
    ? `Visits by ${memberName || "member"}`
    : isToday
      ? "Today"
      : formatDate(date);

  return (
    <>
      <PageHeader title="Attendance" description="One check-in per member per day. Times are shown in the gym's timezone." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div>
          <CheckInPanel isOwner={ctx.isOwner} />
        </div>
        <Panel>
          <div className="flex flex-col gap-3 border-b border-line px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">{heading}</h2>
              <p className="tabular text-[13px] text-ink-soft">
                {count ?? 0} {memberId ? "visits in total" : `check-in${count === 1 ? "" : "s"}`}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {memberId ? (
                <Link href="/attendance" className="text-[13px] text-brass-strong hover:underline">
                  Back to daily view
                </Link>
              ) : (
                <>
                  <div className="flex items-center gap-1 text-[13px]">
                    <Link href={`/attendance?date=${addDays(date, -1)}`} className="rounded px-2 py-1 text-ink-soft hover:bg-canvas">
                      Previous day
                    </Link>
                    {!isToday && (
                      <Link href="/attendance" className="rounded px-2 py-1 text-brass-strong hover:bg-canvas">
                        Today
                      </Link>
                    )}
                  </div>
                  <DateFilter param="date" label="Date" fallback={date} />
                </>
              )}
              <SearchBox placeholder="Filter by member" className="sm:w-52" />
            </div>
          </div>
          {error ? (
            <p className="p-5 text-sm text-bad">{friendlyError(error, "Could not load attendance.")}</p>
          ) : !rows || rows.length === 0 ? (
            <EmptyState
              icon={CalendarCheck2}
              title={isToday ? "No check-ins yet today" : "No attendance found"}
              description={isToday ? "Search for a member on the left to check them in." : "Try another date or clear the filter."}
            />
          ) : (
            <>
              <Table>
                <THead>
                  <tr>
                    <TH>Member</TH>
                    {memberId && <TH>Date</TH>}
                    <TH>Checked in</TH>
                    <TH>Checked out</TH>
                    <TH className="text-right">
                      <span className="sr-only">Actions</span>
                    </TH>
                  </tr>
                </THead>
                <TBody>
                  {rows.map((a) => (
                    <TR key={a.id}>
                      <TD>
                        <Link href={`/members/${a.member_id}`} className="font-medium text-ink hover:underline">
                          {a.member_name}
                        </Link>
                        <p className="tabular text-[12.5px] text-ink-faint">{a.member_code}</p>
                        {a.is_override && (
                          <Badge tone="warn" className="mt-1" title={a.override_reason ?? undefined}>
                            Override: {a.override_reason}
                          </Badge>
                        )}
                      </TD>
                      {memberId && <TD className="tabular text-ink-soft">{formatDate(a.attendance_date)}</TD>}
                      <TD className="tabular text-ink">{formatTime(a.check_in_at, tz)}</TD>
                      <TD className="tabular text-ink-soft">{a.check_out_at ? formatTime(a.check_out_at, tz) : "—"}</TD>
                      <TD>
                        <div className="flex justify-end gap-2">
                          {!a.check_out_at && a.attendance_date === today && (
                            <ConfirmAction
                              trigger={
                                <>
                                  <LogOut /> Check out
                                </>
                              }
                              triggerVariant="outline"
                              title={`Check out ${a.member_name}?`}
                              description="Records the current time as their check-out."
                              confirmLabel="Check out"
                              confirmVariant="primary"
                              successMessage="Checked out"
                              action={checkOut.bind(null, a.id)}
                            />
                          )}
                          {ctx.isOwner && (
                            <ConfirmAction
                              trigger="Remove"
                              triggerVariant="ghost"
                              title="Remove this check-in?"
                              description="Use only to correct a mistaken check-in. The removal and your reason are recorded in the audit log."
                              confirmLabel="Remove check-in"
                              successMessage="Check-in removed"
                              requireReason
                              action={undoCheckIn.bind(null, a.id)}
                            />
                          )}
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <Pagination page={page} total={count ?? 0} basePath="/attendance" params={{ q, date: memberId ? "" : dateParam, member: memberId }} />
            </>
          )}
        </Panel>
      </div>
    </>
  );
}
