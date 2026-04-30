import { createAdminClient } from "./supabase/server";

export interface UserPermissions {
  user_id: string;
  is_admin: boolean;
  can_edit_stocks: boolean;
  can_edit_f1: boolean;
  can_edit_macro: boolean;
}

export type PermissionKey = keyof Omit<UserPermissions, "user_id">;

const COLUMNS = "user_id, is_admin, can_edit_stocks, can_edit_f1, can_edit_macro";

export async function getPermissions(userId: string): Promise<UserPermissions | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("user_permissions")
    .select(COLUMNS)
    .eq("user_id", userId)
    .single();
  return (data as UserPermissions | null) ?? null;
}

/** Returns true if the user has the given permission, or is an admin. */
export async function checkPermission(userId: string, perm: PermissionKey): Promise<boolean> {
  const p = await getPermissions(userId);
  if (!p) return false;
  if (p.is_admin) return true;
  return p[perm] === true;
}

export async function checkAdmin(userId: string): Promise<boolean> {
  const p = await getPermissions(userId);
  return p?.is_admin === true;
}
