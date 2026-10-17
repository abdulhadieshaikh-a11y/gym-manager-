import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { normalizePhone } from "@/lib/format";

/*
 * Form schemas work on the raw string values from inputs, so the same schema
 * validates in the browser (react-hook-form) and again on the server (server
 * actions). Conversions to numbers / nulls happen in the server actions.
 */

const required = (label: string, max = 120) =>
  z
    .string()
    .trim()
    .min(1, { error: `${label} is required` })
    .max(max, { error: `${label} must be ${max} characters or fewer` });

const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} must be ${max} characters or fewer` });

export const phoneField = z
  .string()
  .trim()
  .min(1, { error: "Phone number is required" })
  .refine((v) => /^\+?[0-9]{7,15}$/.test(normalizePhone(v)), {
    error: "Enter a valid phone number, e.g. 03001234567",
  });

export const optionalEmail = z
  .string()
  .trim()
  .max(254)
  .refine((v) => v === "" || z.email().safeParse(v).success, { error: "Enter a valid email address" });

export const dateField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, { error: `${label} is required` })
    .refine(isIsoDate, { error: `${label} is not a valid date` });

export const optionalDate = (label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || isIsoDate(v), { error: `${label} is not a valid date` });

export const moneyField = (label: string, { allowZero = false } = {}) =>
  z
    .string()
    .trim()
    .min(1, { error: `${label} is required` })
    .refine((v) => /^\d{1,9}(\.\d{1,2})?$/.test(v.replace(/,/g, "")), {
      error: `${label} must be a number with up to 2 decimals`,
    })
    .refine((v) => (allowZero ? Number(v.replace(/,/g, "")) >= 0 : Number(v.replace(/,/g, "")) > 0), {
      error: allowZero ? `${label} cannot be negative` : `${label} must be greater than zero`,
    });

export const uuidField = (label: string) => z.string().uuid({ error: `${label} is required` });

/** Converts a validated money string to a number with 2 decimals. */
export function parseMoney(value: string): number {
  return Math.round(Number(value.replace(/,/g, "")) * 100) / 100;
}

export function emptyToNull(value: string | undefined | null): string | null {
  const v = (value ?? "").trim();
  return v === "" ? null : v;
}

// ---------------------------------------------------------------- members
export const memberCodeField = z
  .string()
  .trim()
  .max(20, { error: "Member ID must be 20 characters or fewer" })
  .refine((v) => v === "" || /^[A-Za-z0-9-]+$/.test(v), {
    error: "Member ID can contain only letters, numbers and dashes",
  });

export const memberFormSchema = z
  .object({
    member_code: memberCodeField,
    full_name: required("Full name"),
    phone: phoneField,
    email: optionalEmail,
    joining_date: dateField("Joining date"),
    notes: optionalText("Notes", 1000),
    package_id: z.string(),
    start_date: optionalDate("Start date"),
    price: z.string().trim(),
    allow_duplicate_phone: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.package_id) {
      if (!v.start_date) ctx.addIssue({ code: "custom", path: ["start_date"], message: "Start date is required" });
      const price = moneyField("Price", { allowZero: true }).safeParse(v.price);
      if (!price.success) {
        ctx.addIssue({ code: "custom", path: ["price"], message: price.error.issues[0]?.message ?? "Invalid price" });
      }
    }
  });
export type MemberFormValues = z.infer<typeof memberFormSchema>;

export const memberUpdateSchema = z.object({
  member_code: z
    .string()
    .trim()
    .min(1, { error: "Member ID is required" })
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, { error: "Member ID can contain only letters, numbers and dashes" }),
  full_name: required("Full name"),
  phone: phoneField,
  email: optionalEmail,
  joining_date: dateField("Joining date"),
  notes: optionalText("Notes", 1000),
  allow_duplicate_phone: z.boolean(),
});
export type MemberUpdateValues = z.infer<typeof memberUpdateSchema>;

export const assignMembershipSchema = z.object({
  member_id: uuidField("Member"),
  package_id: uuidField("Package"),
  start_date: dateField("Start date"),
  price: moneyField("Price", { allowZero: true }),
  notes: optionalText("Notes", 500),
});
export type AssignMembershipValues = z.infer<typeof assignMembershipSchema>;

export const reasonSchema = z
  .string()
  .trim()
  .min(3, { error: "Please enter a reason (at least 3 characters)" })
  .max(300, { error: "Reason must be 300 characters or fewer" });

// --------------------------------------------------------------- packages
export const packageFormSchema = z
  .object({
    name: required("Package name", 80),
    duration_value: z
      .string()
      .trim()
      .regex(/^\d+$/, { error: "Duration must be a whole number" })
      .refine((v) => Number(v) >= 1, { error: "Duration must be at least 1" }),
    duration_unit: z.enum(["days", "months"]),
    price: moneyField("Price", { allowZero: true }),
    description: optionalText("Description", 500),
    is_active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const n = Number(v.duration_value);
    if (v.duration_unit === "months" && n > 120) {
      ctx.addIssue({ code: "custom", path: ["duration_value"], message: "Maximum is 120 months" });
    }
    if (v.duration_unit === "days" && n > 3650) {
      ctx.addIssue({ code: "custom", path: ["duration_value"], message: "Maximum is 3650 days" });
    }
  });
export type PackageFormValues = z.infer<typeof packageFormSchema>;

// --------------------------------------------------------------- trainers
export const trainerFormSchema = z.object({
  full_name: required("Full name"),
  phone: phoneField,
  email: optionalEmail,
  specialization: optionalText("Specialization", 120),
  joining_date: dateField("Joining date"),
  notes: optionalText("Notes", 1000),
  is_active: z.boolean(),
});
export type TrainerFormValues = z.infer<typeof trainerFormSchema>;

// ---------------------------------------------------------------- payments
export const PAYMENT_METHOD_VALUES = ["cash", "bank_transfer", "easypaisa", "jazzcash", "other"] as const;

export const paymentFormSchema = z.object({
  invoice_id: uuidField("Fee record"),
  amount: moneyField("Amount"),
  method: z.enum(PAYMENT_METHOD_VALUES, { error: "Choose a payment method" }),
  payment_date: dateField("Payment date"),
  reference: optionalText("Reference", 120),
  notes: optionalText("Notes", 500),
  idempotency_key: z.string().uuid(),
});
export type PaymentFormValues = z.infer<typeof paymentFormSchema>;

export const invoiceFormSchema = z.object({
  member_id: uuidField("Member"),
  description: required("Description", 200),
  amount: moneyField("Amount"),
  due_date: dateField("Due date"),
});
export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

// ---------------------------------------------------------------- settings
export const settingsFormSchema = z.object({
  gym_name: required("Gym name", 120),
  contact_phone: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\+?[0-9]{7,15}$/.test(normalizePhone(v)), { error: "Enter a valid phone number" }),
  email: optionalEmail,
  address: optionalText("Address", 300),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, { error: "Use a 3-letter currency code, e.g. PKR" }),
  timezone: z.string().trim().min(1, { error: "Timezone is required" }),
  expiry_warning_days: z
    .string()
    .trim()
    .regex(/^\d+$/, { error: "Enter a whole number" })
    .refine((v) => Number(v) >= 1 && Number(v) <= 60, { error: "Must be between 1 and 60 days" }),
  receipt_footer: optionalText("Receipt note", 300),
});
export type SettingsFormValues = z.infer<typeof settingsFormSchema>;

// -------------------------------------------------------------------- auth
export const loginSchema = z.object({
  email: z.string().trim().min(1, { error: "Email is required" }).pipe(z.email({ error: "Enter a valid email address" })),
  password: z.string().min(1, { error: "Password is required" }),
});

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, { error: "Use at least 8 characters" })
      .max(72, { error: "Use 72 characters or fewer" }),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], error: "Passwords do not match" });
