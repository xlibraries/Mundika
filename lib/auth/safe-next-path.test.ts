import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it("accepts relative app paths", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/analytics#stock")).toBe("/analytics#stock");
    expect(safeNextPath("/dashboard?tx=purchase")).toBe("/dashboard?tx=purchase");
  });

  it("rejects external and protocol-relative paths", () => {
    expect(safeNextPath("https://evil.test")).toBe("/dashboard");
    expect(safeNextPath("//evil.test")).toBe("/dashboard");
    expect(safeNextPath("javascript:alert(1)")).toBe("/dashboard");
  });

  it("rejects backslash variants and missing values", () => {
    expect(safeNextPath("/\\evil")).toBe("/dashboard");
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath("")).toBe("/dashboard");
  });

  it("supports custom fallback", () => {
    expect(safeNextPath("https://evil.test", "/login")).toBe("/login");
  });
});
