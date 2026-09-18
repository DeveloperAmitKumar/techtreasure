import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DeleteButton from "@/components/DeleteButton";
import { Icon } from "@/components/Icon";

export default async function BoardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: boards } = await supabase
    .from("saved_boards")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Boards</h1>
        <Link href="/dashboard/boards/new" className="btn-primary">
          + New Board
        </Link>
      </div>

      {boards && boards.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((b) => (
            <div key={b.id} className="card">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand/10 text-brand">
                  <Icon name="fluent-emoji-flat:clapper-board" size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{b.name}</p>
                  {b.pinterest_url ? (
                    <a
                      href={b.pinterest_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 block truncate text-xs text-brand hover:underline"
                    >
                      {b.pinterest_url}
                    </a>
                  ) : (
                    <p className="mt-0.5 text-xs text-neutral-400">
                      No Pinterest URL
                    </p>
                  )}
                </div>
              </div>
              {b.description && (
                <p className="mt-3 line-clamp-3 text-sm text-neutral-600">
                  {b.description}
                </p>
              )}
              <div className="mt-4 flex items-center justify-between gap-2">
                <p className="text-xs text-neutral-400">
                  {new Date(b.created_at).toLocaleDateString()}
                </p>
                <div className="flex gap-2">
                  <Link
                    href={`/dashboard/boards/${b.id}`}
                    className="btn-secondary"
                  >
                    Edit
                  </Link>
                  <DeleteButton
                    table="saved_boards"
                    id={b.id}
                    name={b.name}
                    warn="Saved boards are just reusable labels — no batches or pins will be deleted."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card mt-8 text-center">
          <p className="text-neutral-600">No saved boards yet.</p>
          <p className="mt-1 text-sm text-neutral-500">
            Save boards here to reuse them quickly in every batch.
          </p>
          <Link href="/dashboard/boards/new" className="btn-primary mt-4">
            Create your first board
          </Link>
        </div>
      )}
    </div>
  );
}
