import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BatchForm from "@/components/BatchForm";
import type { Brand, SavedBoard } from "@/lib/types";
import { getProfileBalances } from "@/lib/profileCredits";

export default async function NewBatchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: brands }, { data: boards }] = await Promise.all([
    supabase
      .from("brands")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("saved_boards")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  const profile = await getProfileBalances(supabase, user.id);

  const hasKey = !!profile?.gemini_api_key;
  const useCustomKey = profile?.use_custom_gemini_key ?? true;
  const unlimited = hasKey && useCustomKey;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">New batch</h1>
      {(brands?.length ?? 0) === 0 ? (
        <div className="card max-w-xl text-center">
          <p className="text-neutral-600">
            You need at least one brand before creating a batch.
          </p>
          <a href="/dashboard/brands/new" className="btn-primary mt-4">
            Create a brand
          </a>
        </div>
      ) : (
        <BatchForm
          brands={brands as Brand[]}
          boards={(boards ?? []) as SavedBoard[]}
          initialCredits={profile?.credits ?? 0}
          initialAiCredits={profile?.ai_credits ?? 0}
          initialLanguage={profile?.language ?? "en"}
          unlimited={unlimited}
          hasGeminiKey={hasKey}
          initialUseCustomKey={useCustomKey}
          userId={user.id}
        />
      )}
    </div>
  );
}
