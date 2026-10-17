"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as D } from "radix-ui";
import { ChevronDown, Dumbbell, KeyRound, LogOut, Menu, X } from "lucide-react";
import { NAV_ITEMS } from "@/components/app/nav-items";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/auth/actions";

type ShellProps = {
  gymName: string;
  logoUrl: string | null;
  userName: string;
  userEmail: string;
  role: "owner" | "staff";
  children: React.ReactNode;
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand({ gymName, logoUrl }: { gymName: string; logoUrl: string | null }) {
  return (
    <Link href="/dashboard" className="flex min-w-0 items-center gap-3 px-2">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded logo from Supabase Storage
        <img src={logoUrl} alt="" className="size-9 shrink-0 rounded-[var(--radius-md)] bg-white object-contain p-0.5" />
      ) : (
        <div className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-md)] bg-brass text-white">
          <Dumbbell className="size-5" aria-hidden />
        </div>
      )}
      <span className="truncate font-display text-[15px] font-semibold text-white">{gymName}</span>
    </Link>
  );
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-[14px] transition-colors",
              active ? "bg-graphite-2 font-medium text-white" : "text-graphite-text hover:bg-graphite-2/60 hover:text-white",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full transition-colors",
                active ? "bg-brass-bright" : "bg-transparent",
              )}
            />
            <Icon className={cn("size-[18px]", active ? "text-brass-bright" : "text-graphite-text group-hover:text-white")} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContents({ gymName, logoUrl, pathname, onNavigate }: { gymName: string; logoUrl: string | null; pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-8 px-3 py-5">
      <Brand gymName={gymName} logoUrl={logoUrl} />
      <NavList pathname={pathname} onNavigate={onNavigate} />
      <p className="mt-auto px-2 text-[12px] leading-relaxed text-graphite-text/70">Gym Manager</p>
    </div>
  );
}

export function AppShell({ gymName, logoUrl, userName, userEmail, role, children }: ShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const current = NAV_ITEMS.find((n) => isActive(pathname, n.href));
  const initials = (userName || userEmail || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 bg-graphite lg:block">
        <SidebarContents gymName={gymName} logoUrl={logoUrl} pathname={pathname} />
      </aside>

      <D.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-40 bg-graphite/50 lg:hidden" />
          <D.Content className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-graphite shadow-xl data-[state=open]:animate-in data-[state=open]:slide-in-from-left lg:hidden">
            <D.Title className="sr-only">Navigation</D.Title>
            <D.Description className="sr-only">Main navigation</D.Description>
            <D.Close className="absolute top-5 right-3 rounded p-1 text-graphite-text hover:text-white" aria-label="Close menu">
              <X className="size-5" />
            </D.Close>
            <SidebarContents gymName={gymName} logoUrl={logoUrl} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </D.Content>
        </D.Portal>
      </D.Root>

      <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6">
        <button
          type="button"
          className="-ml-1 rounded-[var(--radius-md)] p-2 text-ink-soft hover:bg-canvas lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>
        <p className="truncate font-display text-[15px] font-semibold text-ink">{current?.label ?? gymName}</p>
        <div className="ml-auto">
          <Dropdown>
            <DropdownTrigger className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 hover:bg-canvas">
              <span className="grid size-8 place-items-center rounded-full bg-graphite text-[12px] font-semibold text-brass-bright">
                {initials || "?"}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block max-w-40 truncate text-[13px] leading-tight font-medium text-ink">{userName || userEmail}</span>
                <span className="block text-[11.5px] leading-tight text-ink-faint capitalize">{role}</span>
              </span>
              <ChevronDown className="size-4 text-ink-faint" aria-hidden />
            </DropdownTrigger>
            <DropdownContent>
              <DropdownLabel>{userEmail}</DropdownLabel>
              <DropdownSeparator />
              <DropdownItem asChild>
                <Link href="/settings#password">
                  <KeyRound /> Change password
                </Link>
              </DropdownItem>
              <DropdownItem
                onSelect={() => {
                  void signOut();
                }}
              >
                <LogOut /> Log out
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
