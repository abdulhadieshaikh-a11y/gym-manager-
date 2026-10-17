import { Dumbbell } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-graphite p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-[var(--radius-md)] bg-brass text-white">
            <Dumbbell className="size-5" aria-hidden />
          </div>
          <span className="font-display text-lg font-semibold">Gym Manager</span>
        </div>
        <div className="max-w-md">
          <p className="font-display text-[34px] leading-[1.15] font-semibold tracking-tight">
            Members, fees and attendance — kept in one place.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-graphite-text">
            Record payments the moment they happen, see who is due, and check members in at the desk.
          </p>
        </div>
        <div aria-hidden className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full border-[40px] border-graphite-2" />
        <div aria-hidden className="pointer-events-none absolute -right-8 -bottom-8 size-56 rounded-full border border-brass/40" />
        <p className="relative text-[13px] text-graphite-text">Private system — authorised staff only.</p>
      </aside>
      <main className="flex items-center justify-center bg-surface px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
