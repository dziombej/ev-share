import { describe, expect, it } from "vitest";
import { logSessionSchema } from "@/lib/validation/session";

// PRD FR-007 acceptance criteria: "A session cannot be logged for zero or
// negative kWh." Mirrors the DB check constraint `kwh > 0 and kwh <= 500`
// (supabase/migrations/20260815120000_create_charging_sessions.sql).
const validBase = {
  pocId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  seekerId: "550e8400-e29b-41d4-a716-446655440000",
  seekerEmail: "seeker@example.com",
};

describe("logSessionSchema — kwh guardrail", () => {
  it("accepts a valid kwh value and coerces it to a number", () => {
    const result = logSessionSchema.safeParse({ ...validBase, kwh: "7.25" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kwh).toBe(7.25);
    }
  });

  it.each<[string, string | null]>([
    ["zero", "0"],
    ["negative", "-5"],
    ["non-numeric string", "abc"],
    ["missing (form field absent, read as null)", null],
    ["over the 500 kWh cap", "600"],
    // zod v4's z.coerce.number() rejects Infinity in its own base check
    // (finite-by-default) — see research.md's Follow-up Research. Assert
    // only that parsing fails, not which internal rule caught it.
    ["non-finite", "Infinity"],
  ])("rejects %s kwh", (_label, kwhValue) => {
    const result = logSessionSchema.safeParse({ ...validBase, kwh: kwhValue });

    expect(result.success).toBe(false);
  });
});
