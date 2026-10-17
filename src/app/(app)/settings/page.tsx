import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getGymSettings, logoUrl, requireGymUser } from "@/lib/auth";
import { ResetPasswordForm } from "@/app/(auth)/reset-password/form";
import { SettingsForm } from "./settings-form";
import { LogoUploader } from "./logo-uploader";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireGymUser();
  const settings = await getGymSettings();
  const readOnly = !ctx.isOwner;
  let timezones: string[] = [];
  try {
    timezones = Intl.supportedValuesOf("timeZone");
  } catch {
    timezones = [];
  }
  const { data: team } = ctx.isOwner ? await ctx.supabase.from("profiles").select("*").order("role") : { data: null };

  return (
    <>
      <PageHeader title="Settings" description={readOnly ? "Only the owner can change gym settings." : "Gym details used across the app and on receipts."} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-6">
          <Panel>
            <PanelHeader title="Gym details" />
            <PanelBody className="flex flex-col gap-6">
              <LogoUploader currentUrl={logoUrl(settings)} readOnly={readOnly} />
              <SettingsForm settings={settings} timezones={timezones} readOnly={readOnly} />
            </PanelBody>
          </Panel>
        </div>
        <div className="flex flex-col gap-6">
          <Panel id="password">
            <PanelHeader title="Your account" description={ctx.email} />
            <PanelBody>
              <p className="mb-4 text-[13px] text-ink-soft">
                Signed in as <span className="font-medium text-ink capitalize">{ctx.profile.role}</span>. Never share your password — each person
                should have their own login.
              </p>
              <ResetPasswordForm redirectTo={null} submitLabel="Change password" />
            </PanelBody>
          </Panel>
          {team && (
            <Panel>
              <PanelHeader title="People with access" description="Added from the Supabase dashboard — see the owner guide." />
              <ul className="divide-y divide-line">
                {team.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span className="truncate text-ink">{p.full_name || (p.id === ctx.userId ? ctx.email : "Unnamed user")}</span>
                    <span className="flex gap-1.5">
                      <Badge tone={p.role === "owner" ? "brass" : "info"} dot={false} className="capitalize">
                        {p.role}
                      </Badge>
                      {!p.is_active && <Badge tone="neutral">No access</Badge>}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
