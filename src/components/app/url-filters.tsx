"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input, NativeSelect } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function useSetParam() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const setParams = React.useCallback(
    (updates: Record<string, string | null>) => {
      const sp = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => (v ? sp.set(k, v) : sp.delete(k)));
      sp.delete("page");
      const qs = sp.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [router, pathname, searchParams],
  );
  return { setParams, isPending, searchParams };
}

export function SearchBox({ placeholder, param = "q", className }: { placeholder: string; param?: string; className?: string }) {
  const { setParams, isPending, searchParams } = useSetParam();
  const initial = searchParams.get(param) ?? "";
  const [value, setValue] = React.useState(initial);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onChange = (v: string) => {
    setValue(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setParams({ [param]: v.trim() || null }), 350);
  };

  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn("pl-9", value && "pr-8", isPending && "opacity-80")}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-ink-faint hover:text-ink"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

export function SelectFilter({
  param,
  label,
  options,
  className,
}: {
  param: string;
  label: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const { setParams, searchParams } = useSetParam();
  return (
    <NativeSelect
      aria-label={label}
      value={searchParams.get(param) ?? ""}
      onChange={(e) => setParams({ [param]: e.target.value || null })}
      className={cn("w-full sm:w-44", className)}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </NativeSelect>
  );
}

export function DateFilter({ param, label, className, fallback }: { param: string; label: string; className?: string; fallback?: string }) {
  const { setParams, searchParams } = useSetParam();
  return (
    <label className={cn("flex items-center gap-2 text-[13px] text-ink-soft", className)}>
      <span className="whitespace-nowrap">{label}</span>
      <Input
        type="date"
        value={searchParams.get(param) ?? fallback ?? ""}
        onChange={(e) => setParams({ [param]: e.target.value || null })}
        className="w-auto"
      />
    </label>
  );
}

export function TabLinks({
  param,
  tabs,
}: {
  param: string;
  tabs: { value: string; label: string; count?: number }[];
}) {
  const { setParams, searchParams } = useSetParam();
  const current = searchParams.get(param) ?? tabs[0]?.value ?? "";
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line px-3">
      {tabs.map((t) => {
        const active = current === t.value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => {
              const updates: Record<string, string | null> = { [param]: t.value === tabs[0]?.value ? null : t.value };
              setParams(updates);
            }}
            className={cn(
              "relative -mb-px flex items-center gap-2 border-b-2 px-3 py-3 text-sm whitespace-nowrap transition-colors",
              active ? "border-brass font-medium text-ink" : "border-transparent text-ink-soft hover:text-ink",
            )}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span className="tabular rounded-full bg-canvas px-1.5 text-[11.5px] text-ink-soft">{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
