import { describe, expect, it } from "vitest";
import { addDaysKey, dateKey, mondayOfKey, zonedToUtc } from "./time";

describe("zonedToUtc", () => {
  it("converts Central daylight time", () => {
    expect(zonedToUtc("2026-10-14", "23:59", "America/Chicago").toISOString()).toBe("2026-10-15T04:59:00.000Z");
  });
  it("converts Central standard time (after DST ends)", () => {
    expect(zonedToUtc("2026-12-01", "09:00", "America/Chicago").toISOString()).toBe("2026-12-01T15:00:00.000Z");
  });
  it("handles the day DST ends", () => {
    expect(zonedToUtc("2026-11-01", "12:00", "America/Chicago").toISOString()).toBe("2026-11-01T18:00:00.000Z");
  });
});

describe("date keys", () => {
  it("reads the local date of a UTC instant", () => {
    expect(dateKey(new Date("2026-10-15T04:59:00Z"), "America/Chicago")).toBe("2026-10-14");
  });
  it("finds Monday and adds days", () => {
    expect(mondayOfKey("2026-10-18")).toBe("2026-10-12"); // Sunday
    expect(mondayOfKey("2026-10-12")).toBe("2026-10-12");
    expect(addDaysKey("2026-12-30", 3)).toBe("2027-01-02");
  });
});
