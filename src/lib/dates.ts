/**
 * Date helpers. All "calendar dates" are plain YYYY-MM-DD strings interpreted
 * in the gym's timezone (from Settings, default Asia/Karachi). The database is
 * the source of truth (public.gym_today / public.compute_end_date); these
 * helpers mirror it for previews and display.
 */

export const DEFAULT_TIMEZONE = "Asia/Karachi";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function toUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today's date in the given IANA timezone, as YYYY-MM-DD. */
export function todayInTimeZone(timeZone: string = DEFAULT_TIMEZONE, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIMEZONE }).format(now);
  }
}

export function addDays(date: string, days: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** Adds calendar months, clamping to the last day of the month (like PostgreSQL). */
export function addMonths(date: string, months: number): string {
  const d = toUtc(date);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + months;
  const day = d.getUTCDate();
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return fromUtc(new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay))));
}

/** Inclusive membership end date — mirrors public.compute_end_date(). */
export function computeEndDate(start: string, value: number, unit: "days" | "months"): string {
  if (unit === "days") return addDays(start, value - 1);
  return addDays(addMonths(start, value), -1);
}

/** Whole days from a to b (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

/**
 * Default start date for a renewal: the day after the current membership ends
 * if it is still running (no gap, no overlap), otherwise today.
 */
export function suggestRenewalStart(validUntil: string | null, today: string): string {
  if (validUntil && validUntil >= today) return addDays(validUntil, 1);
  return today;
}

export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "18 Oct 2026" for a YYYY-MM-DD string. */
export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  const d = toUtc(date.slice(0, 10));
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
}

/** "18 Oct 2026, 7:05 pm" for a timestamp, shown in the gym's timezone. */
export function formatDateTime(ts: string | null | undefined, timeZone: string = DEFAULT_TIMEZONE): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(d);
}

/** "7:05 pm" in the gym's timezone. */
export function formatTime(ts: string | null | undefined, timeZone: string = DEFAULT_TIMEZONE): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone }).format(d);
}

/** "Oct 2026" for "2026-10". */
export function formatMonth(ym: string): string {
  const d = toUtc(`${ym}-01`);
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}

export function describeDuration(value: number, unit: "days" | "months"): string {
  if (unit === "months") {
    if (value === 12) return "1 year";
    if (value % 12 === 0) return `${value / 12} years`;
    return value === 1 ? "1 month" : `${value} months`;
  }
  return value === 1 ? "1 day" : `${value} days`;
}
