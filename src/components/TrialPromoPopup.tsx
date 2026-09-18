"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TRIAL_PLAN } from "@/lib/plans";

interface Props {
  variant?: "home" | "dashboard";
}

const STORAGE_KEY = "trial-promo-dismissed";

export default function TrialPromoPopup({ variant = "home" }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY)) return;
    } catch {
      // storage unavailable — still show once per mount
    }
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Special trial offer">
      <div className="card w-full max-w-md space-y-4 border-brand/30 ring-2 ring-brand/20">
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-full bg-brand px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
            Specially for you
          </span>
          <button type="button" onClick={dismiss} className="btn-secondary px-2 py-1 text-xs" aria-label="Close offer">
            ✕
          </button>
        </div>
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">
            ₹{TRIAL_PLAN.priceInr} Lifetime Trial
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Get <span className="font-bold text-neutral-900">{TRIAL_PLAN.pinCredits.toLocaleString("en-IN")} pin credits</span> one-time, once per account. {variant === "dashboard" ? "Boost this account and start bulk publishing today." : "Start bulk Pinterest publishing for less than a coffee."}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={dismiss} className="btn-secondary w-full sm:w-auto">
            Maybe later
          </button>
          <Link href="/pricing" onClick={dismiss} className="btn-primary w-full text-center sm:w-auto">
            Claim ₹{TRIAL_PLAN.priceInr} trial
          </Link>
        </div>
      </div>
    </div>
  );
}
