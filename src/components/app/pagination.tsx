import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const PAGE_SIZE = 20;

export function pageFromParam(value: string): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10_000) : 1;
}

export function Pagination({
  page,
  total,
  pageSize = PAGE_SIZE,
  basePath,
  params,
}: {
  page: number;
  total: number;
  pageSize?: number;
  basePath: string;
  params: Record<string, string>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const href = (p: number) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && sp.set(k, v));
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const linkClass = "inline-flex h-8 items-center gap-1 rounded-[var(--radius-md)] border border-line-strong bg-surface px-2.5 text-[13px] text-ink hover:bg-canvas";
  const disabled = "pointer-events-none opacity-40";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-[13px] text-ink-soft">
      <span className="tabular">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Link href={href(page - 1)} className={cn(linkClass, page <= 1 && disabled)} aria-disabled={page <= 1} scroll={false}>
          <ChevronLeft className="size-4" aria-hidden /> Previous
        </Link>
        <span className="tabular">
          Page {page} of {pages}
        </span>
        <Link href={href(page + 1)} className={cn(linkClass, page >= pages && disabled)} aria-disabled={page >= pages} scroll={false}>
          Next <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
