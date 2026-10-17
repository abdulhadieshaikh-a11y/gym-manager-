import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck2, Plus, Receipt, TrendingUp, UserPlus, Users, Wallet } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { InvoiceStatusBadge } from "@/components/app/status-badges";
import { Panel, PanelHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getGymSettings, requireGymUser } from "@/lib/auth";
import { formatDate, formatMonth, formatTime } from "@/lib/dates";
import { friendlyError } from "@/lib/errors";
import { formatMoney, formatNumber, paymentMethodLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AttendanceChart, CollectionsChart, GrowthChart } from "./charts";

export const metadata: Metadata = { title: "Dashboard" };

type Summary = {
  today: string;
  month_start: string;
  total_members: number;
  active_members: number;
  inactive_members: number;
  expired_members: number;
  no_membership_members: number;
  expiring_soon: number;
  attendance_today: number;
  fees_today: number;
  fees_month: number;
  outstanding_total: number;
  overdue_total: number;
  open_invoices: number;
};

type Trends = {
  collections: { month: string; total: number }[];
  member_growth: { month: string; new_members: number; total_members: number }[];
  attendance: { date: string; count: number }[];
};

function Metric({
  label,
  value,
  sub,
  href,
  tone,
  large,
}: {
  label: string;
  value: string;
  sub?: string;
  href: string;
  tone?: "bad" | "warn" | "good";
  large?: boolean;
}) {
  return (
    <Link href={href} className="group block bg-surface px-5 py-4 transition-colors hover:bg-canvas/60">
      <p className="text-[12.5px] text-ink-soft group-hover:text-ink">{label}</p>
      <p
        className={cn(
          "tabular mt-1 font-display font-bold tracking-tight",
          large ? "text-[28px]" : "text-[22px]",
          tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : tone === "good" ? "text-good" : "text-ink",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[12.5px] text-ink-faint">{sub}</p>}
    </Link>
  );
}

function ListPanel({ title, href, linkLabel, children }: { title: string; href: string; linkLabel: string; children: React.ReactNode }) {
  return (
    <Panel className="flex flex-col">
      <PanelHeader
        title={title}
        action={
          <Link href={href} className="text-[13px] text-brass-strong hover:underline">
            {linkLabel}
          </Link>
        }
      />
      <div className="flex-1">{children}</div>
    </Panel>
  );
}

function Row({ href, primary, secondary, right, rightSub }: { href: string; primary: string; secondary: string; right: React.ReactNode; rightSub?: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-canvas/60">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink">{primary}</span>
          <span className="tabular block truncate text-[12.5px] text-ink-faint">{secondary}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="tabular block text-sm text-ink">{right}</span>
          {rightSub && <span className="block text-[12px] text-ink-faint">{rightSub}</span>}
        </span>
      </Link>
    </li>
  );
}

export default async function DashboardPage() {
  const ctx = await requireGymUser();
  const settings = await getGymSettings();
  const cur = settings.currency;
  const tz = settings.timezone;

  const [summaryRes, trendsRes, recentMembers, expiring, unpaid, recentAttendance, recentPayments] = await Promise.all([
    ctx.supabase.rpc("dashboard_summary"),
    ctx.supabase.rpc("dashboard_trends", { p_months: 12, p_days: 30 }),
    ctx.supabase.from("members").select("id, full_name, member_code, joining_date, created_at").order("created_at", { ascending: false }).limit(5),
    ctx.supabase
      .from("member_overview")
      .select("id, full_name, member_code, valid_until, days_remaining, current_package_name")
      .eq("expiring_soon", true)
      .order("valid_until")
      .limit(6),
    ctx.supabase
      .from("invoice_overview")
      .select("id, member_id, member_name, member_code, balance, due_date, status, is_overdue")
      .in("status", ["unpaid", "partially_paid"])
      .order("due_date")
      .limit(6),
    ctx.supabase.from("attendance_overview").select("id, member_id, member_name, member_code, check_in_at, attendance_date").order("check_in_at", { ascending: false }).limit(6),
    ctx.supabase
      .from("payment_overview")
      .select("id, member_name, member_code, amount, method, payment_date, receipt_no, is_void")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  if (summaryRes.error || !summaryRes.data) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Panel className="p-6 text-sm text-bad">
          {friendlyError(summaryRes.error, "Could not load the dashboard.")} If this is a new installation, make sure all database migrations have been applied.
        </Panel>
      </>
    );
  }

  const s = summaryRes.data as unknown as Summary;
  const t = (trendsRes.data ?? { collections: [], member_growth: [], attendance: [] }) as unknown as Trends;
  const collections = t.collections.map((c) => ({ label: formatMonth(c.month), total: Number(c.total) }));
  const growth = t.member_growth.map((g) => ({ label: formatMonth(g.month), total: Number(g.total_members), added: Number(g.new_members) }));
  const attendance = t.attendance.map((a) => ({ label: formatDate(a.date).slice(0, 6), count: Number(a.count) }));
  const hasCollections = collections.some((c) => c.total > 0);
  const hasMembers = s.total_members > 0;
  const hasAttendance = attendance.some((a) => a.count > 0);

  return (
    <>
      <PageHeader
        title={settings.gym_name}
        description={`${formatDate(s.today)} — figures use the gym's local day (${tz.replace(/_/g, " ")}). “This month” runs from ${formatDate(s.month_start)} to today.`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/attendance">
                <CalendarCheck2 /> Check in
              </Link>
            </Button>
            <Button asChild>
              <Link href="/members/new">
                <Plus /> Add member
              </Link>
            </Button>
          </>
        }
      />

      {!hasMembers && (
        <Panel className="mb-6 border-l-4 border-brass px-5 py-4 text-sm">
          <p className="font-medium text-ink">Getting started</p>
          <p className="mt-1 text-ink-soft">
            1. Add your gym name in <Link href="/settings" className="text-brass-strong hover:underline">Settings</Link>. 2. Create your{" "}
            <Link href="/packages" className="text-brass-strong hover:underline">packages</Link>. 3.{" "}
            <Link href="/members/new" className="text-brass-strong hover:underline">Add members</Link> and record their fees.
          </p>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3 text-[13px] font-medium text-ink-soft">
            <Wallet className="size-4 text-brass" aria-hidden /> Fees
          </div>
          <div className="grid grid-cols-2 gap-px bg-line">
            <Metric label="Collected today" value={formatMoney(s.fees_today, cur)} href="/fees?view=payments" large />
            <Metric label="Collected this month" value={formatMoney(s.fees_month, cur)} href={`/fees?view=payments&from=${s.month_start}`} large tone={s.fees_month > 0 ? "good" : undefined} />
            <Metric
              label="Outstanding fees"
              value={formatMoney(s.outstanding_total, cur)}
              sub={`${s.open_invoices} unpaid or partly paid`}
              href="/fees"
              tone={s.outstanding_total > 0 ? "warn" : undefined}
            />
            <Metric label="Of which overdue" value={formatMoney(s.overdue_total, cur)} sub="Past the due date" href="/fees?status=overdue" tone={s.overdue_total > 0 ? "bad" : undefined} />
          </div>
        </Panel>
        <Panel className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3 text-[13px] font-medium text-ink-soft">
            <Users className="size-4 text-brass" aria-hidden /> Members
          </div>
          <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3">
            <Metric label="Registered" value={formatNumber(s.total_members)} href="/members" large />
            <Metric label="Active" value={formatNumber(s.active_members)} href="/members?status=active" large tone={s.active_members > 0 ? "good" : undefined} />
            <Metric label="Checked in today" value={formatNumber(s.attendance_today)} href="/attendance" large />
            <Metric label="Expired" value={formatNumber(s.expired_members)} sub="Need renewal" href="/members?status=expired" tone={s.expired_members > 0 ? "bad" : undefined} />
            <Metric
              label="Inactive / no package"
              value={formatNumber(s.inactive_members + s.no_membership_members)}
              sub={`${s.inactive_members} deactivated`}
              href="/members?status=inactive"
            />
            <Metric label="Expiring soon" value={formatNumber(s.expiring_soon)} sub={`Within ${settings.expiry_warning_days} days`} href="/members?status=expiring" tone={s.expiring_soon > 0 ? "warn" : undefined} />
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Fee collection" description="Valid payments received per month, last 12 months" />
          <div className="px-3 pt-4 pb-2">
            {hasCollections ? (
              <CollectionsChart data={collections} currency={cur} />
            ) : (
              <EmptyState icon={TrendingUp} title="No payments recorded yet" description="The chart fills in as you record fees." className="py-14" />
            )}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Member growth" description="Total registered members by joining date" />
          <div className="px-3 pt-4 pb-2">
            {hasMembers ? (
              <GrowthChart data={growth} />
            ) : (
              <EmptyState icon={UserPlus} title="No members yet" description="Growth appears once members are added." className="py-14" />
            )}
          </div>
        </Panel>
      </div>

      <Panel className="mt-6">
        <PanelHeader title="Attendance" description="Daily check-ins, last 30 days" />
        <div className="px-3 pt-4 pb-2">
          {hasAttendance ? (
            <AttendanceChart data={attendance} />
          ) : (
            <EmptyState icon={CalendarCheck2} title="No check-ins in the last 30 days" className="py-10" />
          )}
        </div>
      </Panel>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
        <ListPanel title="Unpaid & overdue fees" href="/fees" linkLabel="All fees">
          {unpaid.data && unpaid.data.length > 0 ? (
            <ul className="divide-y divide-line">
              {unpaid.data.map((i) => (
                <Row
                  key={i.id}
                  href={`/members/${i.member_id}`}
                  primary={i.member_name}
                  secondary={`${i.member_code} — due ${formatDate(i.due_date)}`}
                  right={formatMoney(i.balance, cur)}
                  rightSub={<InvoiceStatusBadge status={i.status} overdue={i.is_overdue} />}
                />
              ))}
            </ul>
          ) : (
            <EmptyState icon={Wallet} title="No unpaid fees" className="py-8" />
          )}
        </ListPanel>

        <ListPanel title="Expiring soon" href="/members?status=expiring" linkLabel="View all">
          {expiring.data && expiring.data.length > 0 ? (
            <ul className="divide-y divide-line">
              {expiring.data.map((m) => (
                <Row
                  key={m.id}
                  href={`/members/${m.id}`}
                  primary={m.full_name}
                  secondary={`${m.member_code} — ${m.current_package_name ?? ""}`}
                  right={formatDate(m.valid_until)}
                  rightSub={m.days_remaining === 0 ? "Last day today" : `${m.days_remaining} days left`}
                />
              ))}
            </ul>
          ) : (
            <EmptyState icon={Users} title="Nothing expiring soon" className="py-8" />
          )}
        </ListPanel>

        <ListPanel title="Recent payments" href="/fees?view=payments" linkLabel="All payments">
          {recentPayments.data && recentPayments.data.length > 0 ? (
            <ul className="divide-y divide-line">
              {recentPayments.data.map((p) => (
                <Row
                  key={p.id}
                  href={`/receipt/${p.id}`}
                  primary={p.member_name}
                  secondary={`${p.receipt_no} — ${paymentMethodLabel(p.method)}`}
                  right={<span className={p.is_void ? "line-through opacity-60" : undefined}>{formatMoney(p.amount, cur)}</span>}
                  rightSub={p.is_void ? "Void" : formatDate(p.payment_date)}
                />
              ))}
            </ul>
          ) : (
            <EmptyState icon={Receipt} title="No payments yet" className="py-8" />
          )}
        </ListPanel>

        <ListPanel title="Recent check-ins" href="/attendance" linkLabel="Attendance">
          {recentAttendance.data && recentAttendance.data.length > 0 ? (
            <ul className="divide-y divide-line">
              {recentAttendance.data.map((a) => (
                <Row
                  key={a.id}
                  href={`/members/${a.member_id}`}
                  primary={a.member_name}
                  secondary={a.member_code}
                  right={formatTime(a.check_in_at, tz)}
                  rightSub={a.attendance_date === s.today ? "Today" : formatDate(a.attendance_date)}
                />
              ))}
            </ul>
          ) : (
            <EmptyState icon={CalendarCheck2} title="No check-ins yet" className="py-8" />
          )}
        </ListPanel>

        <ListPanel title="Recently registered" href="/members" linkLabel="All members">
          {recentMembers.data && recentMembers.data.length > 0 ? (
            <ul className="divide-y divide-line">
              {recentMembers.data.map((m) => (
                <Row key={m.id} href={`/members/${m.id}`} primary={m.full_name} secondary={m.member_code} right={formatDate(m.joining_date)} rightSub="Joined" />
              ))}
            </ul>
          ) : (
            <EmptyState icon={UserPlus} title="No members yet" className="py-8" />
          )}
        </ListPanel>
      </div>
    </>
  );
}
