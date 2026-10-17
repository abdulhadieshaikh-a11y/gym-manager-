import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/auth/actions";
import { getAuthContext } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "No access" };

export default async function NoAccessPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (ctx.profile?.is_active) redirect("/dashboard");
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-warn-soft text-warn">
          <ShieldAlert className="size-6" aria-hidden />
        </div>
        <h1 className="text-xl font-bold">This account doesn&apos;t have access</h1>
        <p className="mt-2 text-sm text-ink-soft">
          You are signed in as <span className="font-medium text-ink">{ctx.email || "this user"}</span>, but the account
          hasn&apos;t been given access to the gym, or access was removed. Ask the gym owner to grant access.
        </p>
        <form action={signOut} className="mt-6">
          <Button type="submit" variant="outline">
            Log out
          </Button>
        </form>
      </div>
    </main>
  );
}
