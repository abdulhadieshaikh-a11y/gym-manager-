import type { InvoiceStatus, MembershipStatus, PaymentMethod } from "@/lib/database.types";

const formatters = new Map<string, Intl.NumberFormat>();

/** Formats money, e.g. "Rs 3,000" (PKR). Shows paisa only when present. */
export function formatMoney(amount: number | string | null | undefined, currency = "PKR"): string {
  const value = Number(amount ?? 0);
  const safe = Number.isFinite(value) ? value : 0;
  const hasFraction = Math.round(safe * 100) % 100 !== 0;
  const key = `${currency}:${hasFraction}`;
  let fmt = formatters.get(key);
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat("en-PK", {
        style: "currency",
        currency,
        minimumFractionDigits: hasFraction ? 2 : 0,
        maximumFractionDigits: hasFraction ? 2 : 0,
      });
    } catch {
      fmt = new Intl.NumberFormat("en-PK", { minimumFractionDigits: hasFraction ? 2 : 0, maximumFractionDigits: 2 });
    }
    formatters.set(key, fmt);
  }
  return fmt.format(safe);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-PK").format(value);
}

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "easypaisa", label: "Easypaisa" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "other", label: "Other / manual" },
];

export function paymentMethodLabel(method: PaymentMethod | string): string {
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  unpaid: "Unpaid",
  partially_paid: "Partially paid",
  paid: "Paid",
  void: "Void",
};

export const MEMBERSHIP_STATUS_LABEL: Record<MembershipStatus, string> = {
  active: "Active",
  expired: "Expired",
  inactive: "Inactive",
  upcoming: "Starts soon",
  no_membership: "No package",
};

/** Keeps digits and a leading +. "0300-123 4567" -> "03001234567". */
export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(/\D/g, "");
}

/** Money math in integer paisa to avoid floating-point drift. */
export function toPaisa(amount: number | string): number {
  return Math.round(Number(amount) * 100);
}

export function fromPaisa(paisa: number): number {
  return paisa / 100;
}
