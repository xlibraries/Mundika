export type PublicPlanId = "free" | "starter" | "business";

export type PublicPricingPlan = {
  id: PublicPlanId;
  name: string;
  blurb: string;
  priceLabel: string;
  cadenceLabel: string;
  ctaLabel: string;
  features: readonly string[];
  /** Highlight on marketing grid */
  featured?: boolean;
  /** Monthly amount in smallest currency unit when fixed (paise); null = custom / free */
  monthlyAmountPaise: number | null;
};

const PLANS = [
  {
    id: "free",
    name: "Free",
    blurb: "Ek dukan, ek account — shuruat ke liye.",
    priceLabel: "INR 0",
    cadenceLabel: "no monthly charge",
    ctaLabel: "Use free plan",
    features: [
      "Roz ki entries (limit ke saath)",
      "Stock + bill + party khata",
      "Sirf aapka login",
    ],
    monthlyAmountPaise: 0,
  },
  {
    id: "starter",
    name: "Starter",
    blurb: "Chhoti team — teen log tak.",
    priceLabel: "INR 399",
    cadenceLabel: "per month",
    ctaLabel: "Choose starter",
    features: [
      "Teen account / teen log",
      "Roz stock + bill flow",
      "Party khata + basic report",
    ],
    featured: true,
    monthlyAmountPaise: 399_00,
  },
  {
    id: "business",
    name: "Business",
    blurb: "Badi team ya alag zaroorat — baat karke.",
    priceLabel: "Custom",
    cadenceLabel: "contact us",
    ctaLabel: "Contact us",
    features: [
      "Accounts / flow customize",
      "Onboarding + support priority",
      "Terms flexible",
    ],
    monthlyAmountPaise: null,
  },
] as const satisfies readonly PublicPricingPlan[];

export const PUBLIC_PRICING_PLANS: readonly PublicPricingPlan[] = PLANS;

const byId = new Map<PublicPlanId, PublicPricingPlan>(
  PLANS.map((p) => [p.id, p])
);

export function isPublicPlanId(value: string): value is PublicPlanId {
  return byId.has(value as PublicPlanId);
}

export function getPublicPlanById(
  id: string | null | undefined
): PublicPricingPlan | null {
  if (!id) return null;
  const normalized = id.toLowerCase();
  return isPublicPlanId(normalized) ? byId.get(normalized)! : null;
}

export function loginUrlForPlan(planId: PublicPlanId): string {
  return `/login?plan=${planId}`;
}
