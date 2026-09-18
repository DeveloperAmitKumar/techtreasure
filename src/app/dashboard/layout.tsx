import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";
import { Icon } from "@/components/Icon";
import MobileMenu from "@/components/MobileMenu";
import { getProfileBalances } from "@/lib/profileCredits";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const profile = await getProfileBalances(supabase, user.id);

  return (
    <div className="min-h-screen lg:flex">
      <div className="lg:hidden">
        <MobileMenu />
      </div>
      <aside className="hidden border-b border-neutral-200 bg-white lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col p-6">
          <Link href="/dashboard" className="text-xl font-extrabold text-brand">
            TechTreasure
          </Link>
          <nav className="mt-8 flex flex-col gap-1">
            <NavLink href="/dashboard" icon="fluent-emoji-flat:house">
              Overview
            </NavLink>
            <NavLink href="/dashboard/brands" icon="fluent-emoji-flat:label">
              Brands
            </NavLink>
            <NavLink href="/dashboard/boards" icon="fluent-emoji-flat:clapper-board">
              Boards
            </NavLink>
            <NavLink href="/dashboard/batches" icon="fluent-emoji-flat:card-file-box">
              Batches
            </NavLink>
            <NavLink href="/dashboard/batches/new" icon="fluent-emoji-flat:sparkles">
              New batch
            </NavLink>
            <NavLink href="/dashboard/guides" icon="fluent-emoji-flat:open-book">
              Guides
            </NavLink>
            <NavLink href="/dashboard/settings" icon="fluent-emoji-flat:gear">
              Settings
            </NavLink>
            <NavLink href="/dashboard/report" icon="fluent-emoji-flat:speech-balloon">
              Report &amp; Support
            </NavLink>
          </nav>
          <div className="mt-auto space-y-3 pt-8">
            <div className="rounded-lg bg-neutral-100 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">
                Plan
              </p>
              <p className="text-lg font-bold capitalize">
                {profile?.plan ?? "free"}
              </p>
              <p className="mt-2 text-xs uppercase tracking-wide text-neutral-500">
                AI credits
              </p>
              <p className="text-lg font-bold">{profile?.ai_credits ?? 0}</p>
              <p className="mt-2 text-xs uppercase tracking-wide text-neutral-500">
                Pin credits
              </p>
              <p className="text-lg font-bold">{profile?.credits ?? 0}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </aside>
      <main className="flex-1 p-6 lg:p-10">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
    >
      <Icon name={icon} size={18} />
      {children}
    </Link>
  );
}
