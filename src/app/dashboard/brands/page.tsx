import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DeleteButton from "@/components/DeleteButton";
import { Icon } from "@/components/Icon";

export default async function BrandsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brands } = await supabase
    .from("brands")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Brands</h1>
        <Link href="/dashboard/brands/new" className="btn-primary">
          + New Brand
        </Link>
      </div>

      {brands && brands.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((b) => (
            <div key={b.id} className="card">
              <div className="flex items-center gap-3">
                {b.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.logo_url}
                    alt={b.name}
                    className="h-10 w-10 rounded-md object-cover"
                  />
                ) : (
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-md text-sm font-bold"
                    style={{ background: b.bg_color, color: b.text_color }}
                  >
                    {b.icon_name ? (
                      <Icon name={b.icon_name} size={24} title={`${b.name} icon`} />
                    ) : (
                      b.name.charAt(0)
                    )}
                  </div>
                )}
                <div>
                  <p className="font-semibold">{b.name}</p>
                  <p className="text-xs text-neutral-500" style={{ fontFamily: b.font }}>
                    {b.font.split(",")[0].replace(/['"]/g, "")}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="flex gap-2">
                  <span
                    className="h-6 w-6 rounded-full border border-neutral-200"
                    style={{ background: b.bg_color }}
                    title="Background"
                  />
                  <span
                    className="h-6 w-6 rounded-full border border-neutral-200"
                    style={{ background: b.text_color }}
                    title="Text"
                  />
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/dashboard/brands/${b.id}`}
                    className="btn-secondary"
                  >
                    Edit
                  </Link>
                  <DeleteButton
                    table="brands"
                    id={b.id}
                    name={b.name}
                    warn="All batches and pins using this brand will also be deleted."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card mt-8 text-center">
          <p className="text-neutral-600">No brands yet.</p>
          <Link href="/dashboard/brands/new" className="btn-primary mt-4">
            Create your first brand
          </Link>
        </div>
      )}
    </div>
  );
}
