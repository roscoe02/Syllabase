import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: () => {} }));
import { pickProfessor } from "./rmp";

const node = (firstName: string, lastName: string, numRatings: number) => ({
  firstName, lastName, numRatings, legacyId: numRatings, department: "", avgRating: 4, avgDifficulty: 3, wouldTakeAgainPercent: 80,
});

describe("pickProfessor", () => {
  it("only accepts the same person, then the profile with the most ratings", () => {
    const nodes = [node("John", "Smith", 300), node("Jane", "Smith", 12), node("Jane", "Smith", 40), node("Jane", "Smithson", 99)];
    expect(pickProfessor(nodes, "Dr. Jane Smith")?.numRatings).toBe(40);
    expect(pickProfessor(nodes, "Dr. A. Example")).toBeNull();
  });
});
