import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft, Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getGymSettings, logoUrl, requireGymUser } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatMoney, paymentMethodLabel } from "@/lib/format";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Receipt" };

export default async function ReceiptPage({ params }: PageProps<"/receipt/[id]">) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const ctx = await requireGymUser();
  const settings = await getGymSettings();
  const { data: p } = await ctx.supabase.from("payment_overview").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const { data: inv } = await ctx.supabase.from("fee_invoices").select("amount_due, amount_paid, balance, status").eq("id", p.invoice_id).maybeSingle();
  const cur = settings.currency;
  const logo = logoUrl(settings);

  const rows: [string, string][] = [
    ["Receipt no.", p.receipt_no],
    ["Payment date", formatDate(p.payment_date)],
    ["Recorded", formatDateTime(p.created_at, settings.timezone)],
    ["Member", `${p.member_name} (${p.member_code})`],
    ["Phone", p.member_phone],
    ["For", `${p.invoice_description} — ${p.invoice_no}`],
    ["Method", paymentMethodLabel(p.method)],
  ];
  if (p.reference) rows.push(["Reference", p.reference]);

  return (
    <main className="min-h-dvh bg-canvas px-4 py-8 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-6 flex max-w-xl items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href={`/members/${p.member_id}`}>
            <ArrowLeft /> Back to member
          </Link>
        </Button>
        <PrintButton />
      </div>

      <article className="relative mx-auto max-w-xl overflow-hidden rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-panel)] print:max-w-none print:shadow-none">
        <div className="h-1.5 bg-brass" aria-hidden />
        {p.is_void && (
          <div className="border-b border-bad/20 bg-bad-soft px-8 py-3 text-sm font-medium text-bad">
            VOID — this payment was cancelled{p.void_reason ? `: ${p.void_reason}` : ""}. It is not valid as proof of payment.
          </div>
        )}
        <header className="flex items-start justify-between gap-6 px-8 pt-8">
          <div className="flex items-center gap-3">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo from Supabase Storage
              <img src={logo} alt="" className="size-12 object-contain" />
            ) : (
              <div className="grid size-12 place-items-center rounded-[var(--radius-md)] bg-graphite text-brass-bright">
                <Dumbbell className="size-6" aria-hidden />
              </div>
            )}
            <div>
              <p className="font-display text-lg font-bold text-ink">{settings.gym_name}</p>
              {settings.address && <p className="max-w-64 text-[12.5px] text-ink-soft">{settings.address}</p>}
              <p className="text-[12.5px] text-ink-soft">{[settings.contact_phone, settings.email].filter(Boolean).join("  |  ")}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-[22px] font-bold text-ink">Receipt</p>
            <p className="tabular text-[13px] text-ink-soft">{p.receipt_no}</p>
          </div>
        </header>

        <div className="mx-8 mt-8 rounded-[var(--radius-md)] bg-brass-soft px-5 py-4">
          <p className="text-[12.5px] text-ink-soft">Amount received</p>
          <p className={`tabular font-display text-[32px] leading-tight font-bold text-ink ${p.is_void ? "line-through" : ""}`}>
            {formatMoney(p.amount, cur)}
          </p>
        </div>

        <dl className="mx-8 mt-6 divide-y divide-line text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-6 py-2.5">
              <dt className="text-ink-soft">{k}</dt>
              <dd className="tabular text-right text-ink">{v}</dd>
            </div>
          ))}
        </dl>

        {inv && (
          <div className="mx-8 mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-[var(--radius-md)] bg-line text-center text-sm">
            {[
              ["Fee total", inv.amount_due],
              ["Paid to date", inv.amount_paid],
              ["Balance remaining", inv.balance],
            ].map(([k, v]) => (
              <div key={k as string} className="bg-canvas px-2 py-3">
                <p className="text-[11.5px] text-ink-faint">{k}</p>
                <p className="tabular font-semibold text-ink">{formatMoney(v as number, cur)}</p>
              </div>
            ))}
          </div>
        )}

        <footer className="mt-8 border-t border-dashed border-line-strong px-8 py-6 text-[12.5px] text-ink-faint">
          {settings.receipt_footer && <p className="mb-2 text-ink-soft">{settings.receipt_footer}</p>}
          <p>
            {p.method === "cash"
              ? "Cash payment received at the gym."
              : "Payment recorded by gym staff as received via " + paymentMethodLabel(p.method) + "."}{" "}
            Computer-generated receipt.
          </p>
        </footer>
      </article>
    </main>
  );
}
