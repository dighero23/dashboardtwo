"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface PermissionsState {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  canEditStocks: boolean;
  canEditF1: boolean;
  canEditMacro: boolean;
}

export function usePermissions(): PermissionsState {
  const [user, setUser]                   = useState<User | null>(null);
  const [loading, setLoading]             = useState(true);
  const [isAdmin, setIsAdmin]             = useState(false);
  const [canEditStocks, setCanEditStocks] = useState(false);
  const [canEditF1, setCanEditF1]         = useState(false);
  const [canEditMacro, setCanEditMacro]   = useState(false);

  // Auth subscription
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (!u) {
        setIsAdmin(false);
        setCanEditStocks(false);
        setCanEditF1(false);
        setCanEditMacro(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch permissions whenever the user changes
  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setCanEditStocks(false);
      setCanEditF1(false);
      setCanEditMacro(false);
      return;
    }
    fetch("/api/auth/permissions")
      .then((r) => r.ok ? r.json() : null)
      .then((p) => {
        const admin = p?.is_admin === true;
        setIsAdmin(admin);
        setCanEditStocks(admin || p?.can_edit_stocks === true);
        setCanEditF1(admin || p?.can_edit_f1 === true);
        setCanEditMacro(admin || p?.can_edit_macro === true);
      })
      .catch(() => {});
  }, [user]);

  return { user, loading, isAdmin, canEditStocks, canEditF1, canEditMacro };
}
