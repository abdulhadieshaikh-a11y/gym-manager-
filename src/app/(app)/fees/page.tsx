import type { Metadata } from "next";
import Link from "next/link";
import { Receipt, Wallet } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { InvoiceStatusBadge } from "@/components/app/status-badges";
import { Pagination, PAGE_SIZE, pageFromParam } from "@/components/app/pagination";
import { DateFilter, SearchBox, SelectFilter, TabLinks } from "@/components/app/url-filters";
import { RecordPaymentDialog } from "@/components/app/record-payment-dialog";
import { ConfirmAction } from "@/components/app/confirm-action";
import { Panel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getGymSettings, requireGymUser } from "@/lib/auth";
import { formatDate, isIsoDate, monthStart, todayInTimeZone } from "@/lib/dates";
import { friendlyError } from "@/lib/errors";
import { formatMoney, PAYMENT_METHODS, paymentMethodLabel } from "@/lib/format";
import { param, sanitizeSearch } from "@/lib/utils";
import type { PaymentMethod } from "@/lib/database.types";
import { voidPayment } from "./actions";

export const metadata: Metadata = { title: "Fees & Payments" };

const INVOICE_FILTERS = [
  { value: "open", label: "Unpaid & partially paid" },
  { value: "overdue", label: "Overdue" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
];

function Figure({ label, value, tone }: { label: string; value: string; tone?: "bad" | "warn" | "good" }) {
  const color = tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : tone === "good" ? "text-good" : "text-ink";
  return (
    <div className="bg-surface px-5 py-4">
      <p className="text-[12.5px] text-ink-faint">{label}</p>
      <p className={`tabular mt-1 font-display text-xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

export default async function FeesPage({ searchParams }: PageProps<"/fees">) {
  const sp = await searchParams;
  const view = param(sp.view) === "payments" ? "payments" : "invoices";
  const q = sanitizeSearch(param(sp.q));
  const page = pageFromParam(param(sp.page));
  const memberId = param(sp.member);
  const from = param(sp.from);
  const to = param(sp.to);

  const ctx = await requireGymUser();
  const settings = await getGymSettings();
  const cur = settings.currency;
  const today = todayInTimeZone(settings.timezone);

  const { data: summaryRaw } = await ctx.supabase.rpc("dashboard_summary");
  const summary = (summaryRaw ?? {}) as Record<string, number | string>;

  const searchFilter = q
    ? `member_name.ilike.*${q}*,member_code.ilike.*${q}*,${view === "invoices" ? "invoice_no" : "receipt_no"}.ilike.*${q}*`
    : null;
  const offset = (page - 1) * PAGE_SIZE;

  return (
    <>
      <PageHeader
        title="Fees & Payments"
        description="See who has paid and who hasn't. Payments are recorded against a member's fee; corrections are made by voiding with a reason."
      />

      <Panel className="mb-6 overflow-hidden">
        <div className="grid grid-cols-2 gap-px bg-line lg:grid-cols-4">
          <Figure label="Outstanding" value={formatMoney(Number(summary.outstanding_total ?? 0), cur)} tone={Number(summary.outstanding_total) > 0 ? "warn" : undefined} />
          <Figure label="Overdue" value={formatMoney(Number(summary.overdue_total ?? 0), cur)} tone={Number(summary.overdue_total) > 0 ? "bad" : undefined} />
          <Figure label="Collected today" value={formatMoney(Number(summary.fees_today ?? 0), cur)} />
          <Figure label="Collected this month" value={formatMoney(Number(summary.fees_month ?? 0), cur)} tone="good" />
        </div>
      </Panel>

      <Panel>
        <TabLinks
          param="view"
          tabs={[
            { value: "invoices", label: "Member fees", count: Number(summary.open_invoices ?? 0) || undefined },
            { value: "payments", label: "Payments received" },
          ]}
        />
        {view === "invoices" ? (
          <InvoicesView ctx={ctx} q={searchFilter} rawQ={q} status={param(sp.status) || "open"} memberId={memberId} page={page} offset={offset} today={today} currency={cur} />
        ) : (
          <PaymentsView
            ctx={ctx}
            q={searchFilter}
            rawQ={q}
            method={param(sp.method)}
            state={param(sp.state)}
            from={isIsoDate(from) ? from : ""}
            to={isIsoDate(to) ? to : ""}
            memberId={memberId}
            page={page}
            offset={offset}
            currency={cur}
            monthFrom={monthStart(today)}
            isOwner={ctx.isOwner}
          />
        )}
      </Panel>
    </>
  );
}

type Ctx = Awaited<ReturnType<typeof requireGymUser>>;

async function InvoicesView({
  ctx,
  q,
  rawQ,
  status,
  memberId,
  page,
  offset,
  today,
  currency,
}: {
  ctx: Ctx;
  q: string | null;
  rawQ: string;
  status: string;
  memberId: string;
  page: number;
  offset: number;
  today: string;
  currency: string;
}) {
  let query = ctx.supabase.from("invoice_overview").select("*", { count: "exact" });
  if (q) query = query.or(q);
  if (/^[0-9a-f-]{36}$/i.test(memberId)) query = query.eq("member_id", memberId);
  if (status === "open") query = query.in("status", ["unpaid", "partially_paid"]);
  else if (status === "overdue") query = query.eq("is_overdue", true);
  else if (status === "unpaid" || status === "partially_paid" || status === "paid" || status === "void") query = query.eq("status", status);

  const ascending = status === "open" || status === "overdue" || status === "unpaid" || status === "partially_paid";
  const { data, count, error } = await query.order("due_date", { ascending }).order("created_at").range(offset, offset + PAGE_SIZE - 1);

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
        <SearchBox placeholder="Member, ID or fee number" />
        <SelectFilter param="status" label="All fees" options={INVOICE_FILTERS} className="sm:w-56" />
        {memberId && (
          <Link href="/fees" className="text-[13px] text-brass-strong hover:underline">
            Clear member filter
          </Link>
        )}
      </div>
      {error ? (
        <p className="p-5 text-sm text-bad">{friendlyError(error, "Could not load fees.")}</p>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={status === "open" && !rawQ ? "Nothing outstanding" : "No fees found"}
          description={status === "open" && !rawQ ? "Every member fee is fully paid. New fees appear here when you assign or renew a package." : "Try a different search or filter."}
        />
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <TH>Member</TH>
                <TH>Fee</TH>
                <TH>Due</TH>
                <TH className="text-right">Amount</TH>
                <TH className="text-right">Paid</TH>
                <TH className="text-right">Balance</TH>
                <TH>Status</TH>
                <TH className="text-right">
                  <span className="sr-only">Actions</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {data.map((inv) => {
                const open = inv.status === "unpaid" || inv.status === "partially_paid";
                return (
                  <TR key={inv.id}>
                    <TD>
                      <Link href={`/members/${inv.member_id}`} className="font-medium text-ink hover:underline">
                        {inv.member_name}
                      </Link>
                      <p className="tabular text-[12.5px] text-ink-faint">{inv.member_code}</p>
                    </TD>
                    <TD>
                      <p className="max-w-56 truncate text-ink">{inv.description}</p>
                      <p className="tabular text-[12.5px] text-ink-faint">{inv.invoice_no}</p>
                    </TD>
                    <TD className={`tabular whitespace-nowrap ${inv.is_overdue ? "text-bad" : "text-ink-soft"}`}>{formatDate(inv.due_date)}</TD>
                    <TD className="tabular text-right">{formatMoney(inv.amount_due, currency)}</TD>
                    <TD className="tabular text-right text-ink-soft">{formatMoney(inv.amount_paid, currency)}</TD>
                    <TD className={`tabular text-right font-medium ${open ? "text-ink" : "text-ink-faint"}`}>
                      {inv.status === "void" ? "—" : formatMoney(inv.balance, currency)}
                    </TD>
                    <TD>
                      <InvoiceStatusBadge status={inv.status} overdue={inv.is_overdue} />
                    </TD>
                    <TD>
                      {open && (
                        <div className="flex justify-end gap-2">
                          <RecordPaymentDialog
                            invoice={inv}
                            today={today}
                            currency={currency}
                            trigger={
                              <Button size="sm" variant="brass">
                                Record payment
                              </Button>
                            }
                          />
                          <RecordPaymentDialog
                            invoice={inv}
                            today={today}
                            currency={currency}
                            mode="settle"
                            trigger={
                              <Button size="sm" variant="outline">
                                Mark as paid
                              </Button>
                            }
                          />
                        </div>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          <Pagination page={page} total={count ?? 0} basePath="/fees" params={{ q: rawQ, status: status === "open" ? "" : status, member: memberId }} />
        </>
      )}
    </>
  );
}

async function PaymentsView({
  ctx,
  q,
  rawQ,
  method,
  state,
  from,
  to,
  memberId,
  page,
  offset,
  currency,
  monthFrom,
  isOwner,
}: {
  ctx: Ctx;
  q: string | null;
  rawQ: string;
  method: string;
  state: string;
  from: string;
  to: string;
  memberId: string;
  page: number;
  offset: number;
  currency: string;
  monthFrom: string;
  isOwner: boolean;
}) {
  const validMethod = PAYMENT_METHODS.some((m) => m.value === method) ? (method as PaymentMethod) : null;

  let rows = ctx.supabase.from("payment_overview").select("*", { count: "exact" });
  let totals = ctx.supabase.from("payment_overview").select("amount").eq("is_void", false).limit(10000);
  if (q) {
    rows = rows.or(q);
    totals = totals.or(q);
  }
  if (/^[0-9a-f-]{36}$/i.test(memberId)) {
    rows = rows.eq("member_id", memberId);
    totals = totals.eq("member_id", memberId);
  }
  if (validMethod) {
    rows = rows.eq("method", validMethod);
    totals = totals.eq("method", validMethod);
  }
  if (from) {
    rows = rows.gte("payment_date", from);
    totals = totals.gte("payment_date", from);
  }
  if (to) {
    rows = rows.lte("payment_date", to);
    totals = totals.lte("payment_date", to);
  }
  if (state === "valid") rows = rows.eq("is_void", false);
  if (state === "void") rows = rows.eq("is_void", true);

  const [{ data, count, error }, { data: totalRows }] = await Promise.all([
    rows.order("payment_date", { ascending: false }).order("created_at", { ascending: false }).range(offset, offset + PAGE_SIZE - 1),
    state === "void" ? Promise.resolve({ data: [] as { amount: number }[] }) : totals,
  ]);
  const total = (totalRows ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const filtered = Boolean(rawQ || validMethod || from || to || state || memberId);

  return (
    <>
      <div className="flex flex-col flex-wrap gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
        <SearchBox placeholder="Member, ID or receipt number" />
        <SelectFilter param="method" label="All methods" options={PAYMENT_METHODS} />
        <SelectFilter
          param="state"
          label="Valid & voided"
          options={[
            { value: "valid", label: "Valid only" },
            { value: "void", label: "Voided only" },
          ]}
        />
        <DateFilter param="from" label="From" />
        <DateFilter param="to" label="To" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-canvas/50 px-5 py-2.5 text-[13px] text-ink-soft">
        <span>
          {filtered ? "Total of matching valid payments" : "Total of all valid payments"}:{" "}
          <span className="tabular font-semibold text-ink">{formatMoney(total, currency)}</span>
        </span>
        {!from && !to && (
          <Link href={`/fees?view=payments&from=${monthFrom}`} className="text-brass-strong hover:underline">
            Show this month
          </Link>
        )}
      </div>
      {error ? (
        <p className="p-5 text-sm text-bad">{friendlyError(error, "Could not load payments.")}</p>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={filtered ? "No matching payments" : "No payments yet"}
          description={filtered ? "Try a different search, method or date range." : "Payments appear here once you record them against a member's fee."}
        />
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <TH>Receipt</TH>
                <TH>Member</TH>
                <TH>Date</TH>
                <TH>Method</TH>
                <TH className="text-right">Amount</TH>
                <TH>Status</TH>
                <TH className="text-right">
                  <span className="sr-only">Actions</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {data.map((p) => (
                <TR key={p.id} className={p.is_void ? "opacity-60" : undefined}>
                  <TD>
                    <p className="tabular font-medium text-ink">{p.receipt_no}</p>
                    <p className="max-w-48 truncate text-[12.5px] text-ink-faint">{p.invoice_description}</p>
                  </TD>
                  <TD>
                    <Link href={`/members/${p.member_id}`} className="text-ink hover:underline">
                      {p.member_name}
                    </Link>
                    <p className="tabular text-[12.5px] text-ink-faint">{p.member_code}</p>
                  </TD>
                  <TD className="tabular whitespace-nowrap text-ink-soft">{formatDate(p.payment_date)}</TD>
                  <TD className="text-ink-soft">
                    {paymentMethodLabel(p.method)}
                    {p.reference && <span className="block max-w-40 truncate text-[12.5px] text-ink-faint">Ref {p.reference}</span>}
                  </TD>
                  <TD className={`tabular text-right font-medium ${p.is_void ? "line-through" : ""}`}>{formatMoney(p.amount, currency)}</TD>
                  <TD>
                    {p.is_void ? (
                      <Badge tone="neutral" title={p.void_reason ?? undefined}>
                        Void
                      </Badge>
                    ) : (
                      <Badge tone="good">Received</Badge>
                    )}
                  </TD>
                  <TD>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/receipt/${p.id}`}>Receipt</Link>
                      </Button>
                      {isOwner && !p.is_void && (
                        <ConfirmAction
                          trigger="Void"
                          triggerVariant="ghost"
                          title={`Void payment ${p.receipt_no}?`}
                          description={`${formatMoney(p.amount, currency)} from ${p.member_name} will be removed from collections and added back to the fee balance. The record is kept, marked void, with your reason.`}
                          confirmLabel="Void payment"
                          successMessage="Payment voided"
                          requireReason
                          reasonPlaceholder="e.g. Duplicate entry"
                          action={voidPayment.bind(null, p.id)}
                        />
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination
            page={page}
            total={count ?? 0}
            basePath="/fees"
            params={{ view: "payments", q: rawQ, method: validMethod ?? "", state, from, to, member: memberId }}
          />
        </>
      )}
    </>
  );
}
