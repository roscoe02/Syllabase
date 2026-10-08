import { describe, expect, it } from "vitest";
import { isPrivateIp } from "./ip";

describe("isPrivateIp", () => {
  it("blocks internal addresses in every spelling", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "192.168.0.1", "::1", "::", "fd00::1", "fe80::1",
      "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "::7f00:1", "64:ff9b::7f00:1"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });
  it("allows public addresses", () => {
    for (const ip of ["8.8.8.8", "151.101.1.69", "::ffff:808:808", "2606:4700::1111", "2001:4860:4860::8888"]) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });
});
