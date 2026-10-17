import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { InvoiceStatus, MembershipStatus } from "@/lib/database.types";
import { INVOICE_STATUS_LABEL, MEMBERSHIP_STATUS_LABEL } from "@/lib/format";

const MEMBERSHIP_TONE: Record<MembershipStatus, BadgeTone> = {
  active: "good",
  expired: "bad",
  inactive: "neutral",
  upcoming: "info",
  no_membership: "warn",
};

export function MembershipStatusBadge({ status, expiringSoon }: { status: MembershipStatus; expiringSoon?: boolean }) {
  if (status === "active" && expiringSoon) return <Badge tone="warn">Expiring soon</Badge>;
  return <Badge tone={MEMBERSHIP_TONE[status]}>{MEMBERSHIP_STATUS_LABEL[status]}</Badge>;
}

const INVOICE_TONE: Record<InvoiceStatus, BadgeTone> = {
  unpaid: "warn",
  partially_paid: "info",
  paid: "good",
  void: "neutral",
};

export function InvoiceStatusBadge({ status, overdue }: { status: InvoiceStatus; overdue?: boolean }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Badge tone={INVOICE_TONE[status]}>{INVOICE_STATUS_LABEL[status]}</Badge>
      {overdue && <Badge tone="bad">Overdue</Badge>}
    </span>
  );
}

export function ActiveBadge({ active, activeLabel = "Active", inactiveLabel = "Inactive" }: { active: boolean; activeLabel?: string; inactiveLabel?: string }) {
  return <Badge tone={active ? "good" : "neutral"}>{active ? activeLabel : inactiveLabel}</Badge>;
}
