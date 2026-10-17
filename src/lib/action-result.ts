export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string, extra?: { code?: string; fieldErrors?: Record<string, string> }): ActionResult<never> {
  return { ok: false, error, ...extra };
}

/** Flattens zod issues into { field: message }. */
export function zodFieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export const NOT_SIGNED_IN = "Your session has expired. Please log in again.";
export const OWNER_ONLY = "Only the gym owner can do this.";
