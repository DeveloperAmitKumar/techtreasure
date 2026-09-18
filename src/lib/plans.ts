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
  /**
   * Availability status flag — control plans from here itself.
   * true  = available for purchase.
   * false = temporarily unavailable (card shows badge + disabled button).
   */
  available?: boolean;
}

export const PLANS: PlanConfig[] = [
  {
    id: "free",
    name: "Free",
    priceInr: PLAN_PRICES_INR.free,
    pinCredits: PLAN_CREDITS.free,
    description: "For trying the pin workflow.",
    razorpayPlanEnv: null,
    available: true,
  },
  {
    id: "pro",
    name: "Pro",
    priceInr: PLAN_PRICES_INR.pro,
    pinCredits: PLAN_CREDITS.pro,
    description: "For regular Pinterest publishing.",
    razorpayPlanEnv: "RAZORPAY_PLAN_PRO",
    available: false,
  },
  {
    id: "pro_plus",
    name: "Pro Plus",
    priceInr: PLAN_PRICES_INR.pro_plus,
    pinCredits: PLAN_CREDITS.pro_plus,
    description: "For high-volume creators and teams.",
    razorpayPlanEnv: "RAZORPAY_PLAN_PRO_PLUS",
    featured: true,
    available: false,
  },
  {
    id: "pro_max",
    name: "Pro Max",
    priceInr: PLAN_PRICES_INR.pro_max,
    pinCredits: PLAN_CREDITS.pro_max,
    description: "Displayed as unlimited with a 1,000,000 monthly cap.",
    razorpayPlanEnv: "RAZORPAY_PLAN_PRO_MAX",
    available: false,
  },
];

export const TRIAL_PLAN = {
  id: "trial",
  name: "Lifetime Trial",
  priceInr: PLAN_PRICES_INR.trial,
  pinCredits: 10_000,
  description: "One-time purchase, available once per account.",
  available: true,
};

export function getPlan(id: string): PlanConfig | undefined {
  return PLANS.find((plan) => plan.id === id);
}

export function isPlanAvailable(plan: Pick<PlanConfig, "available"> | undefined): boolean {
  // Undefined = legacy plan without the flag → treat as available.
  if (!plan) return false;
  return plan.available !== false;
}

// ============================================================
// Credit top-up packs (one-time purchases, repeatable).
// Edit ONLY this block to change pack sizes/prices/limits.
// ============================================================
/** Price in ₹ for every 1,000 pin credits (custom amounts use this rate). */
export const PACK_PRICE_PER_1000_CREDITS = 20;
/** Smallest / largest credits allowed in a single pack order. */
export const PACK_MIN_CREDITS = 1000;
export const PACK_MAX_CREDITS = 10000;
/** Custom amounts must be a multiple of this. */
export const PACK_CREDIT_STEP = 1000;

export interface CreditPack {
  id: string;
  credits: number;
  /** Fixed price in ₹ (kept in sync with PACK_PRICE_PER_1000_CREDITS). */
  priceInr: number;
  tag?: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "pack_1k", credits: 1000, priceInr: 20 },
  { id: "pack_5k", credits: 5000, priceInr: 100, tag: "Popular" },
  { id: "pack_10k", credits: 10000, priceInr: 200, tag: "Best value" },
];

/** Price in ₹ for an arbitrary credit amount at the per-1000 rate. */
export function packPriceForCredits(credits: number): number {
  return Math.round((credits * PACK_PRICE_PER_1000_CREDITS) / 1000);
}

/** Server + client validation for pack orders (custom amounts included). */
export function isValidPackCredits(credits: unknown): credits is number {
  return (
    typeof credits === "number" &&
    Number.isInteger(credits) &&
    credits >= PACK_MIN_CREDITS &&
    credits <= PACK_MAX_CREDITS &&
    credits % PACK_CREDIT_STEP === 0
  );
}
