import { describe, expect, it } from "vitest";
import { normalizeIndiaMobileE164 } from "./phone-e164";

describe("normalizeIndiaMobileE164", () => {
  it("accepts 10-digit mobile", () => {
    expect(normalizeIndiaMobileE164("9876543210")).toBe("+919876543210");
  });

  it("accepts +91 prefix", () => {
    expect(normalizeIndiaMobileE164("+91 98765 43210")).toBe("+919876543210");
  });

  it("rejects invalid first digit", () => {
    expect(normalizeIndiaMobileE164("5876543210")).toBeNull();
  });

  it("rejects garbage", () => {
    expect(normalizeIndiaMobileE164("abc")).toBeNull();
  });
});
