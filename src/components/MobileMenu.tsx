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

export default function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-neutral-200 bg-white p-4 lg:hidden">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="text-xl font-extrabold text-brand">
          TechTreasure
        </Link>
        <button
          type="button"
          className="btn-secondary px-3"
          aria-expanded={open}
          aria-controls="mobile-dashboard-menu"
          onClick={() => setOpen((value) => !value)}
        >
          <Icon name={open ? "fluent-emoji-flat:cross-mark" : "fluent-emoji-flat:hamburger"} size={20} />
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        </button>
      </div>
      {open && (
        <nav id="mobile-dashboard-menu" className="mt-4 grid gap-1 border-t border-neutral-100 pt-3">
          {links.map(([href, icon, label]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              <Icon name={icon} size={18} />
              {label}
            </Link>
          ))}
          <div className="mt-2 border-t border-neutral-100 pt-3">
            <LogoutButton />
          </div>
        </nav>
      )}
    </div>
  );
}
