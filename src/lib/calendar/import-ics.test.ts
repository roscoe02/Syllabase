import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { parseFeed } from "./import-ics";

const ics = (events: string[]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", ...events.flatMap((e) => ["BEGIN:VEVENT", e, "END:VEVENT"]), "END:VCALENDAR"].join("\r\n");

describe("parseFeed", () => {
  it("skips malformed items instead of failing the whole feed", () => {
    const events = parseFeed(ics([
      "UID:event-assignment-1\r\nSUMMARY:Homework 3 [CS 3345.001 - F26]\r\nDTSTART:20261014T170000Z",
      "SUMMARY:No id\r\nDTSTART:20261015T170000Z",
      "UID:event-assignment-2\r\nSUMMARY:No start",
    ]));
    expect(events.map((e) => e.sourceUid)).toEqual(["event-assignment-1"]);
    expect(events[0].courseCode).toBe("CS 3345.001 - F26");
  });
});
