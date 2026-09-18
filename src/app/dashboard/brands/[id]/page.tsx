import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BrandForm from "@/components/BrandForm";

export default async function EditBrandPage({
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

  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!brand || brand.user_id !== user.id) {
    redirect("/dashboard/brands");
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Edit Brand</h1>
      <BrandForm initialBrand={brand} />
    </div>
  );
}
