import assert from "node:assert/strict";
import { billingVisibility } from "../lib/billingVisibility.ts";

const cases = [
  ["before due", "2026-10-30", "2026-10-29", false, false, "full"],
  ["on due date", "2026-10-29", "2026-10-29", false, false, "full"],
  ["one day late", "2026-10-29", "2026-10-30", false, false, "full"],
  ["two days late", "2026-10-29", "2026-10-31", false, false, "limited"],
  ["four days late", "2026-10-29", "2026-11-02", false, false, "limited"],
  ["five days late", "2026-10-29", "2026-11-03", false, false, "suspended"],
  ["paid after suspension", "2026-10-29", "2026-11-08", true, false, "full"],
  ["explicit exemption", "2026-10-29", "2026-11-08", false, true, "full"],
  ["date missing", null, "2026-11-08", false, false, "full"],
  ["invalid date", "2026-02-30", "2026-11-08", false, false, "full"]
] as const;
for (const [label, dueDate, nowLocalDate, paid, exempt, expected] of cases) {
  assert.equal(billingVisibility({ dueDate, nowLocalDate, paid, exempt }), expected, label);
}
console.log(`${cases.length} billing visibility simulations passed`);
