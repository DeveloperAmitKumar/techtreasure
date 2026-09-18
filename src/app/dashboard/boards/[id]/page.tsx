import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BoardForm from "@/components/BoardForm";

export default async function EditBoardPage({
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

  const { data: board } = await supabase
    .from("saved_boards")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!board || board.user_id !== user.id) {
    redirect("/dashboard/boards");
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Edit Board</h1>
      <BoardForm initialBoard={board} />
    </div>
  );
}
