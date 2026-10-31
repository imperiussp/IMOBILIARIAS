/**
 * Pure billing visibility policy. No database updates, deletion, or network calls.
 * Run this only after a trusted backend has resolved the tenant and billing status.
 * Never use this function by itself as a data-access authorization control.
 */
export type BillingVisibility = "full" | "limited" | "suspended";
export type BillingVisibilityInput = {
  dueDate: string | null;
  paid: boolean;
  exempt: boolean;
  nowLocalDate: string;
};
function utcDay(localDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) return null;
  const [year, month, day] = localDate.split("-").map(Number);
  const value = Date.UTC(year, month-1, day);
  const check = new Date(value);
  if(check.getUTCFullYear()!==year || check.getUTCMonth()!==month-1 || check.getUTCDate()!==day) return null;
  return value / 86400000;
}
export function billingVisibility(input: BillingVisibilityInput): BillingVisibility {
  if (input.paid || input.exempt) return "full";
  const due = input.dueDate ? utcDay(input.dueDate.slice(0,10)) : null;
  const today = utcDay(input.nowLocalDate);
  // Unknown due date must be reconciled, never used to block a real tenant.
  if (due === null || today === null) return "full";
  const daysLate=today-due;
  if(daysLate>=5) return "suspended";
  if(daysLate>=2) return "limited";
  return "full";
}
