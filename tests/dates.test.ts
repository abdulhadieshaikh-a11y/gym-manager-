import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  computeEndDate,
  describeDuration,
  diffDays,
  formatDate,
  isIsoDate,
  monthStart,
  suggestRenewalStart,
  todayInTimeZone,
} from "@/lib/dates";

describe("membership end dates (must match public.compute_end_date)", () => {
  it.each([
    ["2026-01-15", 1, "months", "2026-02-14"],
    ["2026-01-31", 1, "months", "2026-02-27"], // Feb clamps to 28, minus one day
    ["2028-01-31", 1, "months", "2028-02-28"], // leap year
    ["2026-01-01", 3, "months", "2026-03-31"],
    ["2026-01-01", 12, "months", "2026-12-31"],
    ["2026-08-31", 6, "months", "2027-02-27"],
    ["2026-01-01", 30, "days", "2026-01-30"],
    ["2026-12-25", 10, "days", "2027-01-03"],
    ["2028-02-29", 1, "days", "2028-02-29"],
  ] as const)("%s + %i %s ends %s", (start, value, unit, expected) => {
    expect(computeEndDate(start, value, unit)).toBe(expected);
  });
});

describe("date helpers", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("adds months with clamping", () => {
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
  });
  it("diffDays", () => {
    expect(diffDays("2026-01-01", "2026-01-31")).toBe(30);
    expect(diffDays("2026-01-31", "2026-01-01")).toBe(-30);
  });
  it("validates ISO dates strictly", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("26-02-01")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });
  it("uses the gym timezone for 'today'", () => {
    // 2026-10-17 20:30 UTC is already 18 Oct in Karachi (UTC+5)
    const instant = new Date("2026-10-17T20:30:00Z");
    expect(todayInTimeZone("Asia/Karachi", instant)).toBe("2026-10-18");
    expect(todayInTimeZone("UTC", instant)).toBe("2026-10-17");
  });
  it("renewal starts the day after a running membership, otherwise today", () => {
    expect(suggestRenewalStart("2026-10-20", "2026-10-18")).toBe("2026-10-21");
    expect(suggestRenewalStart("2026-10-18", "2026-10-18")).toBe("2026-10-19");
    expect(suggestRenewalStart("2026-10-01", "2026-10-18")).toBe("2026-10-18");
    expect(suggestRenewalStart(null, "2026-10-18")).toBe("2026-10-18");
  });
  it("formats", () => {
    expect(formatDate("2026-10-18")).toBe("18 Oct 2026");
    expect(formatDate(null)).toBe("—");
    expect(monthStart("2026-10-18")).toBe("2026-10-01");
    expect(describeDuration(12, "months")).toBe("1 year");
    expect(describeDuration(3, "months")).toBe("3 months");
    expect(describeDuration(1, "days")).toBe("1 day");
  });
});
