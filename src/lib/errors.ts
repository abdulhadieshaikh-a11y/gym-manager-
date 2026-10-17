/**
 * Maps database / auth errors to clear, non-technical messages.
 * Never returns raw SQL, stack traces or internal details to the user.
 */
const MESSAGES: Record<string, string> = {
  NOT_AUTHORIZED: "Your account does not have access to this gym. Please contact the owner.",
  OWNER_ONLY: "Only the gym owner can do this.",
  MEMBER_NOT_FOUND: "That member could not be found. It may have been removed.",
  MEMBER_INACTIVE: "This member is deactivated. Reactivate the member first.",
  MEMBER_HAS_HISTORY: "This member has payment, membership or attendance history and cannot be deleted. Deactivate the member instead.",
  DUPLICATE_MEMBER_CODE: "That member ID is already in use. Choose a different ID or leave it blank to generate one.",
  JOINING_DATE_REQUIRED: "Joining date is required.",
  PACKAGE_NOT_FOUND: "That package could not be found.",
  PACKAGE_INACTIVE: "That package is inactive and cannot be assigned. Choose an active package.",
  START_DATE_REQUIRED: "Start date is required.",
  START_DATE_OUT_OF_RANGE: "The start date must be within one year of today.",
  INVALID_PRICE: "Enter a valid price.",
  MEMBERSHIP_OVERLAP: "These dates overlap an existing membership. Start the renewal after the current membership ends.",
  MEMBERSHIP_NOT_FOUND: "That membership could not be found.",
  ALREADY_CANCELLED: "This membership is already cancelled.",
  HAS_PAYMENTS: "Payments have been recorded against this. Void those payments first (with a reason).",
  REASON_REQUIRED: "Please enter a reason (at least 3 characters).",
  INVOICE_NOT_FOUND: "That fee record could not be found.",
  INVOICE_VOID: "This fee record has been voided.",
  INVOICE_ALREADY_PAID: "This fee is already fully paid.",
  INVALID_AMOUNT: "Enter an amount greater than zero (maximum 2 decimal places).",
  AMOUNT_EXCEEDS_BALANCE: "The amount is more than the remaining balance.",
  INVALID_METHOD: "Choose a valid payment method.",
  PAYMENT_DATE_IN_FUTURE: "The payment date cannot be in the future.",
  PAYMENT_DATE_TOO_OLD: "The payment date cannot be more than one year ago.",
  IDEMPOTENCY_KEY_REQUIRED: "Something went wrong preparing this payment. Please reload the page and try again.",
  DESCRIPTION_REQUIRED: "Description is required.",
  DUE_DATE_REQUIRED: "Due date is required.",
  PAYMENT_NOT_FOUND: "That payment could not be found.",
  ALREADY_VOID: "This payment has already been voided.",
  ALREADY_CHECKED_IN: "This member has already checked in today.",
  MEMBERSHIP_NOT_VALID: "This member does not have a valid membership today.",
  OVERRIDE_REQUIRES_OWNER: "Only the owner can check in a member without a valid membership.",
  OVERRIDE_REASON_REQUIRED: "Please enter a reason for allowing this check-in.",
  CHECK_OUT_NOT_POSSIBLE: "This member has already checked out.",
  ATTENDANCE_NOT_FOUND: "That attendance record could not be found.",
};

type ErrorLike = { message?: string; code?: string; details?: string | null } | null | undefined;

export function errorCode(error: ErrorLike): string | null {
  const msg = error?.message ?? "";
  const match = msg.match(/\b([A-Z][A-Z_]{3,})\b/);
  if (match && MESSAGES[match[1]]) return match[1];
  return null;
}

export function friendlyError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const e = (error ?? {}) as { message?: string; code?: string };
  const code = errorCode(e);
  if (code) return MESSAGES[code];

  const msg = e.message ?? "";
  if (e.code === "23505" || msg.includes("duplicate key")) {
    if (msg.includes("packages_name_unique")) return "A package with this name already exists.";
    if (msg.includes("members_code_unique")) return MESSAGES.DUPLICATE_MEMBER_CODE;
    return "This record already exists.";
  }
  if (e.code === "23514" || msg.includes("check constraint")) return "Some of the values are not valid. Please review the form.";
  if (e.code === "42501" || msg.includes("row-level security") || msg.includes("permission denied")) {
    return "You do not have permission to do this.";
  }
  if (e.code === "PGRST301" || msg.toLowerCase().includes("jwt")) return "Your session has expired. Please log in again.";
  if (msg.toLowerCase().includes("fetch failed") || msg.toLowerCase().includes("network")) {
    return "Could not reach the database. Check your internet connection and try again.";
  }
  if (msg.includes("Invalid timezone")) return "That timezone is not valid.";
  return fallback;
}

export function friendlyAuthError(error: unknown): string {
  const msg = ((error as { message?: string })?.message ?? "").toLowerCase();
  if (msg.includes("invalid login credentials")) return "Incorrect email or password.";
  if (msg.includes("email not confirmed")) return "This email address has not been confirmed yet.";
  if (msg.includes("rate limit") || msg.includes("too many")) return "Too many attempts. Please wait a few minutes and try again.";
  if (msg.includes("password should be") || msg.includes("weak")) return "Please choose a stronger password (at least 8 characters).";
  if (msg.includes("same password") || msg.includes("different from the old")) return "The new password must be different from the current one.";
  if (msg.includes("fetch failed") || msg.includes("network")) return "Could not reach the login service. Check your internet connection.";
  return "Could not complete the request. Please try again.";
}
