import { AppShell } from "@/components/app/app-shell";
import { getGymSettings, logoUrl, requireGymUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireGymUser();
  const settings = await getGymSettings();
  return (
    <AppShell
      gymName={settings.gym_name}
      logoUrl={logoUrl(settings)}
      userName={ctx.profile.full_name}
      userEmail={ctx.email}
      role={ctx.profile.role}
    >
      {children}
    </AppShell>
  );
}
