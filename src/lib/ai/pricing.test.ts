import { describe, expect, it } from "vitest";
import { billableUsage } from "./pricing";

describe("billableUsage", () => {
  it("leaves normal requests alone", () => {
    expect(billableUsage({ input: 40_000, output: 2_000, cacheRead: 50_000, cacheWrite: 0 })).toEqual({ input: 40_000, output: 2_000, cacheRead: 50_000, cacheWrite: 0 });
  });
  it("counts long-context requests at 5x, cached tokens included", () => {
    expect(billableUsage({ input: 90_000, output: 1_000, cacheRead: 20_000, cacheWrite: 0 })).toEqual({ input: 450_000, output: 5_000, cacheRead: 100_000, cacheWrite: 0 });
  });
});
