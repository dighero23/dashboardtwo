"use client";

import { useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import LoginModal from "@/app/stocks/components/LoginModal";

export default function HomeAuthButton() {
  const { user, loading } = usePermissions();
  const [showLogin, setShowLogin] = useState(false);

  if (loading) return null;

  return (
    <>
      {user ? (
        <button
          onClick={() => createClient().auth.signOut()}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      ) : (
        <button
          onClick={() => setShowLogin(true)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <LogIn className="w-3.5 h-3.5" />
          Login
        </button>
      )}
      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={() => setShowLogin(false)}
        />
      )}
    </>
  );
}
