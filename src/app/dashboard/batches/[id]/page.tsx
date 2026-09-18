import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CsvExport from "@/components/CsvExport";
import ZipExport from "@/components/ZipExport";
import DeleteButton from "@/components/DeleteButton";
import type { Batch, Pin } from "@/lib/types";

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: batch } = await supabase
    .from("batches")
    .select("*, brand:brands(*)")
    .eq("id", id)
    .single();

  if (!batch) notFound();

  const { data: pins } = await supabase
    .from("pins")
    .select("*")
    .eq("batch_id", id)
    .order("scheduled_at", { ascending: true });

  return (
    <div>
      <Link
        href="/dashboard/batches"
        className="text-sm text-neutral-500 hover:underline"
      >
        ← All batches
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{batch.board_name}</h1>
          <p className="text-sm text-neutral-500">
            {(batch.brand as Batch["brand"])?.name} · {batch.content_type} ·{" "}
            {batch.language} · {pins?.length ?? 0} pins
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CsvExport
            pins={(pins ?? []) as Pin[]}
            boardName={batch.board_name}
            sourceLink={batch.source_link}
            batchId={batch.id}
          />
          <ZipExport
            pins={(pins ?? []) as Pin[]}
            boardName={batch.board_name}
            sourceLink={batch.source_link}
            batchId={batch.id}
          />
          <DeleteButton
            table="batches"
            id={batch.id}
            name={batch.board_name}
            warn="All pins in this batch will also be deleted."
            redirectTo="/dashboard/batches"
          />
        </div>
      </div>

      <div className="card mt-6 overflow-x-auto p-0">
        <CsvPreview pins={(pins ?? []) as Pin[]} />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(pins ?? []).map((p) => (
          <div key={p.id} className="card overflow-hidden p-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.image_url}
              alt={p.title}
              className="aspect-[2/3] w-full object-cover"
            />
            <div className="p-3">
              <p className="line-clamp-2 text-sm font-semibold">{p.title}</p>
              <p className="mt-1 text-xs text-neutral-500">
                {new Date(p.scheduled_at).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CsvPreview({ pins }: { pins: Pin[] }) {
  const rows = pins.slice(0, 10);
  return (
    <table className="w-full text-left text-xs">
      <thead className="bg-neutral-50 uppercase text-neutral-500">
        <tr>
          <th className="px-3 py-2">Title</th>
          <th className="px-3 py-2">Media URL</th>
          <th className="px-3 py-2">Publish date</th>
          <th className="px-3 py-2">Keywords</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-100">
        {rows.map((p) => (
          <tr key={p.id}>
            <td className="max-w-[220px] truncate px-3 py-2">{p.title}</td>
            <td className="max-w-[220px] truncate px-3 py-2 text-neutral-500">
              {p.image_url}
            </td>
            <td className="px-3 py-2 text-neutral-500">
              {new Date(p.scheduled_at).toISOString().slice(0, 19)}
            </td>
            <td className="max-w-[220px] truncate px-3 py-2 text-neutral-500">
              {(p.tags ?? []).join(", ")}
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={4} className="px-3 py-6 text-center text-neutral-500">
              No pins in this batch.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
