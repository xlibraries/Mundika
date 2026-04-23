import { describe, expect, it } from "vitest";
import {
  getPublicPlanById,
  isPublicPlanId,
  loginUrlForPlan,
  PUBLIC_PRICING_PLANS,
} from "./plans";

describe("public pricing plans", () => {
  it("exposes three plans with stable ids", () => {
    expect(PUBLIC_PRICING_PLANS.map((p) => p.id)).toEqual([
      "free",
      "starter",
      "business",
    ]);
  });

  it("resolves plan by id case-insensitively", () => {
    expect(getPublicPlanById("STARTER")?.name).toBe("Starter");
    expect(getPublicPlanById("unknown")).toBeNull();
  });

  it("narrows with isPublicPlanId", () => {
    const x = "starter";
    expect(isPublicPlanId(x)).toBe(true);
    if (isPublicPlanId(x)) {
      expect(loginUrlForPlan(x)).toBe("/subscribe?plan=starter");
    }
  });

  it("sends free plan to login", () => {
    expect(loginUrlForPlan("free")).toBe("/login?plan=free");
  });
});
