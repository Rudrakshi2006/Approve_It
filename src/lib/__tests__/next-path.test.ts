import { describe, expect, it } from "vitest";
import { safeNextPath, withSynced } from "../next-path";

describe("safeNextPath", () => {
  it("keeps in-app paths with their query", () => {
    expect(safeNextPath("/admin/sync")).toBe("/admin/sync");
    expect(safeNextPath("/admin/people?filter=test")).toBe("/admin/people?filter=test");
  });

  it("refuses anything that could leave ApproveIt or loop through auth", () => {
    for (const bad of [
      null,
      "",
      "admin/sync",
      "//evil.com",
      "/\\evil.com",
      "https://evil.com",
      "/a\\b",
      "/auth/login",
      "/auth",
      "/x\u0000y",
      "/" + "a".repeat(600),
    ]) {
      expect(safeNextPath(bad as string | null)).toBeNull();
    }
  });
});

describe("withSynced", () => {
  it("adds synced=1 so the proxy does not start another round trip", () => {
    expect(withSynced("/admin/sync")).toBe("/admin/sync?synced=1");
    expect(withSynced("/admin/people?x=1")).toBe("/admin/people?x=1&synced=1");
    expect(withSynced("/inbox#top")).toBe("/inbox?synced=1#top");
  });
});
