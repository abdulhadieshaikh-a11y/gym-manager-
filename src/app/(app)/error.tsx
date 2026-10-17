"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Panel className="mx-auto mt-10 max-w-lg p-8 text-center">
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-bad-soft text-bad">
        <AlertTriangle className="size-6" aria-hidden />
      </div>
      <h1 className="text-lg font-bold">This page couldn&apos;t load</h1>
      <p className="mt-2 text-sm text-ink-soft">
        The database may be unreachable or your session may have expired. Check your internet connection, then try again. Your saved data is not affected.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button variant="outline" asChild>
          <Link href="/login">Log in again</Link>
        </Button>
        <Button onClick={reset}>Try again</Button>
      </div>
    </Panel>
  );
}
