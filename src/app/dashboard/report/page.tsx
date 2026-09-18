import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ReportForm from "@/components/ReportForm";
import { Icon } from "@/components/Icon";

export const metadata = { title: "Report & Support · TechTreasure" };

export default async function ReportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Icon name="fluent-emoji-flat:speech-balloon" size={26} />
          Report &amp; Support
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Ask a question, report a bug, share a complaint, or suggest an improvement.
        </p>
      </header>
      <div className="rounded-md border border-brand/20 bg-brand/5 p-4 text-sm text-neutral-700">
        Include the steps you took, what you expected, and what happened instead.
        For payment issues, include the Razorpay payment or order ID, but never
        include card numbers, passwords, API keys, or other secrets.
      </div>
      <ReportForm userId={user.id} initialEmail={user.email ?? ""} />
    </div>
  );
}
