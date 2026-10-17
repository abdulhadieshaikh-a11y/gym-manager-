import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-[60dvh] place-items-center px-4 text-center">
      <div>
        <p className="font-display text-5xl font-bold text-brass">404</p>
        <h1 className="mt-2 text-lg font-bold">Page not found</h1>
        <p className="mt-1 text-sm text-ink-soft">The record may have been removed, or the link is wrong.</p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
