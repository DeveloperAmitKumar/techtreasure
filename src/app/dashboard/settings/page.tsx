import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GeminiKeyForm from "@/components/GeminiKeyForm";
import { Icon } from "@/components/Icon";
import { getProfileBalances } from "@/lib/profileCredits";

export const metadata = { title: "Settings · TechTreasure" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfileBalances(supabase, user.id);

  const key = profile?.gemini_api_key ?? null;
  const masked = key ? `••••${key.slice(-4)}` : null;
  const useCustomKey = profile?.use_custom_gemini_key ?? true;
  const usingCustomKey = !!key && useCustomKey;

  return (
    <div className="max-w-2xl space-y-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Icon name="fluent-emoji-flat:gear" size={26} />
          Settings
        </h1>
        <p className="mt-1 text-sm text-neutral-500">{user.email}</p>
      </header>

      <section className="card">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
          <Icon name="fluent-emoji-flat:robot" size={22} />
          Your own Gemini API key
        </h2>
        <p className="mb-4 text-sm text-neutral-600">
          AI generation is coming soon for built-in account credits. For now,
          AI works only when you add and enable your own Google Gemini API key.
          Your own key does not spend AI credits.
        </p>
        <GeminiKeyForm
          userId={user.id}
          hasKey={!!key}
          masked={masked}
          useCustomKey={useCustomKey}
        />
      </section>

      <section className="card">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Icon name="fluent-emoji-flat:coin" size={22} />
          Account
        </h2>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-neutral-500">Plan</dt>
            <dd className="font-semibold capitalize">{profile?.plan ?? "free"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">AI credits</dt>
            <dd className="font-semibold">
              {usingCustomKey ? (
                <span className="text-green-700">API key Being used</span>
              ) : (
                profile?.ai_credits ?? 0
              )}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Pin credits</dt>
            <dd className="font-semibold">
              {usingCustomKey ? (
                <span className="text-green-700">API key Being used</span>
              ) : (
                profile?.credits ?? 0
              )}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Language</dt>
            <dd className="font-semibold uppercase">{profile?.language ?? "en"}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-neutral-500">
          Each generated pin costs 1 pin credit. AI credits are coming soon.
          Until then, AI mode requires your own Gemini API key; fully-detailed
          Without-AI imports spend pin credits only.
        </p>
        {profile && !profile.splitCredits && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Credit pools aren&apos;t split yet — both balances mirror your
            single pool. Run the <code>ai_credits</code> SQL from the project{" "}
            <code>supabase/schema.sql</code> in your Supabase SQL Editor to
            enable separate AI credits.
          </p>
        )}
      </section>
    </div>
  );
}
