import type { Metadata } from "next";
import { Layers, Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { ActiveBadge } from "@/components/app/status-badges";
import { ConfirmAction } from "@/components/app/confirm-action";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getGymSettings, requireGymUser } from "@/lib/auth";
import { describeDuration } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { friendlyError } from "@/lib/errors";
import { PackageDialog } from "./package-dialog";
import { setPackageActive } from "./actions";

export const metadata: Metadata = { title: "Packages" };

export default async function PackagesPage() {
  const ctx = await requireGymUser();
  const settings = await getGymSettings();
  const [{ data: packages, error }, { data: memberships }] = await Promise.all([
    ctx.supabase.from("packages").select("*").order("is_active", { ascending: false }).order("price"),
    ctx.supabase.from("member_overview").select("current_package_id").eq("membership_status", "active"),
  ]);

  const activeCounts = new Map<string, number>();
  (memberships ?? []).forEach((m) => {
    if (m.current_package_id) activeCounts.set(m.current_package_id, (activeCounts.get(m.current_package_id) ?? 0) + 1);
  });

  return (
    <>
      <PageHeader
        title="Packages"
        description="Membership plans and their prices. Price changes never affect memberships already sold."
        actions={
          ctx.isOwner && (
            <PackageDialog
              trigger={
                <Button>
                  <Plus /> New package
                </Button>
              }
            />
          )
        }
      />
      <Panel>
        {error ? (
          <p className="p-5 text-sm text-bad">{friendlyError(error, "Could not load packages.")}</p>
        ) : !packages || packages.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No packages yet"
            description="Create your first package — for example Monthly, 3 Months, 6 Months and Annual — so you can assign it to members."
            action={
              ctx.isOwner && (
                <PackageDialog
                  trigger={
                    <Button>
                      <Plus /> New package
                    </Button>
                  }
                />
              )
            }
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Package</TH>
                <TH>Duration</TH>
                <TH className="text-right">Price</TH>
                <TH className="text-right">Active members</TH>
                <TH>Status</TH>
                {ctx.isOwner && <TH className="text-right">Actions</TH>}
              </tr>
            </THead>
            <TBody>
              {packages.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <p className="font-medium text-ink">{p.name}</p>
                    {p.description && <p className="mt-0.5 max-w-sm truncate text-[13px] text-ink-soft">{p.description}</p>}
                  </TD>
                  <TD className="text-ink-soft">{describeDuration(p.duration_value, p.duration_unit)}</TD>
                  <TD className="tabular text-right font-medium">{formatMoney(p.price, settings.currency)}</TD>
                  <TD className="tabular text-right text-ink-soft">{activeCounts.get(p.id) ?? 0}</TD>
                  <TD>
                    <ActiveBadge active={p.is_active} inactiveLabel="Not available" />
                  </TD>
                  {ctx.isOwner && (
                    <TD>
                      <div className="flex justify-end gap-2">
                        <PackageDialog
                          pkg={p}
                          trigger={
                            <Button variant="ghost" size="sm" aria-label={`Edit ${p.name}`}>
                              <Pencil /> Edit
                            </Button>
                          }
                        />
                        <ConfirmAction
                          trigger={p.is_active ? "Deactivate" : "Activate"}
                          triggerVariant="outline"
                          title={p.is_active ? `Deactivate ${p.name}?` : `Activate ${p.name}?`}
                          description={
                            p.is_active
                              ? "It won't be offered for new memberships. Members who already have it are not affected."
                              : "It will be available again for new memberships and renewals."
                          }
                          confirmLabel={p.is_active ? "Deactivate" : "Activate"}
                          confirmVariant={p.is_active ? "danger" : "primary"}
                          successMessage={p.is_active ? "Package deactivated" : "Package activated"}
                          action={setPackageActive.bind(null, p.id, !p.is_active)}
                        />
                      </div>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Panel>
    </>
  );
}
