import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkAdmin } from "@/lib/permissions";
import AdminPanel from "./AdminPanel";

export const metadata: Metadata = {
  title: "Admin — JD Dashboard",
};

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await checkAdmin(user.id))) {
    redirect("/");
  }
  return <AdminPanel />;
}
