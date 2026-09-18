export type PlanId = "free" | "pro" | "pro_plus" | "pro_max";

// Edit only these values to change how many pin credits each plan grants.
// Prices below remain fixed to the Razorpay plans already created.
export const PLAN_CREDITS = {
  free: 20,
  pro: 10_000,
  pro_plus: 100_000,
  pro_max: 1_000_000,
} as const;

// These prices must match the Razorpay Plan IDs configured in .env.local.
export const PLAN_PRICES_INR = {
  free: 0,
  pro: 99,
  pro_plus: 499,
  pro_max: 999,
  trial: 9,
} as const;

export const AI_CREDITS_LABEL = "Coming soon";

export interface PlanConfig {
  id: PlanId;
  name: string;
  priceInr: number;
  pinCredits: number;
  description: string;
  razorpayPlanEnv: string | null;
  featured?: boolean;
}

export const PLANS: PlanConfig[] = [
  {
    id: "free",
    name: "Free",
    priceInr: PLAN_PRICES_INR.free,
    pinCredits: PLAN_CREDITS.free,
    description: "For trying the pin workflow.",
    razorpayPlanEnv: null,
  },
  {
    id: "pro",
    name: "Pro",
    priceInr: PLAN_PRICES_INR.pro,
    pinCredits: PLAN_CREDITS.pro,
    description: "For regular Pinterest publishing.",
    razorpayPlanEnv: "RAZORPAY_PLAN_PRO",
  },
  {
    id: "pro_plus",
    name: "Pro Plus",
    priceInr: PLAN_PRICES_INR.pro_plus,
    pinCredits: PLAN_CREDITS.pro_plus,
    description: "For high-volume creators and teams.",
    razorpayPlanEnv: "RAZORPAY_PLAN_PRO_PLUS",
    featured: true,
  },
  {
    id: "pro_max",
    name: "Pro Max",
    priceInr: PLAN_PRICES_INR.pro_max,
    pinCredits: PLAN_CREDITS.pro_max,
    description: "Displayed as unlimited with a 1,000,000 monthly cap.",
    razorpayPlanEnv: "RAZORPAY_PLAN_PRO_MAX",
  },
];

export const TRIAL_PLAN = {
  id: "trial",
  name: "Lifetime Trial",
  priceInr: PLAN_PRICES_INR.trial,
  pinCredits: 1_000,
  description: "One-time purchase, available once per account.",
};

export function getPlan(id: string): PlanConfig | undefined {
  return PLANS.find((plan) => plan.id === id);
}
