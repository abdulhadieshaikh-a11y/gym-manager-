import { describe, expect, it } from "vitest";
import { formatMoney, normalizePhone, toPaisa } from "@/lib/format";
import { friendlyError, friendlyAuthError } from "@/lib/errors";
import {
  memberFormSchema,
  moneyField,
  packageFormSchema,
  parseMoney,
  paymentFormSchema,
  settingsFormSchema,
} from "@/lib/validation";

describe("money", () => {
  it("formats PKR", () => {
    const plain = (v: string) => v.replace(/\s/g, " "); // Intl uses a non-breaking space
    expect(plain(formatMoney(3000))).toBe("Rs 3,000");
    expect(plain(formatMoney(1250.5))).toBe("Rs 1,250.50");
    expect(plain(formatMoney(null))).toBe("Rs 0");
  });
  it("parses and avoids float drift", () => {
    expect(parseMoney("1,500.25")).toBe(1500.25);
    expect(toPaisa(0.1) + toPaisa(0.2)).toBe(30);
  });
  it("validates amounts", () => {
    const amount = moneyField("Amount");
    expect(amount.safeParse("100").success).toBe(true);
    expect(amount.safeParse("100.5").success).toBe(true);
    expect(amount.safeParse("100.555").success).toBe(false);
    expect(amount.safeParse("0").success).toBe(false);
    expect(amount.safeParse("-5").success).toBe(false);
    expect(amount.safeParse("abc").success).toBe(false);
    expect(moneyField("Price", { allowZero: true }).safeParse("0").success).toBe(true);
  });
});

describe("phone", () => {
  it("normalizes", () => {
    expect(normalizePhone("0300-123 4567")).toBe("03001234567");
    expect(normalizePhone("+92 300 1234567")).toBe("+923001234567");
  });
});

const validMember = {
  member_code: "",
  full_name: "Ali Khan",
  phone: "0300 1234567",
  email: "",
  joining_date: "2026-10-18",
  notes: "",
  package_id: "",
  start_date: "",
  price: "",
  allow_duplicate_phone: false,
};

describe("member form", () => {
  it("accepts a minimal member", () => {
    expect(memberFormSchema.safeParse(validMember).success).toBe(true);
  });
  it("requires name and a valid phone", () => {
    const r = memberFormSchema.safeParse({ ...validMember, full_name: " ", phone: "12" });
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path.join("."));
    expect(paths).toContain("full_name");
    expect(paths).toContain("phone");
  });
  it("requires start date and price when a package is chosen", () => {
    const r = memberFormSchema.safeParse({ ...validMember, package_id: "8e8a5b8e-4c55-4b8e-9d55-0d1b5c1a2b3c" });
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["start_date", "price"]));
  });
  it("rejects invalid member IDs and emails", () => {
    expect(memberFormSchema.safeParse({ ...validMember, member_code: "GM 01!" }).success).toBe(false);
    expect(memberFormSchema.safeParse({ ...validMember, email: "not-an-email" }).success).toBe(false);
  });
});

describe("package form", () => {
  const base = { name: "Monthly", duration_value: "1", duration_unit: "months" as const, price: "3000", description: "", is_active: true };
  it("accepts valid packages", () => expect(packageFormSchema.safeParse(base).success).toBe(true));
  it("rejects bad durations and prices", () => {
    expect(packageFormSchema.safeParse({ ...base, duration_value: "0" }).success).toBe(false);
    expect(packageFormSchema.safeParse({ ...base, duration_value: "121" }).success).toBe(false);
    expect(packageFormSchema.safeParse({ ...base, duration_unit: "days", duration_value: "400" }).success).toBe(true);
    expect(packageFormSchema.safeParse({ ...base, price: "-1" }).success).toBe(false);
  });
});

describe("payment form", () => {
  const base = {
    invoice_id: "8e8a5b8e-4c55-4b8e-9d55-0d1b5c1a2b3c",
    amount: "1000",
    method: "easypaisa" as const,
    payment_date: "2026-10-18",
    reference: "",
    notes: "",
    idempotency_key: "1b4e28ba-2fa1-4d3b-a3f5-ef19b5a7633b",
  };
  it("accepts a valid payment", () => expect(paymentFormSchema.safeParse(base).success).toBe(true));
  it("rejects unknown methods, zero amounts and missing keys", () => {
    expect(paymentFormSchema.safeParse({ ...base, method: "bitcoin" }).success).toBe(false);
    expect(paymentFormSchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
    expect(paymentFormSchema.safeParse({ ...base, idempotency_key: "" }).success).toBe(false);
  });
});

describe("settings form", () => {
  it("validates warning days and currency", () => {
    const base = {
      gym_name: "Iron Temple",
      contact_phone: "",
      email: "",
      address: "",
      currency: "PKR",
      timezone: "Asia/Karachi",
      expiry_warning_days: "7",
      receipt_footer: "",
    };
    expect(settingsFormSchema.safeParse(base).success).toBe(true);
    expect(settingsFormSchema.safeParse({ ...base, expiry_warning_days: "0" }).success).toBe(false);
    expect(settingsFormSchema.safeParse({ ...base, currency: "RUPEES" }).success).toBe(false);
  });
});

describe("error messages", () => {
  it("maps database rule errors to friendly text", () => {
    expect(friendlyError({ message: "AMOUNT_EXCEEDS_BALANCE" })).toMatch(/more than the remaining balance/);
    expect(friendlyError({ message: "ALREADY_CHECKED_IN", code: "23505" })).toMatch(/already checked in/);
    expect(friendlyError({ message: 'duplicate key value violates unique constraint "packages_name_unique"', code: "23505" })).toMatch(/name already exists/);
    expect(friendlyError({ message: "new row violates row-level security policy", code: "42501" })).toMatch(/permission/);
  });
  it("never leaks raw database messages", () => {
    const msg = friendlyError({ message: 'relation "public.secret" does not exist', code: "42P01" });
    expect(msg).not.toMatch(/relation|public/);
  });
  it("maps auth errors", () => {
    expect(friendlyAuthError({ message: "Invalid login credentials" })).toBe("Incorrect email or password.");
  });
});
