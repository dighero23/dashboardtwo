import type { Metadata } from "next";
import AdminPanel from "./AdminPanel";

export const metadata: Metadata = {
  title: "Admin — JD Dashboard",
};

export default function AdminPage() {
  return <AdminPanel />;
}
