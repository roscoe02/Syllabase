import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Flashcards, Quiz } from "./outputs";
import { PRESETS } from "./presets";

describe("study outputs", () => {
  it("stay under the structured-output union limit", () => {
    for (const schema of [Flashcards, Quiz]) {
      const json = JSON.stringify(z.toJSONSchema(schema));
      expect((json.match(/"anyOf"/g) ?? []).length + (json.match(/"type":\[/g) ?? []).length).toBeLessThanOrEqual(16);
    }
  });
  it("cover every preset that asks for a structured result", () => {
    const structured = PRESETS.filter((p) => p.mode === "one-shot" && p.output && p.output !== "plan").map((p) => p.output);
    expect(new Set(structured)).toEqual(new Set(["flashcards", "quiz"]));
  });
});
