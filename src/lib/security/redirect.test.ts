import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirect";

const origin = "https://syllabase.vercel.app";

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/courses/new?x=1", origin)).toBe("/courses/new?x=1");
    expect(safeNextPath(null, origin)).toBe("/dashboard");
  });
  it("rejects other sites", () => {
    for (const next of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)"]) {
      expect(safeNextPath(next, origin)).toBe("/dashboard");
    }
  });
});
