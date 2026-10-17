"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelHeader } from "@/components/ui/card";
import { CheckInButton } from "@/components/app/check-in-button";
import { MembershipStatusBadge } from "@/components/app/status-badges";
import type { MembershipStatus } from "@/lib/database.types";
import { formatDate } from "@/lib/dates";
import { searchMembersForCheckIn, type CheckInCandidate } from "./actions";

export function CheckInPanel({ isOwner }: { isOwner: boolean }) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<CheckInCandidate[]>([]);
  const [error, setError] = React.useState<string>();
  const [searching, setSearching] = React.useState(false);
  const requestId = React.useRef(0);

  const runSearch = React.useCallback(async (q: string) => {
    const id = ++requestId.current;
    if (q.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const res = await searchMembersForCheckIn(q);
      if (id !== requestId.current) return;
      if (res.ok) {
        setResults(res.data);
        setError(undefined);
      } else setError(res.error);
    } catch {
      if (id === requestId.current) setError("Could not reach the server. Check your connection.");
    } finally {
      if (id === requestId.current) setSearching(false);
    }
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => void runSearch(query), 250);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  return (
    <Panel>
      <PanelHeader title="Check in a member" description="Search by name, member ID or phone, then press Check in." />
      <div className="p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Ali, GM-0012 or 0300…"
            aria-label="Search members to check in"
            className="h-11 pl-9 text-base"
            autoFocus
          />
        </div>
        {error && <p className="mt-3 text-[13px] text-bad">{error}</p>}
      </div>
      {query.trim().length >= 2 && (
        <ul className="divide-y divide-line border-t border-line" aria-live="polite">
          {results.length === 0 && !searching && <li className="px-5 py-6 text-center text-sm text-ink-soft">No members match “{query.trim()}”.</li>}
          {results.length === 0 && searching && <li className="px-5 py-6 text-center text-sm text-ink-faint">Searching…</li>}
          {results.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <Link href={`/members/${m.id}`} className="font-medium text-ink hover:underline">
                  {m.full_name}
                </Link>
                <p className="tabular text-[12.5px] text-ink-faint">
                  {m.member_code} · {m.phone}
                  {m.valid_until ? ` · valid until ${formatDate(m.valid_until)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <MembershipStatusBadge status={m.membership_status as MembershipStatus} expiringSoon={m.expiring_soon} />
                {m.checked_in_today ? (
                  <Badge tone="good">Checked in</Badge>
                ) : m.membership_status === "inactive" ? null : (
                  <CheckInButton
                    memberId={m.id}
                    memberName={m.full_name}
                    isOwner={isOwner}
                    onCheckedIn={() => setResults((rs) => rs.map((r) => (r.id === m.id ? { ...r, checked_in_today: true } : r)))}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
