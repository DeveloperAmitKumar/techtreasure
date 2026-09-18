import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DeleteButton from "@/components/DeleteButton";

export default async function BatchesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: batches } = await supabase
    .from("batches")
    .select("*, brand:brands(name)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Batches</h1>
        <Link href="/dashboard/batches/new" className="btn-primary">
          + New batch
        </Link>
      </div>

      {batches && batches.length > 0 ? (
        <div className="mt-8 overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-3">Board</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {batches.map((b) => (
                <tr key={b.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium">{b.board_name}</td>
                  <td className="px-4 py-3">{b.brand?.name ?? "—"}</td>
                  <td className="px-4 py-3 capitalize">{b.content_type}</td>
                  <td className="px-4 py-3 text-neutral-500">
                    {new Date(b.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/dashboard/batches/${b.id}`}
                        className="font-semibold text-brand hover:underline"
                      >
                        Open
                      </Link>
                      <DeleteButton
                        table="batches"
                        id={b.id}
                        name={b.board_name}
                        warn="All pins in this batch will also be deleted."
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card mt-8 text-center">
          <p className="text-neutral-600">No batches yet.</p>
          <Link href="/dashboard/batches/new" className="btn-primary mt-4">
            Create your first batch
          </Link>
        </div>
      )}
    </div>
  );
}
