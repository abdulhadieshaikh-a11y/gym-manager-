import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CalendarCheck2, Pencil, Plus, Receipt, RefreshCw, Wallet } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { InvoiceStatusBadge, MembershipStatusBadge } from "@/components/app/status-badges";
import { ConfirmAction } from "@/components/app/confirm-action";
import { CheckInButton } from "@/components/app/check-in-button";
import { RecordPaymentDialog } from "@/components/app/record-payment-dialog";
import { AssignMembershipDialog } from "@/components/app/assign-membership-dialog";
import { AddInvoiceDialog } from "@/components/app/add-invoice-dialog";
import { Panel, PanelHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getGymSettings, requireGymUser } from "@/lib/auth";
import { formatDate, formatDateTime, formatTime, suggestRenewalStart, todayInTimeZone } from "@/lib/dates";
import { formatMoney, paymentMethodLabel } from "@/lib/format";
import { cancelMembership, deleteMember, setMemberActive } from "../actions";
import { voidInvoice, voidPayment } from "../../fees/actions";

export const metadata: Metadata = { title: "Member" };

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12.5px] text-ink-faint">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-ink">{children}</dd>
    </div>
  );
}

export default async function MemberProfilePage({ params }: PageProps<"/members/[id]">) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const ctx = await requireGymUser();
  const settings = await getGymSettings();
  const today = todayInTimeZone(settings.timezone);
  const cur = settings.currency;

  const [memberRes, membershipsRes, invoicesRes, paymentsRes, attendanceRes, packagesRes] = await Promise.all([
    ctx.supabase.from("member_overview").select("*").eq("id", id).maybeSingle(),
    ctx.supabase.from("memberships").select("*").eq("member_id", id).order("start_date", { ascending: false }),
    ctx.supabase.from("invoice_overview").select("*").eq("member_id", id).order("due_date", { ascending: false }),
    ctx.supabase.from("payments").select("*").eq("member_id", id).order("created_at", { ascending: false }),
    ctx.supabase.from("attendance").select("*", { count: "exact" }).eq("member_id", id).order("attendance_date", { ascending: false }).limit(15),
    ctx.supabase.from("packages").select("*").eq("is_active", true).order("price"),
  ]);

  const m = memberRes.data;
  if (!m) notFound();
  const memberships = membershipsRes.data ?? [];
  const invoices = invoicesRes.data ?? [];
  const payments = paymentsRes.data ?? [];
  const attendance = attendanceRes.data ?? [];
  const attendanceTotal = attendanceRes.count ?? attendance.length;
  const packages = packagesRes.data ?? [];
  const invoiceNo = new Map(invoices.map((i) => [i.id, i.invoice_no]));
  const openInvoices = invoices.filter((i) => i.status === "unpaid" || i.status === "partially_paid");
  const hasHistory = memberships.length + invoices.length + payments.length + attendanceTotal > 0;
  const checkedInToday = attendance.some((a) => a.attendance_date === today);
  const renewStart = suggestRenewalStart(m.valid_until, today);
  const totalPaid = payments.filter((p) => !p.is_void).reduce((s, p) => s + Number(p.amount), 0);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Members", href: "/members" }, { label: m.full_name }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {m.full_name}
            <MembershipStatusBadge status={m.membership_status} expiringSoon={m.expiring_soon} />
          </span>
        }
        description={<span className="tabular">{m.member_code}</span>}
        actions={
          <>
            {m.is_active &&
              (checkedInToday ? (
                <Badge tone="good">Checked in today</Badge>
              ) : (
                <CheckInButton memberId={m.id} memberName={m.full_name} isOwner={ctx.isOwner} size="md" />
              ))}
            {m.is_active && (
              <AssignMembershipDialog
                memberId={m.id}
                memberName={m.full_name}
                packages={packages}
                defaultStart={renewStart}
                currency={cur}
                title={m.valid_until ? "Renew membership" : "Assign package"}
                trigger={
                  <Button variant="outline">
                    <RefreshCw /> {m.valid_until ? "Renew" : "Assign package"}
                  </Button>
                }
              />
            )}
            <Button variant="outline" asChild>
              <Link href={`/members/${m.id}/edit`}>
                <Pencil /> Edit
              </Link>
            </Button>
          </>
        }
      />

      {!m.is_active && (
        <div className="mb-6 rounded-[var(--radius-lg)] border border-line-strong bg-surface px-5 py-4 text-sm text-ink-soft">
          This member was deactivated on {formatDateTime(m.deactivated_at, settings.timezone)}
          {m.deactivation_reason ? ` — “${m.deactivation_reason}”` : ""}. History is kept; reactivate to renew or check in.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Summary */}
          <Panel className="overflow-hidden">
            <div className="grid gap-px bg-line sm:grid-cols-3">
              <div className="bg-surface px-5 py-4">
                <p className="text-[12.5px] text-ink-faint">Current package</p>
                <p className="mt-1 font-display text-lg font-semibold text-ink">{m.current_package_name ?? "None"}</p>
                <p className="text-[13px] text-ink-soft">
                  {m.current_start_date ? `${formatDate(m.current_start_date)} – ${formatDate(m.current_end_date)}` : "No membership yet"}
                </p>
              </div>
              <div className="bg-surface px-5 py-4">
                <p className="text-[12.5px] text-ink-faint">Valid until</p>
                <p className="tabular mt-1 font-display text-lg font-semibold text-ink">{formatDate(m.valid_until)}</p>
                <p className={`text-[13px] ${m.membership_status === "expired" ? "text-bad" : m.expiring_soon ? "text-warn" : "text-ink-soft"}`}>
                  {m.days_remaining === null
                    ? "—"
                    : m.days_remaining < 0
                      ? `Expired ${Math.abs(m.days_remaining)} days ago`
                      : m.days_remaining === 0
                        ? "Last day today"
                        : `${m.days_remaining} days remaining`}
                </p>
              </div>
              <div className="bg-surface px-5 py-4">
                <p className="text-[12.5px] text-ink-faint">Balance due</p>
                <p className={`tabular mt-1 font-display text-lg font-semibold ${m.outstanding_balance > 0 ? "text-bad" : "text-good"}`}>
                  {formatMoney(m.outstanding_balance, cur)}
                </p>
                <p className="text-[13px] text-ink-soft">{formatMoney(totalPaid, cur)} paid in total</p>
              </div>
            </div>
          </Panel>

          {/* Fees */}
          <Panel>
            <PanelHeader
              title="Fees"
              description={openInvoices.length ? `${openInvoices.length} unpaid or partially paid` : "All fees settled"}
              action={
                m.is_active || openInvoices.length ? (
                  <AddInvoiceDialog
                    memberId={m.id}
                    memberName={m.full_name}
                    today={today}
                    currency={cur}
                    trigger={
                      <Button variant="outline" size="sm">
                        <Plus /> Add fee
                      </Button>
                    }
                  />
                ) : null
              }
            />
            {invoices.length === 0 ? (
              <EmptyState icon={Wallet} title="No fees yet" description="Fees are created automatically when you assign or renew a package." />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Fee</TH>
                    <TH>Due</TH>
                    <TH className="text-right">Amount</TH>
                    <TH className="text-right">Balance</TH>
                    <TH>Status</TH>
                    <TH className="text-right">
                      <span className="sr-only">Actions</span>
                    </TH>
                  </tr>
                </THead>
                <TBody>
                  {invoices.map((inv) => {
                    const open = inv.status === "unpaid" || inv.status === "partially_paid";
                    return (
                      <TR key={inv.id}>
                        <TD>
                          <p className="font-medium text-ink">{inv.description}</p>
                          <p className="tabular text-[12.5px] text-ink-faint">{inv.invoice_no}</p>
                          {inv.status === "void" && inv.void_reason && <p className="text-[12.5px] text-ink-faint">Void: {inv.void_reason}</p>}
                        </TD>
                        <TD className="tabular whitespace-nowrap text-ink-soft">{formatDate(inv.due_date)}</TD>
                        <TD className="tabular text-right">{formatMoney(inv.amount_due, cur)}</TD>
                        <TD className={`tabular text-right ${open ? "font-medium text-ink" : "text-ink-faint"}`}>
                          {inv.status === "void" ? "—" : formatMoney(inv.balance, cur)}
                        </TD>
                        <TD>
                          <InvoiceStatusBadge status={inv.status} overdue={inv.is_overdue} />
                        </TD>
                        <TD>
                          <div className="flex justify-end gap-2">
                            {open && (
                              <>
                                <RecordPaymentDialog
                                  invoice={inv}
                                  today={today}
                                  currency={cur}
                                  trigger={
                                    <Button size="sm" variant="brass">
                                      Record payment
                                    </Button>
                                  }
                                />
                                <RecordPaymentDialog
                                  invoice={inv}
                                  today={today}
                                  currency={cur}
                                  mode="settle"
                                  trigger={
                                    <Button size="sm" variant="outline">
                                      Mark as paid
                                    </Button>
                                  }
                                />
                              </>
                            )}
                            {ctx.isOwner && inv.status === "unpaid" && (
                              <ConfirmAction
                                trigger="Void"
                                triggerVariant="ghost"
                                title={`Void ${inv.invoice_no}?`}
                                description="The fee will no longer be owed. It stays in the history, marked void, with your reason."
                                confirmLabel="Void fee"
                                successMessage="Fee voided"
                                requireReason
                                reasonPlaceholder="e.g. Fee waived by owner"
                                action={voidInvoice.bind(null, inv.id, m.id)}
                              />
                            )}
                          </div>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </Panel>

          {/* Payments */}
          <Panel>
            <PanelHeader title="Payment history" />
            {payments.length === 0 ? (
              <EmptyState icon={Receipt} title="No payments yet" description="Payments you record will appear here with a printable receipt." />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Receipt</TH>
                    <TH>Date</TH>
                    <TH>Method</TH>
                    <TH className="text-right">Amount</TH>
                    <TH className="text-right">
                      <span className="sr-only">Actions</span>
                    </TH>
                  </tr>
                </THead>
                <TBody>
                  {payments.map((p) => (
                    <TR key={p.id} className={p.is_void ? "opacity-60" : undefined}>
                      <TD>
                        <p className="tabular font-medium text-ink">{p.receipt_no}</p>
                        <p className="text-[12.5px] text-ink-faint">For {invoiceNo.get(p.invoice_id) ?? "fee"}</p>
                        {p.is_void && <p className="text-[12.5px] text-bad">Voided: {p.void_reason}</p>}
                      </TD>
                      <TD className="tabular whitespace-nowrap text-ink-soft">{formatDate(p.payment_date)}</TD>
                      <TD className="text-ink-soft">
                        {paymentMethodLabel(p.method)}
                        {p.reference && <span className="block text-[12.5px] text-ink-faint">Ref {p.reference}</span>}
                      </TD>
                      <TD className={`tabular text-right font-medium ${p.is_void ? "line-through" : ""}`}>{formatMoney(p.amount, cur)}</TD>
                      <TD>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/receipt/${p.id}`}>Receipt</Link>
                          </Button>
                          {ctx.isOwner && !p.is_void && (
                            <ConfirmAction
                              trigger="Void"
                              triggerVariant="ghost"
                              title={`Void payment ${p.receipt_no}?`}
                              description={`${formatMoney(p.amount, cur)} will be removed from collections and added back to the fee balance. The payment stays in the history, marked void. Then record the correct payment.`}
                              confirmLabel="Void payment"
                              successMessage="Payment voided"
                              requireReason
                              reasonPlaceholder="e.g. Wrong amount entered"
                              action={voidPayment.bind(null, p.id)}
                            />
                          )}
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Panel>

          {/* Memberships */}
          <Panel>
            <PanelHeader title="Membership history" />
            {memberships.length === 0 ? (
              <EmptyState icon={RefreshCw} title="No memberships" description="Assign a package to start this member's membership." />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Package</TH>
                    <TH>Period</TH>
                    <TH className="text-right">Agreed price</TH>
                    <TH>Status</TH>
                    <TH className="text-right">
                      <span className="sr-only">Actions</span>
                    </TH>
                  </tr>
                </THead>
                <TBody>
                  {memberships.map((ms) => {
                    const state =
                      ms.status === "cancelled" ? "Cancelled" : ms.end_date < today ? "Ended" : ms.start_date > today ? "Upcoming" : "Current";
                    return (
                      <TR key={ms.id} className={ms.status === "cancelled" ? "opacity-60" : undefined}>
                        <TD>
                          <p className="font-medium text-ink">{ms.package_name}</p>
                          {ms.cancel_reason && <p className="text-[12.5px] text-ink-faint">Cancelled: {ms.cancel_reason}</p>}
                          {ms.notes && <p className="text-[12.5px] text-ink-faint">{ms.notes}</p>}
                        </TD>
                        <TD className="tabular whitespace-nowrap text-ink-soft">
                          {formatDate(ms.start_date)} – {formatDate(ms.end_date)}
                        </TD>
                        <TD className="tabular text-right">{formatMoney(ms.price, cur)}</TD>
                        <TD>
                          <Badge tone={state === "Current" ? "good" : state === "Upcoming" ? "info" : "neutral"}>{state}</Badge>
                        </TD>
                        <TD className="text-right">
                          {ctx.isOwner && ms.status === "active" && ms.end_date >= today && (
                            <ConfirmAction
                              trigger="Cancel"
                              triggerVariant="ghost"
                              title="Cancel this membership?"
                              description="Use this to correct a membership entered by mistake. Its unpaid fee is voided. If payments were recorded, void them first."
                              confirmLabel="Cancel membership"
                              successMessage="Membership cancelled"
                              requireReason
                              action={cancelMembership.bind(null, ms.id, m.id)}
                            />
                          )}
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </Panel>
        </div>

        {/* Side column */}
        <div className="flex flex-col gap-6">
          <Panel>
            <PanelHeader title="Contact" />
            <dl className="grid gap-4 p-5">
              <Fact label="Phone">
                <a href={`tel:${m.phone}`} className="tabular hover:underline">
                  {m.phone}
                </a>
              </Fact>
              <Fact label="Email">{m.email ? <a href={`mailto:${m.email}`} className="hover:underline">{m.email}</a> : "—"}</Fact>
              <Fact label="Joined">{formatDate(m.joining_date)}</Fact>
              <Fact label="Member ID">
                <span className="tabular">{m.member_code}</span>
              </Fact>
              {m.notes && (
                <div>
                  <dt className="text-[12.5px] text-ink-faint">Notes</dt>
                  <dd className="mt-0.5 text-sm whitespace-pre-wrap text-ink">{m.notes}</dd>
                </div>
              )}
            </dl>
          </Panel>

          <Panel>
            <PanelHeader
              title="Attendance"
              description={`${attendanceTotal} visit${attendanceTotal === 1 ? "" : "s"} in total`}
              action={
                attendanceTotal > 0 ? (
                  <Link href={`/attendance?member=${m.id}&view=history`} className="text-[13px] text-brass-strong hover:underline">
                    View all
                  </Link>
                ) : null
              }
            />
            {attendance.length === 0 ? (
              <EmptyState icon={CalendarCheck2} title="No visits yet" className="py-8" />
            ) : (
              <ul className="divide-y divide-line">
                {attendance.map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="tabular text-ink">{formatDate(a.attendance_date)}</span>
                    <span className="tabular text-[13px] text-ink-soft">
                      {formatTime(a.check_in_at, settings.timezone)}
                      {a.check_out_at ? ` – ${formatTime(a.check_out_at, settings.timezone)}` : ""}
                      {a.is_override && <span className="ml-2 text-warn">override</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {ctx.isOwner && (
            <Panel>
              <PanelHeader title="Member status" />
              <div className="flex flex-col gap-3 p-5 text-[13px] text-ink-soft">
                {m.is_active ? (
                  <>
                    <p>Deactivate members who have left. Their history is kept and they can be reactivated later.</p>
                    <div>
                      <ConfirmAction
                        trigger="Deactivate member"
                        title={`Deactivate ${m.full_name}?`}
                        description="They won't be able to check in or get new memberships until reactivated. Payment and attendance history is kept."
                        confirmLabel="Deactivate"
                        successMessage="Member deactivated"
                        requireReason
                        reasonPlaceholder="e.g. Moved to another city"
                        action={setMemberActive.bind(null, m.id, false)}
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <ConfirmAction
                      trigger="Reactivate member"
                      title={`Reactivate ${m.full_name}?`}
                      description="They can be checked in and given a new membership again."
                      confirmLabel="Reactivate"
                      confirmVariant="primary"
                      successMessage="Member reactivated"
                      action={setMemberActive.bind(null, m.id, true)}
                    />
                  </div>
                )}
                {!hasHistory && (
                  <div className="border-t border-line pt-3">
                    <p className="mb-2">This member has no history, so they can be deleted permanently (e.g. a duplicate entry).</p>
                    <ConfirmAction
                      trigger="Delete member"
                      triggerVariant="ghost"
                      title={`Delete ${m.full_name} permanently?`}
                      description="This cannot be undone."
                      confirmLabel="Delete permanently"
                      successMessage="Member deleted"
                      action={deleteMember.bind(null, m.id)}
                      redirectTo="/members"
                    />
                  </div>
                )}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
