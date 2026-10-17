import type { Metadata } from "next";
import { Settings2 } from "lucide-react";
import { getSupabaseEnv } from "@/lib/env";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Setup required" };
export const dynamic = "force-dynamic";

export default function SetupRequiredPage() {
  if (getSupabaseEnv()) redirect("/login");
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-lg">
        <div className="mb-4 grid size-12 place-items-center rounded-full bg-brass-soft text-brass-strong">
          <Settings2 className="size-6" aria-hidden />
        </div>
        <h1 className="text-xl font-bold">Connect the database to continue</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          The app can&apos;t find its Supabase settings. Create a file named <code className="rounded bg-canvas px-1">.env.local</code> in
          the project folder (copy <code className="rounded bg-canvas px-1">.env.example</code>), fill in{" "}
          <code className="rounded bg-canvas px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="rounded bg-canvas px-1">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>, then restart the server. On Vercel,
          add them under Project → Settings → Environment Variables and redeploy.
        </p>
        <p className="mt-3 text-sm text-ink-soft">Full steps are in <code className="rounded bg-canvas px-1">docs/SUPABASE_SETUP.md</code>.</p>
      </div>
    </main>
  );
}
