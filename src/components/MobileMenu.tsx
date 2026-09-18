"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "./Icon";
import LogoutButton from "./LogoutButton";

const links = [
  ["/dashboard", "fluent-emoji-flat:house", "Overview"],
  ["/dashboard/brands", "fluent-emoji-flat:label", "Brands"],
  ["/dashboard/boards", "fluent-emoji-flat:clapper-board", "Boards"],
  ["/dashboard/batches", "fluent-emoji-flat:card-file-box", "Batches"],
  ["/dashboard/batches/new", "fluent-emoji-flat:sparkles", "New batch"],
  ["/dashboard/guides", "fluent-emoji-flat:open-book", "Guides"],
  ["/dashboard/settings", "fluent-emoji-flat:gear", "Settings"],
  ["/dashboard/report", "fluent-emoji-flat:speech-balloon", "Report & Support"],
] as const;

export default function MobileMenu({
  plan = "free",
  credits = 0,
}: {
  plan?: string;
  credits?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-neutral-200 bg-white lg:hidden">
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <Link href="/dashboard" className="min-w-0 truncate text-xl font-extrabold text-brand">
            TechTreasure
          </Link>
          <button
            type="button"
            className="btn-secondary shrink-0 px-3 py-1.5"
            aria-expanded={open}
            aria-controls="mobile-dashboard-menu"
            onClick={() => setOpen((value) => !value)}
          >
            <Icon name={open ? "fluent-emoji-flat:cross-mark" : "fluent-emoji-flat:hamburger"} size={20} />
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
        {/* Credits + Upgrade — second row so 360px screens never overflow */}
        <div className="flex items-center gap-2">
          <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-800">
            <span className="truncate capitalize">{plan}</span>
            <span className="shrink-0 text-neutral-400">•</span>
            <span className="shrink-0">{credits.toLocaleString("en-IN")} credits</span>
          </span>
          <Link
            href="/pricing"
            className="btn-primary shrink-0 px-3 py-1.5 text-xs"
          >
            Upgrade
          </Link>
        </div>
      </div>
      {open && (
        <nav id="mobile-dashboard-menu" className="mx-4 mb-4 grid gap-1 border-t border-neutral-100 pt-3">
          {links.map(([href, icon, label]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              <Icon name={icon} size={18} />
              {label}
            </Link>
          ))}
          <div className="mt-2 grid gap-2 border-t border-neutral-100 pt-3">
            <Link
              href="/pricing"
              onClick={() => setOpen(false)}
              className="btn-primary w-full text-center"
            >
              Upgrade plan — ₹9 trial: 10k credits
            </Link>
            <LogoutButton />
          </div>
        </nav>
      )}
    </div>
  );
}
