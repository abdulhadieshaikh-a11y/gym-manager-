import { CalendarCheck2, Dumbbell, LayoutDashboard, Layers, Settings, Users, Wallet, type LucideIcon } from "lucide-react";

export const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/members", label: "Members", icon: Users },
  { href: "/packages", label: "Packages", icon: Layers },
  { href: "/fees", label: "Fees & Payments", icon: Wallet },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck2 },
  { href: "/trainers", label: "Trainers", icon: Dumbbell },
  { href: "/settings", label: "Settings", icon: Settings },
];
